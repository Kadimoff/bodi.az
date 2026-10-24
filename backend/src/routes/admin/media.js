import { sql } from '../../db.js';
import { requirePerm, audit } from '../../lib/auth.js';
import { storeUpload, deleteMediaFiles, presentMedia } from '../../lib/media.js';
import { conflict, notFound, badRequest } from '../../lib/errors.js';
import { str, int, pageParams } from '../../lib/validate.js';

async function usageOf(m) {
  const [u] = await sql`
    SELECT
      (SELECT COALESCE(json_agg(json_build_object('id', p.id, 'name', p.name)), '[]')
         FROM product_images pi JOIN products p ON p.id = pi.product_id WHERE pi.media_id = ${m.id}) AS products,
      (SELECT COALESCE(json_agg(json_build_object('id', c.id, 'name', c.name)), '[]') FROM categories c WHERE c.image_id = ${m.id}) AS categories,
      (SELECT COALESCE(json_agg(json_build_object('id', p.id, 'name', p.title)), '[]') FROM posts p WHERE p.cover_id = ${m.id}) AS posts,
      (SELECT COALESCE(json_agg(s.key), '[]') FROM settings s WHERE s.value::text LIKE ${`%${m.path.replace(/\.[^.]+$/, '')}%`}) AS settings`;
  return u;
}

export default async function mediaRoutes(app) {
  app.addHook('onRequest', requirePerm('media'));

  app.get('/media', async (request) => {
    const { q, kind, unused } = request.query;
    const { page, perPage, offset } = pageParams(request.query, 40);
    const conds = [sql`TRUE`];
    if (q) {
      const like = `%${String(q).slice(0, 80)}%`;
      conds.push(sql`(m.original_name ILIKE ${like} OR m.alt ILIKE ${like} OR m.title ILIKE ${like})`);
    }
    if (kind === 'image' || kind === 'video') conds.push(sql`m.kind = ${kind}`);
    if (unused === '1') {
      conds.push(sql`NOT EXISTS (SELECT 1 FROM product_images pi WHERE pi.media_id = m.id)
        AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.image_id = m.id)
        AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.cover_id = m.id)`);
    }
    if (request.query.no_alt === '1') conds.push(sql`m.kind = 'image' AND m.alt = ''`);
    const where = conds.reduce((a, c) => sql`${a} AND ${c}`);
    const [{ total }] = await sql`SELECT COUNT(*)::int AS total FROM media m WHERE ${where}`;
    const rows = await sql`SELECT m.* FROM media m WHERE ${where} ORDER BY m.created_at DESC, m.id DESC LIMIT ${perPage} OFFSET ${offset}`;
    return { total, page, per_page: perPage, items: rows.map((m) => ({ ...presentMedia(m), original_name: m.original_name, created_at: m.created_at })) };
  });

  app.post('/media', async (request, reply) => {
    if (!request.isMultipart()) throw badRequest('Fayl göndərilməyib.');
    const saved = [];
    const errors = [];
    for await (const part of request.parts()) {
      if (part.type !== 'file') continue;
      try {
        const buffer = await part.toBuffer();
        const m = await storeUpload({ buffer, originalName: part.filename || 'fayl', userId: request.user.id });
        saved.push({ ...presentMedia(m), original_name: m.original_name, created_at: m.created_at });
      } catch (err) {
        if (err.code === 'FST_REQ_FILE_TOO_LARGE') errors.push({ file: part.filename, message: 'Fayl çox böyükdür.' });
        else if (err.statusCode && err.statusCode < 500) errors.push({ file: part.filename, message: err.message });
        else throw err;
      }
    }
    if (saved.length) await audit(request, 'upload', 'media', saved.map((s) => s.id).join(','), `${saved.length} fayl`);
    if (!saved.length && errors.length) throw badRequest(errors.map((e) => `${e.file}: ${e.message}`).join(' '));
    reply.status(201);
    return { items: saved, errors };
  });

  app.get('/media/:id', async (request) => {
    const [m] = await sql`SELECT * FROM media WHERE id = ${int(request.params.id)}`;
    if (!m) throw notFound('Fayl tapılmadı.');
    return { ...presentMedia(m), original_name: m.original_name, created_at: m.created_at, usage: await usageOf(m) };
  });

  app.put('/media/:id', async (request) => {
    const b = request.body || {};
    const [m] = await sql`
      UPDATE media SET alt = ${str(b.alt, 250)}, title = ${str(b.title, 200)}, caption = ${str(b.caption, 500)}, updated_at = now()
      WHERE id = ${int(request.params.id)} RETURNING *`;
    if (!m) throw notFound('Fayl tapılmadı.');
    await audit(request, 'update', 'media', m.id, m.original_name);
    return presentMedia(m);
  });

  app.delete('/media/:id', async (request) => {
    const [m] = await sql`SELECT * FROM media WHERE id = ${int(request.params.id)}`;
    if (!m) throw notFound('Fayl tapılmadı.');
    const u = await usageOf(m);
    const used = [...u.products.map((p) => `məhsul “${p.name}”`), ...u.categories.map((c) => `kateqoriya “${c.name}”`), ...u.posts.map((p) => `yazı “${p.name}”`), ...u.settings.map((s) => `${s} tənzimləmələri`)];
    if (used.length && request.query.force !== '1') {
      throw conflict(`Bu fayl istifadə olunur: ${used.slice(0, 5).join(', ')}${used.length > 5 ? '…' : ''}.`, { usage: u });
    }
    await sql`DELETE FROM media WHERE id = ${m.id}`;
    await deleteMediaFiles(m);
    await audit(request, 'delete', 'media', m.id, m.original_name);
    return { success: true };
  });
}
