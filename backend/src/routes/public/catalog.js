import { sql } from '../../db.js';
import { getSetting } from '../../lib/settings.js';
import { getColors, getPublishedProducts, findProductBySlug, presentProduct } from '../../lib/catalog.js';
import { presentMedia, pickFormat } from '../../lib/media.js';
import { notFound } from '../../lib/errors.js';

const CACHE = 'public, max-age=60, stale-while-revalidate=300';

export default async function catalogRoutes(app) {
  app.get('/products', async (request, reply) => {
    const { category, q, ids, featured, limit } = request.query;
    const conds = [sql`TRUE`];
    if (category) {
      const cat = String(category);
      conds.push(sql`(c.slug = ${cat} OR c.id IN (SELECT entity_id FROM slug_redirects WHERE entity = 'category' AND old_slug = ${cat}))`);
    }
    if (featured === '1' || featured === 'true') conds.push(sql`p.is_featured`);
    if (ids) {
      const list = String(ids).split(',').map(Number).filter(Number.isInteger);
      if (list.length) conds.push(sql`p.id IN ${sql(list)}`);
    }
    if (q) {
      const like = `%${String(q).slice(0, 80)}%`;
      conds.push(sql`(p.name ILIKE ${like} OR p.material ILIKE ${like} OR p.sku ILIKE ${like})`);
    }
    const where = conds.reduce((acc, c) => sql`${acc} AND ${c}`);
    const products = await getPublishedProducts(where, { limit: Math.min(Number(limit) || 200, 500) });
    reply.header('Cache-Control', CACHE);
    return products;
  });

  app.get('/products/:slug', async (request, reply) => {
    const found = await findProductBySlug(request.params.slug);
    if (!found) throw notFound('Məhsul tapılmadı.');
    const [colors, store] = await Promise.all([getColors(), getSetting('store')]);
    const product = presentProduct(found.product, colors, store, { detailed: true });
    if (found.redirectedFrom) product.redirectedFrom = found.redirectedFrom;
    reply.header('Cache-Control', CACHE);
    return product;
  });

  app.get('/categories', async (request, reply) => {
    const rows = await sql`
      SELECT c.*, m.path AS m_path, m.formats AS m_formats,
             (SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.id AND p.status = 'published') AS count
      FROM categories c LEFT JOIN media m ON m.id = c.image_id
      WHERE c.is_active
      ORDER BY c.sort_order, c.name`;
    reply.header('Cache-Control', CACHE);
    return rows.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      parent: c.parent_id,
      count: c.count,
      image: c.m_path ? pickFormat({ path: c.m_path, formats: c.m_formats }, 'medium') : '',
    }));
  });

  app.get('/colors', async (request, reply) => {
    const colors = await getColors();
    reply.header('Cache-Control', CACHE);
    return colors.map((c) => ({ slug: c.slug, n: c.name, a: c.hex, b: c.hex_dark, label: c.label_color, aliases: c.aliases }));
  });

  app.get('/settings', async (request, reply) => {
    const s = await getSetting('store');
    reply.header('Cache-Control', CACHE);
    return {
      store_name: s.store_name,
      whatsapp: s.whatsapp,
      phone: s.phone,
      email: s.email,
      currency: s.currency,
      currency_symbol: s.currency_symbol,
      shipping_fee: s.shipping_fee,
      free_shipping_threshold: s.free_shipping_threshold,
      sizes: s.sizes,
      return_days: s.return_days,
    };
  });

  app.get('/media/:id', async (request) => {
    const [m] = await sql`SELECT * FROM media WHERE id = ${Number(request.params.id) || 0}`;
    if (!m) throw notFound('Fayl tapılmadı.');
    return presentMedia(m);
  });
}
