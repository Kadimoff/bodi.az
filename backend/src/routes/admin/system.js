import { sql } from '../../db.js';
import { requirePerm, audit, can, ROLES } from '../../lib/auth.js';
import { getSetting, saveSetting, DEFAULT_HOMEPAGE, DEFAULT_SEO, DEFAULT_STORE } from '../../lib/settings.js';
import { hashPassword, validatePasswordStrength } from '../../lib/password.js';
import { analyzeSeo } from '../../lib/seo.js';
import { ORDER_STATUSES } from '../../lib/orders.js';
import { badRequest, forbidden, notFound, conflict } from '../../lib/errors.js';
import { str, bool, int, num, oneOf, required, pageParams, cleanDeep, strList } from '../../lib/validate.js';

const SETTING_PERMS = { store: 'settings', seo: 'seo', homepage: 'content' };
const SETTING_DEFAULTS = { store: DEFAULT_STORE, seo: DEFAULT_SEO, homepage: DEFAULT_HOMEPAGE };

function cleanStore(b) {
  return {
    store_name: str(b.store_name, 80),
    whatsapp: String(b.whatsapp || '').replace(/\D/g, '').slice(0, 15),
    phone: str(b.phone, 40),
    email: str(b.email, 120),
    currency: 'AZN',
    currency_symbol: '₼',
    shipping_fee: Math.max(0, num(b.shipping_fee, 5)),
    free_shipping_threshold: Math.max(0, num(b.free_shipping_threshold, 50)),
    review_auto_approve: bool(b.review_auto_approve),
    low_stock_threshold: Math.max(0, int(b.low_stock_threshold, 3)),
    sizes: strList(b.sizes, 40),
    return_days: Math.max(0, int(b.return_days, 14)),
  };
}

export default async function systemRoutes(app) {
  // ---------------------------------------------------------------- settings
  app.get('/settings/:key', async (request) => {
    const key = request.params.key;
    if (!SETTING_PERMS[key]) throw notFound('Tənzimləmə tapılmadı.');
    if (!can(request.user, SETTING_PERMS[key])) throw forbidden();
    return { value: await getSetting(key), defaults: SETTING_DEFAULTS[key] };
  });

  app.put('/settings/:key', async (request) => {
    const key = request.params.key;
    if (!SETTING_PERMS[key]) throw notFound('Tənzimləmə tapılmadı.');
    if (!can(request.user, SETTING_PERMS[key])) throw forbidden();
    const body = request.body?.value ?? request.body ?? {};
    const value = key === 'store' ? cleanStore(body) : cleanDeep(body);
    const saved = await saveSetting(key, value, request.user.id);
    await audit(request, 'update', 'settings', key, `${key} tənzimləmələri yeniləndi`);
    return { value: saved };
  });

  app.post('/settings/:key/reset', async (request) => {
    const key = request.params.key;
    if (!SETTING_PERMS[key]) throw notFound('Tənzimləmə tapılmadı.');
    if (!can(request.user, SETTING_PERMS[key])) throw forbidden();
    await sql`DELETE FROM settings WHERE key = ${key}`;
    const value = await saveSetting(key, SETTING_DEFAULTS[key], request.user.id);
    await audit(request, 'reset', 'settings', key, `${key} standart dəyərlərə qaytarıldı`);
    return { value };
  });

  // Sidebar counters
  app.get('/badges', async (request) => {
    const u = request.user;
    const [r] = await sql`
      SELECT (SELECT COUNT(*) FROM orders WHERE status = 'new')::int AS orders,
             (SELECT COUNT(*) FROM reviews WHERE status = 'pending')::int AS reviews,
             (SELECT COUNT(*) FROM contact_messages WHERE status = 'new')::int AS messages`;
    return {
      orders: can(u, 'orders') ? r.orders : 0,
      reviews: can(u, 'reviews') ? r.reviews : 0,
      messages: can(u, 'messages') ? r.messages : 0,
    };
  });

  // --------------------------------------------------------------- dashboard
  app.get('/dashboard',{ onRequest: requirePerm('dashboard') }, async (request) => {
    const user = request.user;
    const out = { user: { full_name: user.full_name, username: user.username } };

    if (can(user, 'orders')) {
      const [o] = await sql`
        SELECT
          COUNT(*) FILTER (WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Baku') AT TIME ZONE 'Asia/Baku')::int AS today_count,
          COALESCE(SUM(total) FILTER (WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Baku') AT TIME ZONE 'Asia/Baku' AND status NOT IN ('cancelled', 'returned')), 0) AS today_revenue,
          COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days')::int AS month_count,
          COALESCE(SUM(total) FILTER (WHERE created_at >= now() - interval '30 days' AND status NOT IN ('cancelled', 'returned')), 0) AS month_revenue,
          COUNT(*) FILTER (WHERE status IN ('new', 'processing'))::int AS open_count,
          COUNT(*) FILTER (WHERE status = 'new')::int AS new_count
        FROM orders`;
      const daily = await sql`
        SELECT to_char(d, 'YYYY-MM-DD') AS day,
               COALESCE(SUM(o.total) FILTER (WHERE o.status NOT IN ('cancelled', 'returned')), 0) AS revenue,
               COUNT(o.id)::int AS orders
        FROM generate_series((now() AT TIME ZONE 'Asia/Baku')::date - 13, (now() AT TIME ZONE 'Asia/Baku')::date, '1 day') d
        LEFT JOIN orders o ON (o.created_at AT TIME ZONE 'Asia/Baku')::date = d
        GROUP BY d ORDER BY d`;
      const recent = await sql`
        SELECT id, status, first_name, last_name, phone, total, created_at FROM orders ORDER BY created_at DESC LIMIT 8`;
      const top = await sql`
        SELECT oi.product_id, oi.name, SUM(oi.quantity)::int AS qty, SUM(oi.total) AS revenue
        FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.created_at >= now() - interval '30 days' AND o.status NOT IN ('cancelled', 'returned')
        GROUP BY oi.product_id, oi.name ORDER BY qty DESC LIMIT 5`;
      out.orders = {
        ...o,
        daily,
        top,
        recent: recent.map((r) => ({ ...r, customer: `${r.first_name} ${r.last_name}`.trim(), status_label: ORDER_STATUSES[r.status]?.label })),
      };
    }

    if (can(user, 'inventory')) {
      out.lowStock = await sql`
        SELECT v.id, v.sku, v.color, v.size, p.id AS product_id, p.name AS product_name, col.name AS color_name,
               COALESCE(SUM(sl.quantity), 0)::int AS quantity, COALESCE(SUM(sl.min_quantity), 0)::int AS min_quantity
        FROM product_variants v JOIN products p ON p.id = v.product_id
        LEFT JOIN colors col ON col.slug = v.color
        LEFT JOIN stock_levels sl ON sl.variant_id = v.id
        LEFT JOIN warehouses w ON w.id = sl.warehouse_id
        WHERE v.is_active AND p.track_stock AND p.status = 'published' AND (w.id IS NULL OR w.is_active)
        GROUP BY v.id, p.id, col.name
        HAVING COALESCE(SUM(sl.quantity), 0) <= GREATEST(COALESCE(SUM(sl.min_quantity), 0), 0) + 3
        ORDER BY COALESCE(SUM(sl.quantity), 0) ASC LIMIT 10`;
      const [{ untracked }] = await sql`SELECT COUNT(*)::int AS untracked FROM products WHERE status = 'published' AND NOT track_stock`;
      out.untrackedProducts = untracked;
    }

    if (can(user, 'catalog')) {
      const [c] = await sql`
        SELECT COUNT(*) FILTER (WHERE status = 'published')::int AS published,
               COUNT(*) FILTER (WHERE status = 'draft')::int AS drafts,
               COUNT(*)::int AS total
        FROM products`;
      out.catalog = c;
    }
    if (can(user, 'reviews')) {
      const [r] = await sql`SELECT COUNT(*) FILTER (WHERE status = 'pending')::int AS pending, COUNT(*)::int AS total FROM reviews`;
      out.reviews = r;
    }
    if (can(user, 'messages')) {
      const [m] = await sql`SELECT COUNT(*) FILTER (WHERE status = 'new')::int AS unread FROM contact_messages`;
      out.messages = m;
    }
    if (can(user, 'seo')) {
      const products = await sql`
        SELECT p.id, p.name, p.slug, p.seo, p.description, p.short_description,
               (SELECT COUNT(*)::int FROM product_images WHERE product_id = p.id) AS images,
               (SELECT COUNT(*)::int FROM product_images pi JOIN media m ON m.id = pi.media_id WHERE pi.product_id = p.id AND m.alt = '') AS no_alt
        FROM products p WHERE p.status = 'published'`;
      const scored = products.map((p) => ({
        id: p.id,
        name: p.name,
        score: analyzeSeo({
          title: p.seo?.title || p.name,
          description: p.seo?.description || p.short_description,
          slug: p.slug,
          content: p.description || p.short_description,
          focusKeyword: p.seo?.focus_keyword,
          images: Array.from({ length: p.images }, (_, i) => ({ alt: i < p.no_alt ? '' : 'ok' })),
        }).score,
      }));
      out.seo = {
        average: scored.length ? Math.round(scored.reduce((s, p) => s + p.score, 0) / scored.length) : 0,
        weakest: scored.sort((a, b) => a.score - b.score).slice(0, 5),
      };
      const [{ noalt }] = await sql`SELECT COUNT(*)::int AS noalt FROM media WHERE kind = 'image' AND alt = ''`;
      out.seo.images_without_alt = noalt;
    }
    return out;
  });

  // ------------------------------------------------------------------ users
  app.register(async (r) => {
    r.addHook('onRequest', requirePerm('users'));

    const present = (u) => ({
      id: u.id, username: u.username, full_name: u.full_name, email: u.email, role: u.role,
      role_label: ROLES[u.role]?.label, is_active: u.is_active, last_login_at: u.last_login_at, created_at: u.created_at,
    });

    r.get('/users/roles', async () => Object.entries(ROLES).map(([key, v]) => ({ key, label: v.label, perms: v.perms })));

    r.get('/users', async () => (await sql`SELECT * FROM users ORDER BY role = 'root' DESC, created_at`).map(present));

    // Only root may create or edit root / admin accounts.
    function guardRole(actor, targetRole, existing) {
      if (actor.role === 'root') return;
      if (targetRole === 'root' || targetRole === 'admin') throw forbidden('Administrator hesabları yalnız root tərəfindən idarə oluna bilər.');
      if (existing && (existing.role === 'root' || existing.role === 'admin')) throw forbidden('Bu hesabı yalnız root dəyişə bilər.');
    }

    r.post('/users', async (request, reply) => {
      const b = request.body || {};
      const username = required(str(b.username, 40).toLowerCase(), 'İstifadəçi adı');
      if (!/^[a-z0-9._-]{3,40}$/.test(username)) throw badRequest('İstifadəçi adı 3–40 simvol: kiçik hərf, rəqəm, nöqtə, tire.');
      const role = oneOf(b.role, Object.keys(ROLES).filter((k) => k !== 'root'), 'editor');
      guardRole(request.user, role);
      const weak = validatePasswordStrength(b.password);
      if (weak) throw badRequest(weak);
      const [u] = await sql`
        INSERT INTO users (username, full_name, email, role, password_hash, is_active)
        VALUES (${username}, ${str(b.full_name, 120)}, ${str(b.email, 160)}, ${role}, ${await hashPassword(b.password)}, ${b.is_active === undefined ? true : bool(b.is_active)})
        RETURNING *`;
      await audit(request, 'create', 'user', u.id, `${u.username} (${role})`);
      reply.status(201);
      return present(u);
    });

    r.put('/users/:id', async (request) => {
      const id = int(request.params.id);
      const b = request.body || {};
      const [existing] = await sql`SELECT * FROM users WHERE id = ${id}`;
      if (!existing) throw notFound('İstifadəçi tapılmadı.');
      const isRoot = existing.role === 'root';
      const role = isRoot ? 'root' : oneOf(b.role, Object.keys(ROLES).filter((k) => k !== 'root'), existing.role);
      guardRole(request.user, role, existing);
      const active = isRoot ? true : b.is_active === undefined ? existing.is_active : bool(b.is_active);
      if (id === request.user.id && !active) throw badRequest('Öz hesabınızı deaktiv edə bilməzsiniz.');
      let hash = existing.password_hash;
      if (b.password) {
        const weak = validatePasswordStrength(b.password);
        if (weak) throw badRequest(weak);
        hash = await hashPassword(b.password);
      }
      const [u] = await sql`
        UPDATE users SET full_name = ${str(b.full_name, 120)}, email = ${str(b.email, 160)}, role = ${role},
          is_active = ${active}, password_hash = ${hash}, updated_at = now()
        WHERE id = ${id} RETURNING *`;
      if (b.password || !active) await sql`DELETE FROM sessions WHERE user_id = ${id} ${id === request.user.id ? sql`AND FALSE` : sql``}`;
      await audit(request, 'update', 'user', id, `${u.username}${b.password ? ' (şifrə dəyişdi)' : ''}`);
      return present(u);
    });

    r.delete('/users/:id', async (request) => {
      const id = int(request.params.id);
      const [u] = await sql`SELECT * FROM users WHERE id = ${id}`;
      if (!u) throw notFound('İstifadəçi tapılmadı.');
      if (u.role === 'root') throw conflict('Root istifadəçi silinə bilməz.');
      if (id === request.user.id) throw badRequest('Öz hesabınızı silə bilməzsiniz.');
      guardRole(request.user, u.role, u);
      await sql`DELETE FROM users WHERE id = ${id}`;
      await audit(request, 'delete', 'user', id, u.username);
      return { success: true };
    });
  });

  // ------------------------------------------------------------------ audit
  app.get('/audit', { onRequest: requirePerm('audit') }, async (request) => {
    const { page, perPage, offset } = pageParams(request.query, 50);
    const { entity, user_id: userId, q } = request.query;
    const conds = [sql`TRUE`];
    if (entity) conds.push(sql`a.entity = ${String(entity)}`);
    if (userId) conds.push(sql`a.user_id = ${int(userId)}`);
    if (q) conds.push(sql`a.summary ILIKE ${`%${String(q).slice(0, 80)}%`}`);
    const where = conds.reduce((a, c) => sql`${a} AND ${c}`);
    const [{ total }] = await sql`SELECT COUNT(*)::int AS total FROM audit_log a WHERE ${where}`;
    const items = await sql`
      SELECT a.*, u.username FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
      WHERE ${where} ORDER BY a.created_at DESC, a.id DESC LIMIT ${perPage} OFFSET ${offset}`;
    return { total, page, per_page: perPage, items };
  });
}
