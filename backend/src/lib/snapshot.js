// Portable data snapshot (catalog, content, settings, optionally orders) used
// for first-boot seeding and as a simple backup/restore format.
import fs from 'node:fs/promises';
import path from 'node:path';
import { sql } from '../db.js';
import { config } from '../config.js';
import { storeUpload } from './media.js';
import { refreshProductRating, clearColorCache } from './catalog.js';
import { saveSetting } from './settings.js';

export const FORMAT = 'bodi-snapshot';

const day = (d) => (d ? new Date(d).toISOString() : null);

async function copyMedia(media, imagesDir, used) {
  if (!media) return null;
  const file = path.basename(media.path);
  if (!used.has(file)) {
    await fs.copyFile(path.join(config.uploadsDir, media.path), path.join(imagesDir, file));
    used.add(file);
  }
  return { file, alt: media.alt, title: media.title, caption: media.caption };
}

export async function exportSnapshot(dir, { orders = false } = {}) {
  const imagesDir = path.join(dir, 'images');
  await fs.mkdir(imagesDir, { recursive: true });
  const used = new Set();
  const mediaById = new Map((await sql`SELECT * FROM media`).map((m) => [m.id, m]));

  const settings = Object.fromEntries((await sql`SELECT key, value FROM settings`).map((r) => [r.key, r.value]));
  const colors = await sql`SELECT slug, name, hex, hex_dark, label_color, aliases, sort_order FROM colors ORDER BY sort_order`;
  const warehouses = await sql`SELECT code, name, address, is_default, is_active FROM warehouses ORDER BY id`;
  const suppliers = await sql`SELECT name, contact_person, phone, email, address, tax_id, note, is_active FROM suppliers ORDER BY id`;

  const categories = [];
  for (const c of await sql`SELECT * FROM categories ORDER BY id`) {
    categories.push({
      id: c.id, slug: c.slug, name: c.name, description: c.description, parent_id: c.parent_id,
      sort_order: c.sort_order, is_active: c.is_active, seo: c.seo,
      image: await copyMedia(mediaById.get(c.image_id), imagesDir, used),
    });
  }

  const products = [];
  for (const p of await sql`SELECT * FROM products ORDER BY id`) {
    const images = [];
    for (const pi of await sql`SELECT * FROM product_images WHERE product_id = ${p.id} ORDER BY position`) {
      images.push({ ...(await copyMedia(mediaById.get(pi.media_id), imagesDir, used)), color: pi.color });
    }
    const variants = await sql`SELECT sku, color, size, barcode, price_override, is_active FROM product_variants WHERE product_id = ${p.id} ORDER BY id`;
    products.push({
      id: p.id, slug: p.slug, name: p.name, sku: p.sku, status: p.status, category_id: p.category_id,
      short_description: p.short_description, description: p.description, material: p.material,
      price: p.price, compare_at_price: p.compare_at_price, cost_price: p.cost_price, badge: p.badge,
      is_new: p.is_new, is_featured: p.is_featured, colors: p.colors, sizes: p.sizes, attributes: p.attributes,
      track_stock: p.track_stock, allow_backorder: p.allow_backorder, sales_count: p.sales_count, sort_order: p.sort_order,
      seo: p.seo, published_at: day(p.published_at), created_at: day(p.created_at), updated_at: day(p.updated_at),
      images, variants,
    });
  }

  const posts = [];
  for (const p of await sql`SELECT * FROM posts ORDER BY id`) {
    posts.push({
      id: p.id, slug: p.slug, title: p.title, excerpt: p.excerpt, content: p.content, category: p.category, tags: p.tags,
      status: p.status, reading_minutes: p.reading_minutes, seo: p.seo,
      published_at: day(p.published_at), created_at: day(p.created_at), updated_at: day(p.updated_at),
      cover: await copyMedia(mediaById.get(p.cover_id), imagesDir, used),
    });
  }

  const snapshot = {
    format: FORMAT,
    version: 1,
    exported_at: new Date().toISOString(),
    settings,
    colors,
    warehouses,
    suppliers,
    categories,
    products,
    slug_redirects: await sql`SELECT entity, old_slug, entity_id FROM slug_redirects`,
    posts,
    reviews: (await sql`SELECT id, product_id, author, city, rating, content, reply, status, is_verified, created_at FROM reviews ORDER BY id`)
      .map((r) => ({ ...r, created_at: day(r.created_at) })),
    coupons: (await sql`SELECT code, type, amount, min_subtotal, usage_limit, used_count, starts_at, expires_at, is_active, description FROM coupons ORDER BY id`)
      .map((c) => ({ ...c, starts_at: day(c.starts_at), expires_at: day(c.expires_at) })),
  };

  if (orders) {
    snapshot.orders = [];
    for (const o of await sql`SELECT * FROM orders ORDER BY id`) {
      const items = await sql`
        SELECT oi.product_id, v.sku AS variant_sku, oi.name, oi.sku, oi.size, oi.color, oi.color_slug, oi.quantity, oi.unit_price, oi.total
        FROM order_items oi LEFT JOIN product_variants v ON v.id = oi.variant_id WHERE oi.order_id = ${o.id} ORDER BY oi.id`;
      const history = (await sql`SELECT status, note, created_at FROM order_history WHERE order_id = ${o.id} ORDER BY id`)
        .map((h) => ({ ...h, created_at: day(h.created_at) }));
      const { warehouse_id: _w, stock_applied: _s, ...rest } = o;
      snapshot.orders.push({ ...rest, created_at: day(o.created_at), updated_at: day(o.updated_at), items, history });
    }
    snapshot.contact_messages = (await sql`SELECT name, phone, email, message, status, created_at FROM contact_messages ORDER BY id`)
      .map((m) => ({ ...m, created_at: day(m.created_at) }));
  }

  await fs.writeFile(path.join(dir, 'data.json'), JSON.stringify(snapshot, null, 2));
  return { products: products.length, posts: posts.length, images: used.size, orders: snapshot.orders?.length || 0 };
}

async function importMedia(ref, imagesDir, cache, log) {
  if (!ref?.file) return null;
  if (cache.has(ref.file)) return cache.get(ref.file);
  try {
    const buffer = await fs.readFile(path.join(imagesDir, path.basename(ref.file)));
    const m = await storeUpload({ buffer, originalName: ref.file.replace(/-[0-9a-f]{6}(\.\w+)$/, '$1'), alt: ref.alt || '', title: ref.title || '' });
    if (ref.caption) await sql`UPDATE media SET caption = ${ref.caption} WHERE id = ${m.id}`;
    cache.set(ref.file, m.id);
    return m.id;
  } catch (err) {
    log.warn(`[snapshot] şəkil idxal edilmədi (${ref.file}): ${err.message}`);
    return null;
  }
}

async function setSequences() {
  for (const table of ['products', 'categories', 'orders', 'reviews', 'posts', 'contact_messages', 'coupons', 'warehouses', 'suppliers', 'product_variants']) {
    await sql.unsafe(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM ${table}), 1))`);
  }
}

// Loads a snapshot into an empty database. Ids are preserved so storefront
// carts, links and order numbers stay valid.
export async function importSnapshot(dir, log = console) {
  const data = JSON.parse(await fs.readFile(path.join(dir, 'data.json'), 'utf8'));
  if (data.format !== FORMAT) throw new Error('Naməlum snapshot formatı.');
  const imagesDir = path.join(dir, 'images');
  const cache = new Map();

  for (const [key, value] of Object.entries(data.settings || {})) await saveSetting(key, value);

  if (data.colors?.length) {
    await sql`DELETE FROM colors`;
    for (const c of data.colors) await sql`INSERT INTO colors ${sql(c)}`;
    clearColorCache();
  }
  if (data.warehouses?.length) {
    await sql`DELETE FROM warehouses WHERE NOT EXISTS (SELECT 1 FROM stock_levels WHERE warehouse_id = warehouses.id)`;
    for (const w of data.warehouses) {
      await sql`INSERT INTO warehouses ${sql(w)} ON CONFLICT (code) DO NOTHING`;
    }
  }
  for (const s of data.suppliers || []) await sql`INSERT INTO suppliers ${sql(s)}`;

  for (const c of data.categories || []) {
    const imageId = await importMedia(c.image, imagesDir, cache, log);
    const { image, ...row } = c;
    await sql`INSERT INTO categories ${sql({ ...row, parent_id: null, seo: sql.json(row.seo || {}), image_id: imageId })}`;
  }
  for (const c of (data.categories || []).filter((x) => x.parent_id)) {
    await sql`UPDATE categories SET parent_id = ${c.parent_id} WHERE id = ${c.id}`;
  }

  for (const p of data.products || []) {
    const { images, variants, ...row } = p;
    await sql`INSERT INTO products ${sql({ ...row, seo: sql.json(row.seo || {}), attributes: sql.json(row.attributes || []) })}`;
    let position = 0;
    for (const img of images || []) {
      const mediaId = await importMedia(img, imagesDir, cache, log);
      if (mediaId) await sql`INSERT INTO product_images (product_id, media_id, position, color) VALUES (${p.id}, ${mediaId}, ${position++}, ${img.color || ''}) ON CONFLICT DO NOTHING`;
    }
    for (const v of variants || []) await sql`INSERT INTO product_variants ${sql({ ...v, product_id: p.id })}`;
  }

  for (const r of data.slug_redirects || []) await sql`INSERT INTO slug_redirects ${sql(r)} ON CONFLICT DO NOTHING`;

  for (const p of data.posts || []) {
    const coverId = await importMedia(p.cover, imagesDir, cache, log);
    const { cover, ...row } = p;
    await sql`INSERT INTO posts ${sql({ ...row, seo: sql.json(row.seo || {}), cover_id: coverId })}`;
  }

  for (const r of data.reviews || []) await sql`INSERT INTO reviews ${sql({ ...r, updated_at: r.created_at })}`;
  for (const p of data.products || []) await refreshProductRating(p.id);

  for (const c of data.coupons || []) await sql`INSERT INTO coupons ${sql(c)} ON CONFLICT (code) DO NOTHING`;

  for (const o of data.orders || []) {
    const { items, history, ...row } = o;
    await sql`INSERT INTO orders ${sql(row)}`;
    for (const it of items || []) {
      const { variant_sku: vsku, ...item } = it;
      const [v] = vsku ? await sql`SELECT id FROM product_variants WHERE sku = ${vsku}` : [];
      await sql`INSERT INTO order_items ${sql({ ...item, order_id: o.id, variant_id: v ? v.id : null })}`;
    }
    for (const h of history || []) await sql`INSERT INTO order_history ${sql({ ...h, order_id: o.id })}`;
  }
  for (const m of data.contact_messages || []) await sql`INSERT INTO contact_messages ${sql(m)}`;

  await setSequences();
  log.info(`[snapshot] idxal edildi: ${data.products?.length || 0} məhsul, ${data.posts?.length || 0} yazı, ${data.reviews?.length || 0} rəy, ${data.orders?.length || 0} sifariş`);
}
