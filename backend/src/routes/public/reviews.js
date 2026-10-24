import { sql } from '../../db.js';
import { getSetting } from '../../lib/settings.js';
import { cleanText } from '../../lib/html.js';
import { refreshProductRating } from '../../lib/catalog.js';
import { pickFormat } from '../../lib/media.js';
import { formatDateAz } from '../../lib/text.js';
import { badRequest, notFound } from '../../lib/errors.js';

export function presentReview(r) {
  return {
    id: r.id,
    productId: r.product_id,
    productName: r.product_name || 'Bodi.az Məhsulu',
    productSlug: r.product_slug || '',
    productImage: r.m_path ? pickFormat({ path: r.m_path, formats: r.m_formats }, 'small') : (r.product_slug ? `assets/images/products/${r.product_slug}.jpg` : ''),
    author: r.author,
    city: r.city || 'Bakı',
    rating: r.rating,
    quote: r.content,
    reply: r.reply || '',
    verified: r.is_verified,
    date: formatDateAz(r.created_at),
    datePublished: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Baku' }).format(new Date(r.created_at)),
  };
}

export async function loadReviews(where, limit = 50) {
  return sql`
    SELECT r.*, p.name AS product_name, p.slug AS product_slug, m.path AS m_path, m.formats AS m_formats
    FROM reviews r
    JOIN products p ON p.id = r.product_id
    LEFT JOIN LATERAL (
      SELECT m.path, m.formats FROM product_images pi JOIN media m ON m.id = pi.media_id
      WHERE pi.product_id = p.id ORDER BY pi.position LIMIT 1
    ) m ON TRUE
    WHERE ${where}
    ORDER BY r.created_at DESC
    LIMIT ${limit}`;
}

async function resolveProductId(param) {
  if (param === undefined || param === null || param === '') return null;
  const s = String(param);
  const [p] = /^\d+$/.test(s)
    ? await sql`SELECT id FROM products WHERE id = ${Number(s)} AND status = 'published'`
    : await sql`
        SELECT id FROM products WHERE (slug = ${s} OR sku = ${s}) AND status = 'published'
        UNION ALL
        SELECT entity_id FROM slug_redirects WHERE entity = 'product' AND old_slug = ${s}
        LIMIT 1`;
  return p ? p.id : 0;
}

export default async function reviewRoutes(app) {
  app.get('/reviews', async (request, reply) => {
    const limit = Math.min(Math.max(Number(request.query.limit) || 50, 1), 100);
    const productId = await resolveProductId(request.query.product_id ?? request.query.product);
    if (productId === 0) return [];
    const where = productId
      ? sql`r.status = 'approved' AND p.status = 'published' AND r.product_id = ${productId}`
      : sql`r.status = 'approved' AND p.status = 'published'`;
    reply.header('Cache-Control', 'public, max-age=30');
    return (await loadReviews(where, limit)).map(presentReview);
  });

  app.post('/reviews', {
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
    schema: {
      body: {
        type: 'object',
        required: ['author', 'content'],
        properties: {
          product_id: { type: ['string', 'integer'] },
          author: { type: 'string', maxLength: 80 },
          city: { type: 'string', maxLength: 60 },
          rating: { type: ['integer', 'string'] },
          content: { type: 'string', maxLength: 2000 },
          website: { type: 'string' }, // honeypot
        },
      },
    },
  }, async (request, reply) => {
    const b = request.body;
    if (b.website) return { success: true, message: 'Təşəkkür edirik!' }; // bot
    const author = cleanText(b.author, 80);
    const content = cleanText(b.content, 2000);
    const city = cleanText(b.city || 'Bakı', 60) || 'Bakı';
    const rating = Math.min(5, Math.max(1, parseInt(b.rating, 10) || 5));
    if (!author || content.length < 3) throw badRequest('Zəhmət olmasa adınızı və rəyinizi qeyd edin.');

    const productId = await resolveProductId(b.product_id);
    if (!productId) throw notFound('Rəy yazmaq istədiyiniz məhsul tapılmadı.');

    const store = await getSetting('store');
    const status = store.review_auto_approve ? 'approved' : 'pending';
    const [row] = await sql`
      INSERT INTO reviews (product_id, author, city, rating, content, status, ip)
      VALUES (${productId}, ${author}, ${city}, ${rating}, ${content}, ${status}, ${request.ip || ''})
      RETURNING id`;
    if (status === 'approved') await refreshProductRating(productId);

    const [full] = await loadReviews(sql`r.id = ${row.id}`, 1);
    reply.status(201);
    return status === 'approved'
      ? { success: true, comment_id: row.id, message: 'Rəyiniz uğurla qeydə alındı və dərc edildi! Təşəkkür edirik.', review: presentReview(full) }
      : { success: true, comment_id: row.id, message: 'Rəyiniz qəbul edildi və moderasiyadan sonra dərc olunacaq. Təşəkkür edirik!', review: null, pending: true };
  });
}
