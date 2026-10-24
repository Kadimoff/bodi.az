import { sql } from '../../db.js';
import { requirePerm, audit } from '../../lib/auth.js';
import { slugify } from '../../lib/text.js';
import { presentMedia } from '../../lib/media.js';
import { recordSlugChange, clearColorCache } from '../../lib/catalog.js';
import { conflict, notFound, badRequest } from '../../lib/errors.js';
import { str, bool, int, required, seoBlock } from '../../lib/validate.js';

const HEX = /^#[0-9a-f]{6}$/i;

export default async function catalogAdminRoutes(app) {
  app.addHook('onRequest', requirePerm('catalog'));

  // ------------------------------------------------------------ categories
  app.get('/categories', async () => {
    const rows = await sql`
      SELECT c.*, m.path, m.formats, m.alt, m.width, m.height, m.mime, m.size, m.kind, m.title AS m_title, m.caption,
             (SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.id) AS product_count
      FROM categories c LEFT JOIN media m ON m.id = c.image_id
      ORDER BY c.sort_order, c.name`;
    return rows.map((r) => ({
      id: r.id, slug: r.slug, name: r.name, description: r.description, parent_id: r.parent_id,
      image_id: r.image_id, sort_order: r.sort_order, is_active: r.is_active, seo: r.seo,
      product_count: r.product_count, created_at: r.created_at, updated_at: r.updated_at,
      image: r.path ? presentMedia({ id: r.image_id, path: r.path, formats: r.formats, alt: r.alt, width: r.width, height: r.height, mime: r.mime, size: r.size, kind: r.kind, title: r.m_title, caption: r.caption }) : null,
    }));
  });

  function categoryInput(b) {
    return {
      name: required(str(b.name, 120), 'Kateqoriyanın adı'),
      description: str(b.description, 2000),
      parent_id: b.parent_id ? int(b.parent_id) : null,
      image_id: b.image_id ? int(b.image_id) : null,
      sort_order: int(b.sort_order),
      is_active: b.is_active === undefined ? true : bool(b.is_active),
      seo: seoBlock(b.seo),
    };
  }

  app.post('/categories', async (request, reply) => {
    const input = categoryInput(request.body || {});
    const slug = slugify(request.body.slug || input.name);
    if (!slug) throw badRequest('Slug yaradıla bilmədi.');
    const [c] = await sql`INSERT INTO categories ${sql({ ...input, seo: sql.json(input.seo), slug })} RETURNING *`;
    await audit(request, 'create', 'category', c.id, c.name);
    reply.status(201);
    return c;
  });

  app.put('/categories/:id', async (request) => {
    const id = int(request.params.id);
    const input = categoryInput(request.body || {});
    if (input.parent_id === id) throw badRequest('Kateqoriya özünün alt kateqoriyası ola bilməz.');
    const c = await sql.begin(async (tx) => {
      const [old] = await tx`SELECT * FROM categories WHERE id = ${id}`;
      if (!old) throw notFound('Kateqoriya tapılmadı.');
      const slug = slugify(request.body.slug || old.slug);
      const [row] = await tx`UPDATE categories SET ${sql({ ...input, seo: sql.json(input.seo), slug })}, updated_at = now() WHERE id = ${id} RETURNING *`;
      await recordSlugChange('category', id, old.slug, slug, tx);
      return row;
    });
    await audit(request, 'update', 'category', id, c.name);
    return c;
  });

  app.delete('/categories/:id', async (request) => {
    const id = int(request.params.id);
    const [c] = await sql`DELETE FROM categories WHERE id = ${id} RETURNING name`;
    if (!c) throw notFound('Kateqoriya tapılmadı.');
    await audit(request, 'delete', 'category', id, c.name);
    return { success: true };
  });

  // ---------------------------------------------------------------- colours
  app.get('/colors', async () => sql`
    SELECT c.*, (SELECT COUNT(*)::int FROM products p WHERE c.slug = ANY(p.colors)) AS product_count
    FROM colors c ORDER BY c.sort_order, c.name`);

  function colorInput(b) {
    const hex = str(b.hex, 7);
    const dark = str(b.hex_dark, 7);
    const label = str(b.label_color, 7);
    if (![hex, dark, label].every((h) => HEX.test(h))) throw badRequest('Rəng kodları #RRGGBB formatında olmalıdır.');
    return {
      name: required(str(b.name, 60), 'Rəngin adı'),
      hex,
      hex_dark: dark,
      label_color: label,
      aliases: (Array.isArray(b.aliases) ? b.aliases : String(b.aliases || '').split(','))
        .map((a) => slugify(a).replace(/-/g, '')).filter(Boolean),
      sort_order: int(b.sort_order),
    };
  }

  app.post('/colors', async (request, reply) => {
    const input = colorInput(request.body || {});
    const slug = slugify(request.body.slug || input.name);
    if (!slug) throw badRequest('Slug yaradıla bilmədi.');
    const [c] = await sql`INSERT INTO colors ${sql({ ...input, slug })} RETURNING *`;
    clearColorCache();
    await audit(request, 'create', 'color', slug, input.name);
    reply.status(201);
    return c;
  });

  app.put('/colors/:slug', async (request) => {
    const input = colorInput(request.body || {});
    const [c] = await sql`UPDATE colors SET ${sql(input)} WHERE slug = ${request.params.slug} RETURNING *`;
    if (!c) throw notFound('Rəng tapılmadı.');
    clearColorCache();
    await audit(request, 'update', 'color', c.slug, c.name);
    return c;
  });

  app.delete('/colors/:slug', async (request) => {
    const slug = request.params.slug;
    const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM products WHERE ${slug} = ANY(colors)`;
    if (n) throw conflict(`Bu rəng ${n} məhsulda istifadə olunur. Əvvəlcə məhsullardan çıxarın.`);
    const [c] = await sql`DELETE FROM colors WHERE slug = ${slug} RETURNING name`;
    if (!c) throw notFound('Rəng tapılmadı.');
    clearColorCache();
    await audit(request, 'delete', 'color', slug, c.name);
    return { success: true };
  });
}
