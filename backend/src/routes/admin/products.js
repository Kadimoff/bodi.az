import { sql } from '../../db.js';
import { requirePerm, audit } from '../../lib/auth.js';
import { cleanHtml } from '../../lib/html.js';
import { slugify, stripHtml } from '../../lib/text.js';
import { presentMedia, pickFormat } from '../../lib/media.js';
import { recordSlugChange, refreshProductRating } from '../../lib/catalog.js';
import { syncVariants } from '../../lib/inventory.js';
import { analyzeSeo } from '../../lib/seo.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import {
  str, bool, int, num, numOrNull, strList, oneOf, required, seoBlock, pageParams,
} from '../../lib/validate.js';

const STATUSES = ['draft', 'published', 'archived'];

async function uniqueSlug(base, id = 0, tx = sql) {
  const root = slugify(base) || 'mehsul';
  let slug = root;
  for (let i = 2; ; i++) {
    const [hit] = await tx`SELECT 1 FROM products WHERE slug = ${slug} AND id <> ${id}`;
    if (!hit) return slug;
    slug = `${root}-${i}`;
  }
}

function productInput(b) {
  const attributes = (Array.isArray(b.attributes) ? b.attributes : [])
    .map((a) => ({ name: str(a.name, 60), value: str(a.value, 300) }))
    .filter((a) => a.name && a.value)
    .slice(0, 20);
  return {
    name: required(str(b.name, 200), 'Məhsulun adı'),
    sku: str(b.sku, 60).toUpperCase() || null,
    status: oneOf(b.status, STATUSES, 'draft'),
    category_id: b.category_id ? int(b.category_id) : null,
    short_description: str(b.short_description, 600),
    description: cleanHtml(b.description),
    material: str(b.material, 120),
    price: num(b.price),
    compare_at_price: numOrNull(b.compare_at_price),
    cost_price: numOrNull(b.cost_price),
    badge: str(b.badge, 30),
    is_new: bool(b.is_new),
    is_featured: bool(b.is_featured),
    colors: strList(b.colors, 40).map((c) => slugify(c)).filter(Boolean),
    sizes: strList(b.sizes, 40),
    attributes,
    track_stock: bool(b.track_stock),
    allow_backorder: bool(b.allow_backorder),
    sort_order: int(b.sort_order),
    seo: seoBlock(b.seo),
  };
}

async function saveImages(tx, productId, images) {
  if (!Array.isArray(images)) return;
  await tx`DELETE FROM product_images WHERE product_id = ${productId}`;
  let position = 0;
  for (const img of images.slice(0, 30)) {
    const mediaId = int(typeof img === 'object' ? img.media_id ?? img.id : img);
    if (!mediaId) continue;
    await tx`
      INSERT INTO product_images (product_id, media_id, position, color)
      VALUES (${productId}, ${mediaId}, ${position++}, ${typeof img === 'object' ? str(img.color, 40) : ''})
      ON CONFLICT DO NOTHING`;
  }
}

export async function loadAdminProduct(id) {
  const [p] = await sql`
    SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ${id}`;
  if (!p) throw notFound('Məhsul tapılmadı.');
  const images = await sql`
    SELECT m.*, pi.position, pi.color AS image_color FROM product_images pi JOIN media m ON m.id = pi.media_id
    WHERE pi.product_id = ${id} ORDER BY pi.position`;
  const variants = await sql`
    SELECT v.*,
      COALESCE((SELECT json_agg(json_build_object('warehouse_id', sl.warehouse_id, 'quantity', sl.quantity, 'min_quantity', sl.min_quantity, 'bin_location', sl.bin_location))
                FROM stock_levels sl WHERE sl.variant_id = v.id), '[]') AS levels,
      COALESCE((SELECT SUM(sl.quantity) FROM stock_levels sl JOIN warehouses w ON w.id = sl.warehouse_id AND w.is_active WHERE sl.variant_id = v.id), 0)::int AS quantity
    FROM product_variants v WHERE v.product_id = ${id}
    ORDER BY v.is_active DESC, v.id`;
  const [{ redirects }] = await sql`SELECT COALESCE(array_agg(old_slug), '{}') AS redirects FROM slug_redirects WHERE entity = 'product' AND entity_id = ${id}`;
  return {
    ...p,
    images: images.map((m) => ({ ...presentMedia(m), color: m.image_color })),
    variants,
    old_slugs: redirects,
  };
}

export default async function productRoutes(app) {
  app.addHook('onRequest', requirePerm('catalog'));

  app.get('/products', async (request) => {
    const { q, status, category, stock, sort } = request.query;
    const { page, perPage, offset } = pageParams(request.query);
    const conds = [sql`TRUE`];
    if (q) {
      const like = `%${String(q).slice(0, 80)}%`;
      conds.push(sql`(p.name ILIKE ${like} OR p.sku ILIKE ${like} OR p.slug ILIKE ${like})`);
    }
    if (STATUSES.includes(status)) conds.push(sql`p.status = ${status}`);
    if (category) conds.push(sql`p.category_id = ${int(category)}`);
    if (stock === 'out') conds.push(sql`p.track_stock AND COALESCE(s.qty, 0) <= 0`);
    if (stock === 'low') conds.push(sql`p.track_stock AND COALESCE(s.qty, 0) > 0 AND COALESCE(s.qty, 0) <= COALESCE(s.min_qty, 0) + 3`);
    if (stock === 'untracked') conds.push(sql`NOT p.track_stock`);
    const where = conds.reduce((a, c) => sql`${a} AND ${c}`);
    const orders = {
      new: sql`p.created_at DESC`,
      name: sql`p.name ASC`,
      price_asc: sql`p.price ASC`,
      price_desc: sql`p.price DESC`,
      stock: sql`COALESCE(s.qty, 0) ASC`,
      sales: sql`p.sales_count DESC`,
      updated: sql`p.updated_at DESC`,
    };
    const order = orders[sort] || sql`p.sort_order, p.id DESC`;
    const base = sql`
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN LATERAL (
        SELECT SUM(sl.quantity)::int AS qty, SUM(sl.min_quantity)::int AS min_qty, COUNT(DISTINCT v.id)::int AS variants
        FROM product_variants v
        LEFT JOIN stock_levels sl ON sl.variant_id = v.id
        LEFT JOIN warehouses w ON w.id = sl.warehouse_id
        WHERE v.product_id = p.id AND v.is_active AND (w.id IS NULL OR w.is_active)
      ) s ON TRUE
      WHERE ${where}`;
    const [{ total }] = await sql`SELECT COUNT(*)::int AS total ${base}`;
    const rows = await sql`
      SELECT p.id, p.name, p.slug, p.sku, p.status, p.price, p.compare_at_price, p.track_stock, p.is_new, p.is_featured,
             p.rating_avg, p.rating_count, p.sales_count, p.updated_at, p.seo, p.description, p.short_description,
             c.name AS category_name, COALESCE(s.qty, 0) AS stock, COALESCE(s.variants, 0) AS variant_count,
             (SELECT json_build_object('path', m.path, 'formats', m.formats, 'alt', m.alt)
                FROM product_images pi JOIN media m ON m.id = pi.media_id WHERE pi.product_id = p.id ORDER BY pi.position LIMIT 1) AS cover,
             (SELECT COUNT(*)::int FROM product_images pi JOIN media m ON m.id = pi.media_id WHERE pi.product_id = p.id AND m.alt = '') AS images_without_alt
      ${base}
      ORDER BY ${order}
      LIMIT ${perPage} OFFSET ${offset}`;
    return {
      total,
      page,
      per_page: perPage,
      items: rows.map((r) => {
        const seo = analyzeSeo({
          title: r.seo?.title || r.name,
          description: r.seo?.description || r.short_description,
          slug: r.slug,
          content: r.description || r.short_description,
          focusKeyword: r.seo?.focus_keyword,
          images: r.cover ? [{ alt: r.images_without_alt ? '' : 'ok' }] : [],
        });
        return {
          id: r.id,
          name: r.name,
          slug: r.slug,
          sku: r.sku,
          status: r.status,
          price: r.price,
          compare_at_price: r.compare_at_price,
          category_name: r.category_name,
          track_stock: r.track_stock,
          stock: r.stock,
          variant_count: r.variant_count,
          is_new: r.is_new,
          is_featured: r.is_featured,
          rating_avg: r.rating_avg,
          rating_count: r.rating_count,
          sales_count: r.sales_count,
          updated_at: r.updated_at,
          thumb: r.cover ? pickFormat(r.cover, 'thumb') : '',
          seo_score: seo.score,
        };
      }),
    };
  });

  app.get('/products/:id', async (request) => loadAdminProduct(int(request.params.id)));

  app.post('/products', async (request, reply) => {
    const input = productInput(request.body || {});
    const id = await sql.begin(async (tx) => {
      const slug = await uniqueSlug(request.body.slug || input.name, 0, tx);
      const [p] = await tx`
        INSERT INTO products ${sql({ ...input, seo: sql.json(input.seo), attributes: sql.json(input.attributes), slug, created_by: request.user.id, updated_by: request.user.id, published_at: input.status === 'published' ? new Date() : null })}
        RETURNING *`;
      await saveImages(tx, p.id, request.body.images);
      await syncVariants(tx, p);
      return p.id;
    });
    await audit(request, 'create', 'product', id, input.name);
    reply.status(201);
    return loadAdminProduct(id);
  });

  app.put('/products/:id', async (request) => {
    const id = int(request.params.id);
    const input = productInput(request.body || {});
    await sql.begin(async (tx) => {
      const [old] = await tx`SELECT * FROM products WHERE id = ${id} FOR UPDATE`;
      if (!old) throw notFound('Məhsul tapılmadı.');
      const slug = request.body.slug ? await uniqueSlug(request.body.slug, id, tx) : old.slug;
      const publishedAt = input.status === 'published' ? old.published_at || new Date() : old.published_at;
      const [p] = await tx`
        UPDATE products SET ${sql({ ...input, seo: sql.json(input.seo), attributes: sql.json(input.attributes), slug, updated_by: request.user.id, published_at: publishedAt })}, updated_at = now()
        WHERE id = ${id} RETURNING *`;
      await recordSlugChange('product', id, old.slug, slug, tx);
      await saveImages(tx, id, request.body.images);
      await syncVariants(tx, p);
    });
    await audit(request, 'update', 'product', id, input.name);
    return loadAdminProduct(id);
  });

  app.delete('/products/:id', async (request) => {
    const id = int(request.params.id);
    const [usage] = await sql`
      SELECT (SELECT COUNT(*) FROM order_items WHERE product_id = ${id})::int AS orders,
             (SELECT COUNT(*) FROM stock_movements sm JOIN product_variants v ON v.id = sm.variant_id WHERE v.product_id = ${id})::int AS movements`;
    if (usage.orders || usage.movements) {
      throw conflict(`Bu məhsulun ${usage.orders} sifariş və ${usage.movements} anbar hərəkəti tarixçəsi var. Silmək əvəzinə arxivləşdirin.`);
    }
    const [p] = await sql`DELETE FROM products WHERE id = ${id} RETURNING name`;
    if (!p) throw notFound('Məhsul tapılmadı.');
    await sql`DELETE FROM slug_redirects WHERE entity = 'product' AND entity_id = ${id}`;
    await audit(request, 'delete', 'product', id, p.name);
    return { success: true };
  });

  app.post('/products/:id/duplicate', async (request, reply) => {
    const src = await loadAdminProduct(int(request.params.id));
    const id = await sql.begin(async (tx) => {
      const slug = await uniqueSlug(`${src.slug}-kopya`, 0, tx);
      const [p] = await tx`
        INSERT INTO products (slug, name, status, category_id, short_description, description, material, price, compare_at_price,
                              cost_price, badge, is_new, is_featured, colors, sizes, attributes, track_stock, allow_backorder, seo, created_by, updated_by)
        VALUES (${slug}, ${`${src.name} (kopya)`}, 'draft', ${src.category_id}, ${src.short_description}, ${src.description}, ${src.material},
                ${src.price}, ${src.compare_at_price}, ${src.cost_price}, ${src.badge}, ${src.is_new}, ${src.is_featured}, ${src.colors},
                ${src.sizes}, ${sql.json(src.attributes)}, ${src.track_stock}, ${src.allow_backorder}, ${sql.json({ ...src.seo, canonical: '' })},
                ${request.user.id}, ${request.user.id})
        RETURNING *`;
      await saveImages(tx, p.id, src.images.map((m) => ({ media_id: m.id, color: m.color })));
      await syncVariants(tx, p);
      return p.id;
    });
    await audit(request, 'create', 'product', id, `${src.name} (kopya)`);
    reply.status(201);
    return loadAdminProduct(id);
  });

  app.post('/products/bulk', async (request) => {
    const ids = (request.body?.ids || []).map(Number).filter(Number.isInteger);
    const action = request.body?.action;
    if (!ids.length) throw badRequest('Heç bir məhsul seçilməyib.');
    const actions = {
      publish: sql`status = 'published', published_at = COALESCE(published_at, now())`,
      draft: sql`status = 'draft'`,
      archive: sql`status = 'archived'`,
      track_on: sql`track_stock = true`,
      track_off: sql`track_stock = false`,
      feature_on: sql`is_featured = true`,
      feature_off: sql`is_featured = false`,
    };
    if (!actions[action]) throw badRequest('Naməlum əməliyyat.');
    const rows = await sql`UPDATE products SET ${actions[action]}, updated_at = now(), updated_by = ${request.user.id} WHERE id IN ${sql(ids)} RETURNING id`;
    await audit(request, `bulk:${action}`, 'product', ids.join(','), `${rows.length} məhsul`);
    return { success: true, updated: rows.length };
  });

  app.put('/products/:id/variants/:variantId', async (request) => {
    const b = request.body || {};
    const [v] = await sql`
      UPDATE product_variants SET
        sku = ${required(str(b.sku, 80).toUpperCase(), 'SKU')},
        barcode = ${str(b.barcode, 60)},
        price_override = ${numOrNull(b.price_override)},
        is_active = ${b.is_active === undefined ? true : bool(b.is_active)}
      WHERE id = ${int(request.params.variantId)} AND product_id = ${int(request.params.id)}
      RETURNING *`;
    if (!v) throw notFound('Variant tapılmadı.');
    await audit(request, 'update', 'variant', v.id, v.sku);
    return v;
  });

  app.post('/products/:id/refresh-rating', async (request) => {
    await refreshProductRating(int(request.params.id));
    return { success: true };
  });

  app.post('/seo/analyze', async (request) => {
    const b = request.body || {};
    return analyzeSeo({
      title: str(b.title, 200),
      description: str(b.description, 400),
      slug: slugify(b.slug || ''),
      content: stripHtml(b.content || ''),
      focusKeyword: str(b.focus_keyword, 80),
      images: Array.isArray(b.images) ? b.images : [],
      kind: oneOf(b.kind, ['product', 'post', 'category'], 'product'),
    });
  });
}
