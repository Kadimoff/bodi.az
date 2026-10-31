import { sql } from '../../db.js';
import { getSetting } from '../../lib/settings.js';
import { cleanText } from '../../lib/html.js';
import { refreshProductRating } from '../../lib/catalog.js';
import { pickFormat, mediaUrl, storeReviewImage, deleteReviewImageFiles, REVIEW_PHOTO_MAX, REVIEW_PHOTO_MAX_BYTES } from '../../lib/media.js';
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
    images: (r.images || []).map((i) => ({ thumb: mediaUrl(i.thumb), full: mediaUrl(i.full), width: i.w, height: i.h })),
    date: formatDateAz(r.created_at),
    datePublished: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Baku' }).format(new Date(r.created_at)),
  };
}

export async function loadReviews(where, limit = 50) {
  return sql`
    SELECT r.*, p.name AS product_name, p.slug AS product_slug, m.path AS m_path, m.formats AS m_formats,
      COALESCE((SELECT json_agg(json_build_object('thumb', ri.thumb, 'full', ri.full_path, 'w', ri.width, 'h', ri.height) ORDER BY ri.position, ri.id)
                FROM review_images ri WHERE ri.review_id = r.id), '[]'::json) AS images
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

  const reviewBody = {
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
  };

  // Shared by the JSON endpoint and the multipart (with photos) endpoint.
  async function createReview(request, reply, b, photos = []) {
    if (b.website) return { success: true, message: 'Təşəkkür edirik!' }; // bot
    const author = cleanText(b.author, 80);
    const content = cleanText(b.content, 2000);
    const city = cleanText(b.city || 'Bakı', 60) || 'Bakı';
    const rating = Math.min(5, Math.max(1, parseInt(b.rating, 10) || 5));
    if (!author || content.length < 3) throw badRequest('Zəhmət olmasa adınızı və rəyinizi qeyd edin.');

    const productId = await resolveProductId(b.product_id);
    if (!productId) throw notFound('Rəy yazmaq istədiyiniz məhsul tapılmadı.');

    // Process every photo before anything is stored, so a bad file rejects the whole review cleanly.
    const stored = [];
    try {
      for (const buf of photos) stored.push(await storeReviewImage(buf));
    } catch (err) {
      await deleteReviewImageFiles(stored.map((x) => ({ full_path: x.full, thumb: x.thumb })));
      throw err;
    }

    const store = await getSetting('store');
    // Customer photos are always moderated, even when text reviews are auto-approved.
    const status = store.review_auto_approve && !stored.length ? 'approved' : 'pending';
    const row = await sql.begin(async (tx) => {
      const [r] = await tx`
        INSERT INTO reviews (product_id, author, city, rating, content, status, ip)
        VALUES (${productId}, ${author}, ${city}, ${rating}, ${content}, ${status}, ${request.ip || ''})
        RETURNING id`;
      for (const [i, img] of stored.entries()) {
        await tx`INSERT INTO review_images (review_id, thumb, full_path, width, height, position)
                 VALUES (${r.id}, ${img.thumb}, ${img.full}, ${img.width}, ${img.height}, ${i})`;
      }
      return r;
    });
    if (status === 'approved') await refreshProductRating(productId);

    const [full] = await loadReviews(sql`r.id = ${row.id}`, 1);
    reply.status(201);
    return status === 'approved'
      ? { success: true, comment_id: row.id, message: 'Rəyiniz uğurla qeydə alındı və dərc edildi! Təşəkkür edirik.', review: presentReview(full) }
      : { success: true, comment_id: row.id, message: 'Rəyiniz qəbul edildi və moderasiyadan sonra dərc olunacaq. Təşəkkür edirik!', review: null, pending: true, photos: stored.length };
  }

  app.post('/reviews', {
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
    schema: { body: reviewBody },
  }, async (request, reply) => createReview(request, reply, request.body));

  // Same review, sent as multipart/form-data with up to 4 photos (field name "photos").
  app.post('/reviews/upload', {
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
  }, async (request, reply) => {
    if (!request.isMultipart()) throw badRequest('Form multipart/form-data olmalıdır.');
    const fields = {};
    const photos = [];
    try {
      for await (const part of request.parts({ limits: { fileSize: REVIEW_PHOTO_MAX_BYTES, files: REVIEW_PHOTO_MAX, fields: 12, fieldSize: 4000 } })) {
        if (part.type === 'file') {
          const buf = await part.toBuffer();
          if (buf.length) photos.push(buf);
        } else if (Object.hasOwn(reviewBody.properties, part.fieldname)) {
          fields[part.fieldname] = String(part.value ?? '');
        }
      }
    } catch (err) {
      if (err.code === 'FST_REQ_FILE_TOO_LARGE') throw badRequest('Hər şəkil ən çox 8 MB ola bilər.');
      if (err.code === 'FST_FILES_LIMIT') throw badRequest(`Ən çox ${REVIEW_PHOTO_MAX} şəkil əlavə edə bilərsiniz.`);
      if (err.code === 'FST_PARTS_LIMIT' || err.code === 'FST_FIELDS_LIMIT') throw badRequest('Form düzgün deyil.');
      throw err;
    }
    for (const [k, def] of Object.entries(reviewBody.properties)) {
      if (def.maxLength && fields[k] && fields[k].length > def.maxLength) throw badRequest('Mətn çox uzundur.');
    }
    return createReview(request, reply, fields, photos);
  });
}
