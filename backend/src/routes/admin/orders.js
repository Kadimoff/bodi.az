import { sql } from '../../db.js';
import { requirePerm, audit } from '../../lib/auth.js';
import { ORDER_STATUSES, PAYMENT_METHODS, STOCK_HOLDING } from '../../lib/orders.js';
import { deductOrderStock, restoreOrderStock, MOVEMENT_LABELS } from '../../lib/inventory.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { str, int, oneOf, pageParams, dateOrNull } from '../../lib/validate.js';

const STATUS_KEYS = Object.keys(ORDER_STATUSES);

async function loadOrder(id) {
  const [o] = await sql`SELECT * FROM orders WHERE id = ${id}`;
  if (!o) throw notFound('Sifariş tapılmadı.');
  const items = await sql`
    SELECT oi.*, p.slug AS product_slug,
      (SELECT m.formats FROM product_images pi JOIN media m ON m.id = pi.media_id WHERE pi.product_id = oi.product_id ORDER BY pi.position LIMIT 1) AS formats
    FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ${id} ORDER BY oi.id`;
  const history = await sql`
    SELECT h.*, u.username FROM order_history h LEFT JOIN users u ON u.id = h.user_id
    WHERE h.order_id = ${id} ORDER BY h.created_at DESC, h.id DESC`;
  const movements = await sql`
    SELECT sm.*, w.name AS warehouse_name, v.sku FROM stock_movements sm
    JOIN warehouses w ON w.id = sm.warehouse_id JOIN product_variants v ON v.id = sm.variant_id
    WHERE sm.order_id = ${id} ORDER BY sm.created_at, sm.id`;
  return {
    ...o,
    status_label: ORDER_STATUSES[o.status]?.label,
    payment_label: PAYMENT_METHODS[o.payment_method] || o.payment_method,
    items: items.map((i) => ({ ...i, thumb: i.formats?.thumb ? `/uploads/${i.formats.thumb.path}` : '', formats: undefined })),
    history: history.map((h) => ({ ...h, label: ORDER_STATUSES[h.status]?.label || h.status })),
    movements: movements.map((m) => ({ ...m, type_label: MOVEMENT_LABELS[m.type] })),
  };
}

export default async function orderAdminRoutes(app) {
  app.addHook('onRequest', requirePerm('orders'));

  app.get('/orders/meta', async () => ({
    statuses: Object.entries(ORDER_STATUSES).map(([key, v]) => ({ key, ...v })),
    payment_methods: Object.entries(PAYMENT_METHODS).map(([key, label]) => ({ key, label })),
  }));

  app.get('/orders', async (request) => {
    const { q, status, from, to, payment } = request.query;
    const { page, perPage, offset } = pageParams(request.query);
    const conds = [sql`TRUE`];
    if (STATUS_KEYS.includes(status)) conds.push(sql`o.status = ${status}`);
    if (status === 'open') conds.push(sql`o.status IN ('new', 'processing', 'shipped')`);
    if (PAYMENT_METHODS[payment]) conds.push(sql`o.payment_method = ${payment}`);
    if (q) {
      const s = String(q).trim().slice(0, 80);
      const digits = s.replace(/\D/g, '');
      const like = `%${s}%`;
      conds.push(sql`(
        o.first_name ILIKE ${like} OR o.last_name ILIKE ${like} OR o.address ILIKE ${like}
        ${digits ? sql`OR o.id = ${Number(digits.slice(0, 9))} OR regexp_replace(o.phone, '\\D', '', 'g') LIKE ${`%${digits}%`}` : sql``}
      )`);
    }
    const fromD = dateOrNull(from);
    const toD = dateOrNull(to);
    if (fromD) conds.push(sql`o.created_at >= ${fromD}`);
    if (toD) conds.push(sql`o.created_at < ${new Date(toD.getTime() + 86400_000)}`);
    const where = conds.reduce((a, c) => sql`${a} AND ${c}`);
    const [{ total, revenue }] = await sql`
      SELECT COUNT(*)::int AS total, COALESCE(SUM(o.total) FILTER (WHERE o.status NOT IN ('cancelled', 'returned')), 0) AS revenue
      FROM orders o WHERE ${where}`;
    const rows = await sql`
      SELECT o.*, (SELECT COALESCE(SUM(quantity), 0)::int FROM order_items WHERE order_id = o.id) AS item_count
      FROM orders o WHERE ${where}
      ORDER BY o.created_at DESC, o.id DESC LIMIT ${perPage} OFFSET ${offset}`;
    const counts = await sql`SELECT status, COUNT(*)::int AS n FROM orders GROUP BY status`;
    return {
      total,
      revenue,
      page,
      per_page: perPage,
      counts: Object.fromEntries(counts.map((c) => [c.status, c.n])),
      items: rows.map((o) => ({
        id: o.id,
        status: o.status,
        status_label: ORDER_STATUSES[o.status]?.label,
        payment_status: o.payment_status,
        payment_method: o.payment_method,
        payment_label: PAYMENT_METHODS[o.payment_method] || o.payment_method,
        customer: `${o.first_name} ${o.last_name}`.trim(),
        phone: o.phone,
        city: o.city,
        total: o.total,
        item_count: o.item_count,
        coupon_code: o.coupon_code,
        created_at: o.created_at,
      })),
    };
  });

  app.get('/orders/:id', async (request) => loadOrder(int(request.params.id)));

  app.put('/orders/:id/status', async (request) => {
    const id = int(request.params.id);
    const status = request.body?.status;
    if (!STATUS_KEYS.includes(status)) throw badRequest('Yanlış status.');
    const note = str(request.body?.note, 500);
    await sql.begin(async (tx) => {
      const [o] = await tx`SELECT * FROM orders WHERE id = ${id} FOR UPDATE`;
      if (!o) throw notFound('Sifariş tapılmadı.');
      if (o.status === status) throw badRequest('Sifariş artıq bu statusdadır.');
      // Leaving a stock-holding state returns goods to the warehouse; re-entering takes them again.
      if (STOCK_HOLDING.has(o.status) && !STOCK_HOLDING.has(status) && o.stock_applied) {
        await restoreOrderStock(tx, id, request.user.id);
      } else if (!STOCK_HOLDING.has(o.status) && STOCK_HOLDING.has(status) && !o.stock_applied) {
        const items = await tx`
          SELECT oi.*, p.track_stock, p.allow_backorder FROM order_items oi
          LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ${id}`;
        await deductOrderStock(tx, id, items, request.user.id);
      }
      await tx`UPDATE orders SET status = ${status}, updated_at = now() WHERE id = ${id}`;
      if (status === 'completed' && o.payment_method === 'cod') {
        await tx`UPDATE orders SET payment_status = 'paid' WHERE id = ${id} AND payment_status = 'unpaid'`;
      }
      await tx`INSERT INTO order_history (order_id, status, note, user_id) VALUES (${id}, ${status}, ${note}, ${request.user.id})`;
    });
    await audit(request, 'status', 'order', id, `${ORDER_STATUSES[status].label}${note ? ` — ${note}` : ''}`);
    return loadOrder(id);
  });

  app.put('/orders/:id', async (request) => {
    const id = int(request.params.id);
    const b = request.body || {};
    const [o] = await sql`
      UPDATE orders SET
        first_name = ${str(b.first_name, 80)}, last_name = ${str(b.last_name, 80)}, phone = ${str(b.phone, 40)},
        email = ${str(b.email, 120)}, city = ${str(b.city, 80)}, address = ${str(b.address, 300)},
        admin_note = ${str(b.admin_note, 2000)},
        payment_status = ${oneOf(b.payment_status, ['unpaid', 'paid', 'refunded'], 'unpaid')},
        updated_at = now()
      WHERE id = ${id} RETURNING id`;
    if (!o) throw notFound('Sifariş tapılmadı.');
    await audit(request, 'update', 'order', id, 'Sifariş məlumatları yeniləndi');
    return loadOrder(id);
  });
}
