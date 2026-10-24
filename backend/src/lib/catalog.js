import { sql } from '../db.js';
import { getSetting } from './settings.js';
import { presentMedia, pickFormat, srcset } from './media.js';
import { stripHtml, asciiKey } from './text.js';

// ---------------------------------------------------------------- colours

let colorCache = null;

export async function getColors() {
  if (!colorCache) colorCache = await sql`SELECT * FROM colors ORDER BY sort_order, name`;
  return colorCache;
}

export function clearColorCache() {
  colorCache = null;
}

function hashHue(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % 360;
}

// Resolves a stored colour token (slug, name or alias) to the storefront colour model.
export function resolveColor(token, colors) {
  const key = asciiKey(token);
  const c = colors.find((x) => x.slug === token || asciiKey(x.slug) === key || asciiKey(x.name) === key || (x.aliases || []).includes(key));
  if (c) return { slug: c.slug, n: c.name, a: c.hex, b: c.hex_dark, label: c.label_color };
  const h = hashHue(String(token));
  return { slug: key || 'custom', n: String(token), a: `hsl(${h}, 45%, 93%)`, b: `hsl(${h}, 40%, 82%)`, label: `hsl(${h}, 45%, 35%)` };
}

// ---------------------------------------------------------------- stock

/**
 * Availability per variant for the given products, summed over active warehouses.
 * Returns Map(productId → [{ id, sku, color, size, quantity }]).
 */
export async function loadVariantStock(productIds) {
  if (!productIds.length) return new Map();
  const rows = await sql`
    SELECT v.id, v.product_id, v.sku, v.color, v.size, v.price_override,
           COALESCE(SUM(sl.quantity) FILTER (WHERE w.is_active), 0)::int AS quantity
    FROM product_variants v
    LEFT JOIN stock_levels sl ON sl.variant_id = v.id
    LEFT JOIN warehouses w ON w.id = sl.warehouse_id
    WHERE v.product_id IN ${sql(productIds)} AND v.is_active
    GROUP BY v.id
    ORDER BY v.id`;
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.product_id)) map.set(r.product_id, []);
    map.get(r.product_id).push(r);
  }
  return map;
}

// ---------------------------------------------------------------- products

/**
 * Loads products with category, images and stock, ready for presentProduct().
 * `where` is a postgres.js fragment (e.g. sql`p.status = 'published'`).
 */
export async function loadProducts(where = sql`TRUE`, { order = sql`p.sort_order, p.id`, limit = 500, offset = 0 } = {}) {
  const products = await sql`
    SELECT p.*, c.slug AS category_slug, c.name AS category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE ${where}
    ORDER BY ${order}
    LIMIT ${limit} OFFSET ${offset}`;
  if (!products.length) return [];
  const ids = products.map((p) => p.id);
  const images = await sql`
    SELECT pi.product_id, pi.position, pi.color, m.*
    FROM product_images pi JOIN media m ON m.id = pi.media_id
    WHERE pi.product_id IN ${sql(ids)}
    ORDER BY pi.product_id, pi.position, m.id`;
  const stock = await loadVariantStock(ids);
  const byProduct = new Map();
  for (const img of images) {
    if (!byProduct.has(img.product_id)) byProduct.set(img.product_id, []);
    byProduct.get(img.product_id).push(img);
  }
  for (const p of products) {
    p.images = byProduct.get(p.id) || [];
    p.variants = stock.get(p.id) || [];
  }
  return products;
}

export function computeAvailability(p, lowThreshold = 3) {
  const variants = (p.variants || []).map((v) => {
    const available = !p.track_stock || p.allow_backorder || v.quantity > 0;
    return {
      id: v.id,
      sku: v.sku,
      color: v.color,
      size: v.size,
      available,
      lowStock: p.track_stock && v.quantity > 0 && v.quantity <= lowThreshold,
      ...(v.price_override != null ? { price: v.price_override } : {}),
    };
  });
  const totalQty = (p.variants || []).reduce((s, v) => s + Math.max(0, v.quantity), 0);
  const inStock = !p.track_stock || p.allow_backorder || (variants.length ? variants.some((v) => v.available) : false);
  return { variants, inStock, totalQty };
}

/**
 * Storefront product model. Field names match what the frontend templates
 * (products.js / product.html / category.html) already consume.
 */
export function presentProduct(p, colors, store, { detailed = false } = {}) {
  const price = Number(p.price);
  const old = p.compare_at_price && Number(p.compare_at_price) > price ? Number(p.compare_at_price) : null;
  const productColors = (p.colors.length ? p.colors : ['cream']).map((c) => resolveColor(c, colors));
  const sizes = p.sizes.length ? p.sizes : store.sizes;
  const { variants, inStock } = computeAvailability(p, store.low_stock_threshold);

  const images = p.images || [];
  const cover = images[0];
  const fallback = `assets/images/products/${p.slug}.jpg`;
  const discount = old ? Math.round((1 - price / old) * 100) : 0;
  const badge = p.badge || (old ? `-${discount}%` : p.is_new ? 'Yeni' : '');

  const out = {
    id: p.id,
    slug: p.slug,
    name: p.name,
    cat: p.category_slug || 'bodi',
    categories: p.category_slug ? [{ id: p.category_id, slug: p.category_slug, name: p.category_name }] : [],
    material: p.material || '100% Orqanik Pambıq',
    price,
    old,
    color: productColors[0].slug,
    colors: productColors,
    sizes,
    image: cover ? pickFormat(cover, 'large') : fallback,
    cardImage: cover ? pickFormat(cover, 'small') : fallback,
    cardSrcset: cover ? srcset(cover) : '',
    images: images.length ? images.map((m) => pickFormat(m, 'large')) : [fallback],
    rating: p.rating_count ? Math.round(Number(p.rating_avg)) : 5,
    ratingAvg: Number(p.rating_avg) || 0,
    reviews: p.rating_count,
    badge,
    isNew: p.is_new,
    isFeatured: p.is_featured,
    desc: p.short_description || stripHtml(p.description),
    inStock,
    sku: p.sku || p.slug,
    variants,
    updatedAt: p.updated_at,
  };
  if (detailed) {
    out.descriptionHtml = p.description;
    out.attributes = p.attributes || [];
    out.gallery = images.map((m) => ({ ...presentMedia(m), color: m.color || '', srcset: srcset(m) }));
    out.seo = p.seo || {};
  }
  return out;
}

export async function getPublishedProducts(where = sql`TRUE`, opts) {
  const [colors, store] = await Promise.all([getColors(), getSetting('store')]);
  const rows = await loadProducts(sql`p.status = 'published' AND ${where}`, opts);
  return rows.map((p) => presentProduct(p, colors, store, { detailed: opts?.detailed }));
}

export async function findProductBySlug(slug, { publishedOnly = true } = {}) {
  const status = publishedOnly ? sql`p.status = 'published'` : sql`TRUE`;
  let [p] = await loadProducts(sql`${status} AND (p.slug = ${slug} OR p.sku = ${slug})`, { limit: 1 });
  let redirectedFrom = null;
  if (!p) {
    const [r] = await sql`SELECT entity_id FROM slug_redirects WHERE entity = 'product' AND old_slug = ${slug}`;
    if (r) {
      [p] = await loadProducts(sql`${status} AND p.id = ${r.entity_id}`, { limit: 1 });
      if (p) redirectedFrom = slug;
    }
  }
  if (!p && /^\d+$/.test(String(slug))) {
    [p] = await loadProducts(sql`${status} AND p.id = ${Number(slug)}`, { limit: 1 });
  }
  return p ? { product: p, redirectedFrom } : null;
}

// Recomputes the cached rating aggregate from approved reviews.
export async function refreshProductRating(productId, tx = sql) {
  await tx`
    UPDATE products SET
      rating_avg = COALESCE((SELECT AVG(rating) FROM reviews WHERE product_id = ${productId} AND status = 'approved'), 0),
      rating_count = (SELECT COUNT(*) FROM reviews WHERE product_id = ${productId} AND status = 'approved')
    WHERE id = ${productId}`;
}

export async function recordSlugChange(entity, entityId, oldSlug, newSlug, tx = sql) {
  if (!oldSlug || oldSlug === newSlug) return;
  await tx`DELETE FROM slug_redirects WHERE entity = ${entity} AND old_slug = ${newSlug}`;
  await tx`
    INSERT INTO slug_redirects (entity, old_slug, entity_id) VALUES (${entity}, ${oldSlug}, ${entityId})
    ON CONFLICT (entity, old_slug) DO UPDATE SET entity_id = EXCLUDED.entity_id`;
}
