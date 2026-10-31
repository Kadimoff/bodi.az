import { sql } from '../../db.js';
import { requirePerm, audit } from '../../lib/auth.js';
import { cleanHtml } from '../../lib/html.js';
import { slugify, readingMinutes } from '../../lib/text.js';
import { presentMedia, mediaUrl, deleteReviewImageFiles } from '../../lib/media.js';
import { refreshProductRating, recordSlugChange } from '../../lib/catalog.js';
import { badRequest, notFound } from '../../lib/errors.js';
import {
  str, bool, int, num, intOrNull, oneOf, required, seoBlock, pageParams, dateOrNull, strList,
} from '../../lib/validate.js';

export default async function contentAdminRoutes(app) {
  // ---------------------------------------------------------------- reviews
  app.register(async (r) => {
    r.addHook('onRequest', requirePerm('reviews'));

    r.get('/reviews', async (request) => {
      const { q, status, product_id: productId, rating } = request.query;
      const { page, perPage, offset } = pageParams(request.query);
      const conds = [sql`TRUE`];
      if (['pending', 'approved', 'rejected'].includes(status)) conds.push(sql`r.status = ${status}`);
      if (productId) conds.push(sql`r.product_id = ${int(productId)}`);
      if (rating) conds.push(sql`r.rating = ${int(rating)}`);
      if (q) {
        const like = `%${String(q).slice(0, 80)}%`;
        conds.push(sql`(r.author ILIKE ${like} OR r.content ILIKE ${like} OR p.name ILIKE ${like})`);
      }
      const where = conds.reduce((a, c) => sql`${a} AND ${c}`);
      const [{ total }] = await sql`SELECT COUNT(*)::int AS total FROM reviews r JOIN products p ON p.id = r.product_id WHERE ${where}`;
      const items = await sql`
        SELECT r.*, p.name AS product_name, p.slug AS product_slug,
          COALESCE((SELECT json_agg(json_build_object('id', ri.id, 'thumb', ri.thumb, 'full', ri.full_path) ORDER BY ri.position, ri.id)
                    FROM review_images ri WHERE ri.review_id = r.id), '[]'::json) AS images
        FROM reviews r JOIN products p ON p.id = r.product_id
        WHERE ${where} ORDER BY r.created_at DESC LIMIT ${perPage} OFFSET ${offset}`;
      for (const it of items) it.images = (it.images || []).map((i) => ({ id: i.id, thumb: mediaUrl(i.thumb), full: mediaUrl(i.full) }));
      const counts = await sql`SELECT status, COUNT(*)::int AS n FROM reviews GROUP BY status`;
      return { total, page, per_page: perPage, items, counts: Object.fromEntries(counts.map((c) => [c.status, c.n])) };
    });

    r.put('/reviews/:id', async (request) => {
      const b = request.body || {};
      const [row] = await sql`
        UPDATE reviews SET
          status = ${oneOf(b.status, ['pending', 'approved', 'rejected'], 'pending')},
          author = ${required(str(b.author, 80), 'Müəllif')},
          city = ${str(b.city, 60)},
          rating = ${Math.min(5, Math.max(1, int(b.rating, 5)))},
          content = ${required(str(b.content, 2000), 'Rəy mətni')},
          reply = ${str(b.reply, 2000)},
          is_verified = ${bool(b.is_verified)},
          updated_at = now()
        WHERE id = ${int(request.params.id)} RETURNING *`;
      if (!row) throw notFound('Rəy tapılmadı.');
      await refreshProductRating(row.product_id);
      await audit(request, 'update', 'review', row.id, `${row.author} — ${row.status}`);
      return row;
    });

    r.post('/reviews/bulk', async (request) => {
      const ids = (request.body?.ids || []).map(Number).filter(Number.isInteger);
      const action = request.body?.action;
      if (!ids.length) throw badRequest('Heç bir rəy seçilməyib.');
      let rows;
      if (action === 'delete') {
        const files = await sql`SELECT thumb, full_path FROM review_images WHERE review_id IN ${sql(ids)}`;
        rows = await sql`DELETE FROM reviews WHERE id IN ${sql(ids)} RETURNING product_id`;
        await deleteReviewImageFiles(files);
      }
      else if (['approved', 'rejected', 'pending'].includes(action)) {
        rows = await sql`UPDATE reviews SET status = ${action}, updated_at = now() WHERE id IN ${sql(ids)} RETURNING product_id`;
      } else throw badRequest('Naməlum əməliyyat.');
      for (const pid of new Set(rows.map((x) => x.product_id))) await refreshProductRating(pid);
      await audit(request, `bulk:${action}`, 'review', ids.join(','), `${rows.length} rəy`);
      return { success: true, updated: rows.length };
    });

    r.delete('/reviews/:id', async (request) => {
      const files = await sql`SELECT thumb, full_path FROM review_images WHERE review_id = ${int(request.params.id)}`;
      const [row] = await sql`DELETE FROM reviews WHERE id = ${int(request.params.id)} RETURNING *`;
      if (!row) throw notFound('Rəy tapılmadı.');
      await deleteReviewImageFiles(files);
      await refreshProductRating(row.product_id);
      await audit(request, 'delete', 'review', row.id, row.author);
      return { success: true };
    });

    // Remove one customer photo (e.g. inappropriate) while keeping the review.
    r.delete('/reviews/:id/images/:imageId', async (request) => {
      const [img] = await sql`DELETE FROM review_images WHERE id = ${int(request.params.imageId)} AND review_id = ${int(request.params.id)} RETURNING thumb, full_path`;
      if (!img) throw notFound('Şəkil tapılmadı.');
      await deleteReviewImageFiles([img]);
      await audit(request, 'delete', 'review_image', request.params.imageId, `rəy #${request.params.id}`);
      return { success: true };
    });
  });

  // ------------------------------------------------------------------ posts
  app.register(async (r) => {
    r.addHook('onRequest', requirePerm('content'));

    r.get('/posts', async (request) => {
      const { q, status } = request.query;
      const { page, perPage, offset } = pageParams(request.query);
      const conds = [sql`TRUE`];
      if (['draft', 'published'].includes(status)) conds.push(sql`p.status = ${status}`);
      if (q) conds.push(sql`p.title ILIKE ${`%${String(q).slice(0, 80)}%`}`);
      const where = conds.reduce((a, c) => sql`${a} AND ${c}`);
      const [{ total }] = await sql`SELECT COUNT(*)::int AS total FROM posts p WHERE ${where}`;
      const items = await sql`
        SELECT p.id, p.slug, p.title, p.status, p.category, p.published_at, p.updated_at, p.seo, p.reading_minutes,
               m.formats->'thumb'->>'path' AS thumb_path
        FROM posts p LEFT JOIN media m ON m.id = p.cover_id
        WHERE ${where} ORDER BY COALESCE(p.published_at, p.created_at) DESC LIMIT ${perPage} OFFSET ${offset}`;
      return { total, page, per_page: perPage, items: items.map((i) => ({ ...i, thumb: i.thumb_path ? `/uploads/${i.thumb_path}` : '' })) };
    });

    r.get('/posts/:id', async (request) => {
      const [p] = await sql`SELECT * FROM posts WHERE id = ${int(request.params.id)}`;
      if (!p) throw notFound('Yazı tapılmadı.');
      const [cover] = p.cover_id ? await sql`SELECT * FROM media WHERE id = ${p.cover_id}` : [];
      return { ...p, cover: presentMedia(cover) };
    });

    function postInput(b) {
      const content = cleanHtml(b.content);
      return {
        title: required(str(b.title, 200), 'Başlıq'),
        excerpt: str(b.excerpt, 600),
        content,
        cover_id: intOrNull(b.cover_id),
        category: str(b.category, 60),
        tags: strList(b.tags, 40),
        status: oneOf(b.status, ['draft', 'published'], 'draft'),
        reading_minutes: readingMinutes(content),
        seo: seoBlock(b.seo),
        published_at: dateOrNull(b.published_at),
      };
    }

    async function uniquePostSlug(base, id = 0) {
      const root = slugify(base) || 'yazi';
      let slug = root;
      for (let i = 2; ; i++) {
        const [hit] = await sql`SELECT 1 FROM posts WHERE slug = ${slug} AND id <> ${id}`;
        if (!hit) return slug;
        slug = `${root}-${i}`;
      }
    }

    r.post('/posts', async (request, reply) => {
      const input = postInput(request.body || {});
      if (input.status === 'published' && !input.published_at) input.published_at = new Date();
      const slug = await uniquePostSlug(request.body.slug || input.title);
      const [p] = await sql`INSERT INTO posts ${sql({ ...input, seo: sql.json(input.seo), slug, author_id: request.user.id })} RETURNING *`;
      await audit(request, 'create', 'post', p.id, p.title);
      reply.status(201);
      return p;
    });

    r.put('/posts/:id', async (request) => {
      const id = int(request.params.id);
      const input = postInput(request.body || {});
      const [old] = await sql`SELECT * FROM posts WHERE id = ${id}`;
      if (!old) throw notFound('Yazı tapılmadı.');
      if (input.status === 'published' && !input.published_at) input.published_at = old.published_at || new Date();
      const slug = request.body.slug ? await uniquePostSlug(request.body.slug, id) : old.slug;
      const [p] = await sql`UPDATE posts SET ${sql({ ...input, seo: sql.json(input.seo), slug })}, updated_at = now() WHERE id = ${id} RETURNING *`;
      await recordSlugChange('post', id, old.slug, slug);
      await audit(request, 'update', 'post', id, p.title);
      return p;
    });

    r.delete('/posts/:id', async (request) => {
      const [p] = await sql`DELETE FROM posts WHERE id = ${int(request.params.id)} RETURNING id, title`;
      if (!p) throw notFound('Yazı tapılmadı.');
      await sql`DELETE FROM slug_redirects WHERE entity = 'post' AND entity_id = ${p.id}`;
      await audit(request, 'delete', 'post', p.id, p.title);
      return { success: true };
    });
  });

  // ---------------------------------------------------------------- coupons
  app.register(async (r) => {
    r.addHook('onRequest', requirePerm('coupons'));

    r.get('/coupons', async () => sql`SELECT * FROM coupons ORDER BY created_at DESC`);

    function couponInput(b) {
      const type = oneOf(b.type, ['percent', 'fixed'], 'percent');
      const amount = num(b.amount);
      if (amount <= 0) throw badRequest('Endirim məbləği 0-dan böyük olmalıdır.');
      if (type === 'percent' && amount > 100) throw badRequest('Faiz endirimi 100%-dən çox ola bilməz.');
      const code = str(b.code, 40).toUpperCase().replace(/[^A-Z0-9_-]/g, '');
      return {
        code: required(code, 'Promokod'),
        type,
        amount,
        min_subtotal: num(b.min_subtotal),
        usage_limit: intOrNull(b.usage_limit),
        starts_at: dateOrNull(b.starts_at),
        expires_at: dateOrNull(b.expires_at),
        is_active: b.is_active === undefined ? true : bool(b.is_active),
        description: str(b.description, 300),
      };
    }

    r.post('/coupons', async (request, reply) => {
      const [c] = await sql`INSERT INTO coupons ${sql(couponInput(request.body || {}))} RETURNING *`;
      await audit(request, 'create', 'coupon', c.id, c.code);
      reply.status(201);
      return c;
    });

    r.put('/coupons/:id', async (request) => {
      const [c] = await sql`UPDATE coupons SET ${sql(couponInput(request.body || {}))} WHERE id = ${int(request.params.id)} RETURNING *`;
      if (!c) throw notFound('Promokod tapılmadı.');
      await audit(request, 'update', 'coupon', c.id, c.code);
      return c;
    });

    r.delete('/coupons/:id', async (request) => {
      const [c] = await sql`DELETE FROM coupons WHERE id = ${int(request.params.id)} RETURNING id, code`;
      if (!c) throw notFound('Promokod tapılmadı.');
      await audit(request, 'delete', 'coupon', c.id, c.code);
      return { success: true };
    });
  });

  // --------------------------------------------------------------- messages
  app.register(async (r) => {
    r.addHook('onRequest', requirePerm('messages'));

    r.get('/messages', async (request) => {
      const { status, q } = request.query;
      const { page, perPage, offset } = pageParams(request.query);
      const conds = [sql`TRUE`];
      if (['new', 'read', 'archived'].includes(status)) conds.push(sql`status = ${status}`);
      if (q) {
        const like = `%${String(q).slice(0, 80)}%`;
        conds.push(sql`(name ILIKE ${like} OR message ILIKE ${like} OR phone ILIKE ${like} OR email ILIKE ${like})`);
      }
      const where = conds.reduce((a, c) => sql`${a} AND ${c}`);
      const [{ total }] = await sql`SELECT COUNT(*)::int AS total FROM contact_messages WHERE ${where}`;
      const items = await sql`SELECT * FROM contact_messages WHERE ${where} ORDER BY created_at DESC LIMIT ${perPage} OFFSET ${offset}`;
      return { total, page, per_page: perPage, items };
    });

    r.put('/messages/:id', async (request) => {
      const [m] = await sql`
        UPDATE contact_messages SET status = ${oneOf(request.body?.status, ['new', 'read', 'archived'], 'read')}
        WHERE id = ${int(request.params.id)} RETURNING *`;
      if (!m) throw notFound('Mesaj tapılmadı.');
      return m;
    });

    r.delete('/messages/:id', async (request) => {
      const [m] = await sql`DELETE FROM contact_messages WHERE id = ${int(request.params.id)} RETURNING id, name`;
      if (!m) throw notFound('Mesaj tapılmadı.');
      await audit(request, 'delete', 'message', m.id, m.name);
      return { success: true };
    });
  });
}

