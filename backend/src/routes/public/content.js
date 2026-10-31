import { sql } from '../../db.js';
import { getSetting } from '../../lib/settings.js';
import { getColors, getPublishedProducts, findProductBySlug, presentProduct } from '../../lib/catalog.js';
import { pickFormat } from '../../lib/media.js';
import { cleanText } from '../../lib/html.js';
import { homeSeo, productSeo, categorySeo, postSeo, staticPageSeo } from '../../lib/seo.js';
import { formatDateAzShort, truncate, stripHtml } from '../../lib/text.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { loadReviews, presentReview } from './reviews.js';

export function presentPost(p) {
  const cover = p.cover_path ? { path: p.cover_path, formats: p.cover_formats } : null;
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    cat: p.category || 'Geyim',
    tags: p.tags,
    excerpt: p.excerpt || truncate(stripHtml(p.content), 180),
    content: p.content,
    date: formatDateAzShort(p.published_at || p.created_at),
    image: cover ? pickFormat(cover, 'large') : '',
    cardImage: cover ? pickFormat(cover, 'medium') : '',
    imageAlt: p.cover_alt || p.title,
    read: p.reading_minutes || 3,
    publishedAt: new Date(p.published_at || p.created_at).toISOString(),
    updatedAt: new Date(p.updated_at).toISOString(),
    seo: p.seo || {},
  };
}

export async function loadPosts(where = sql`TRUE`, limit = 100) {
  return sql`
    SELECT p.*, m.path AS cover_path, m.formats AS cover_formats, m.alt AS cover_alt
    FROM posts p LEFT JOIN media m ON m.id = p.cover_id
    WHERE p.status = 'published' AND (p.published_at IS NULL OR p.published_at <= now()) AND ${where}
    ORDER BY p.published_at DESC NULLS LAST, p.id DESC
    LIMIT ${limit}`;
}

export async function loadCategoryForSeo(slug) {
  let [c] = await sql`
    SELECT c.*, m.path AS m_path, m.formats AS m_formats FROM categories c
    LEFT JOIN media m ON m.id = c.image_id WHERE c.slug = ${slug} AND c.is_active`;
  if (!c) {
    // A renamed category keeps working under its old address (301 to the new slug).
    [c] = await sql`
      SELECT c.*, m.path AS m_path, m.formats AS m_formats FROM slug_redirects r
      JOIN categories c ON c.id = r.entity_id AND c.is_active
      LEFT JOIN media m ON m.id = c.image_id
      WHERE r.entity = 'category' AND r.old_slug = ${slug}`;
    if (c) c.redirectedFrom = slug;
  }
  if (!c) return null;
  c.image = c.m_path ? pickFormat({ path: c.m_path, formats: c.m_formats }, 'large') : '';
  return c;
}

// Shared by the JSON endpoint and the server-side <head> renderer.
export async function seoFor(type, slug) {
  const g = await getSetting('seo');
  if (type === 'product' && slug) {
    const found = await findProductBySlug(slug);
    if (!found) return null;
    const [colors, store] = await Promise.all([getColors(), getSetting('store')]);
    const product = presentProduct(found.product, colors, store, { detailed: true });
    const reviews = (await loadReviews(sql`r.status = 'approved' AND r.product_id = ${product.id}`, 5)).map(presentReview);
    return { seo: productSeo(product, reviews, g, store), entity: product, redirectedFrom: found.redirectedFrom };
  }
  if (type === 'category' && slug) {
    const category = await loadCategoryForSeo(slug);
    if (!category) return null;
    const products = await getPublishedProducts(sql`p.category_id = ${category.id}`, { limit: 60 });
    return { seo: categorySeo(category, products, g), entity: category, redirectedFrom: category.redirectedFrom || null };
  }
  if (type === 'post' && slug) {
    let [post] = await loadPosts(sql`p.slug = ${slug}`, 1);
    let redirectedFrom = null;
    if (!post) {
      const [r] = await sql`SELECT entity_id FROM slug_redirects WHERE entity = 'post' AND old_slug = ${slug}`;
      if (r) [post] = await loadPosts(sql`p.id = ${r.entity_id}`, 1);
      if (post) redirectedFrom = slug;
    }
    if (!post) return null;
    const p = presentPost(post);
    return { seo: postSeo(p, g), entity: p, redirectedFrom };
  }
  if (type === 'page' && slug) {
    const seo = staticPageSeo(slug, g);
    return seo ? { seo } : null;
  }
  return { seo: homeSeo(g) };
}

export default async function contentRoutes(app) {
  app.get('/posts', async (request, reply) => {
    const limit = Math.min(Number(request.query.limit) || 50, 100);
    reply.header('Cache-Control', 'public, max-age=60');
    return (await loadPosts(sql`TRUE`, limit)).map(presentPost);
  });

  app.get('/posts/:slug', async (request, reply) => {
    const found = await seoFor('post', request.params.slug);
    if (!found) throw notFound('Məqalə tapılmadı.');
    reply.header('Cache-Control', 'public, max-age=60');
    return { ...found.entity, seoPayload: found.seo, redirectedFrom: found.redirectedFrom };
  });

  app.get('/homepage', async (request, reply) => {
    const [hp, g] = await Promise.all([getSetting('homepage'), getSetting('seo')]);
    reply.header('Cache-Control', 'public, max-age=60');
    return { success: true, data: { ...hp, seo: homeSeo(g), timestamp: Math.floor(Date.now() / 1000) } };
  });

  app.get('/seo', async (request, reply) => {
    const type = String(request.query.type || 'home');
    const slug = String(request.query.slug || '');
    const found = await seoFor(type, slug);
    if (!found) throw notFound('Səhifə tapılmadı.');
    reply.header('Cache-Control', 'public, max-age=60');
    return found.seo;
  });

  app.post('/contact', {
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', maxLength: 100 },
          phone: { type: 'string', maxLength: 40 },
          email: { type: 'string', maxLength: 120 },
          message: { type: 'string', maxLength: 4000 },
          subject: { type: 'string', maxLength: 200 },
          website: { type: 'string' }, // honeypot
        },
      },
    },
  }, async (request, reply) => {
    const b = request.body || {};
    if (b.website) return { success: true, message: 'Təşəkkür edirik!' };
    const name = cleanText(b.name, 100);
    const phone = cleanText(b.phone, 40);
    const email = cleanText(b.email, 120);
    const subject = cleanText(b.subject, 200);
    const message = cleanText(b.message, 4000);
    if (!name || (!phone && !email)) throw badRequest('Ad və əlaqə vasitəsi (telefon və ya e-poçt) daxil edilməlidir.');
    await sql`
      INSERT INTO contact_messages (name, phone, email, message, ip)
      VALUES (${name}, ${phone}, ${email}, ${subject ? `[${subject}] ${message}` : message}, ${request.ip || ''})`;
    reply.status(201);
    return { success: true, message: 'Mesajınız uğurla göndərildi. Tezliklə sizinlə əlaqə saxlayacağıq!' };
  });
}
