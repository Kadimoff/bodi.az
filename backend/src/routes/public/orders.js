import { sql } from '../../db.js';
import { getSetting } from '../../lib/settings.js';
import { getColors, resolveColor } from '../../lib/catalog.js';
import { cleanText } from '../../lib/html.js';
import { planOrderStock, applyOrderStock } from '../../lib/inventory.js';
import {
  ORDER_STATUSES, PAYMENT_METHODS, findCoupon, evaluateCoupon, shippingFor, normalizePhone, maskName, maskAddress,
} from '../../lib/orders.js';
import { money, formatDateTimeAz } from '../../lib/text.js';
import { badRequest, notFound } from '../../lib/errors.js';

const checkoutSchema = {
  body: {
    type: 'object',
    required: ['billing', 'items'],
    properties: {
      billing: {
        type: 'object',
        properties: {
          first_name: { type: 'string', maxLength: 80 },
          last_name: { type: 'string', maxLength: 80 },
          phone: { type: 'string', maxLength: 40 },
          email: { type: 'string', maxLength: 120 },
          city: { type: 'string', maxLength: 80 },
          address_1: { type: 'string', maxLength: 300 },
          note: { type: 'string', maxLength: 1000 },
        },
      },
      items: {
        type: 'array',
        minItems: 1,
        maxItems: 50,
        items: {
          type: 'object',
          properties: {
            id: { type: ['integer', 'string', 'null'] },
            slug: { type: ['string', 'null'] },
            qty: { type: ['integer', 'string'] },
            size: { type: ['string', 'null'] },
            color: { type: ['string', 'null'] },
          },
        },
      },
      payment_method: { type: 'string', maxLength: 20 },
      coupon: { type: ['string', 'null'], maxLength: 40 },
    },
  },
};

/**
 * Resolves cart lines against the catalog: prices always come from the
 * database, never from the client.
 */
async function resolveCart(items) {
  const ids = [...new Set(items.map((i) => Number(i.id)).filter((n) => Number.isInteger(n) && n > 0))];
  const slugs = [...new Set(items.map((i) => i.slug).filter(Boolean).map(String))];
  const products = await sql`
    SELECT * FROM products
    WHERE status = 'published' AND (id IN ${sql(ids.length ? ids : [0])} OR slug IN ${sql(slugs.length ? slugs : [''])})`;
  const variants = products.length
    ? await sql`SELECT * FROM product_variants WHERE is_active AND product_id IN ${sql(products.map((p) => p.id))}`
    : [];
  const colors = await getColors();

  const lines = [];
  for (const item of items) {
    const p = products.find((x) => x.id === Number(item.id)) || products.find((x) => item.slug && x.slug === item.slug);
    if (!p) throw badRequest('Səbətdəki məhsullardan biri artıq satışda deyil. Səbəti yeniləyin.');
    const qty = Math.min(99, Math.max(1, parseInt(item.qty, 10) || 1));

    // Colour: accept slug or display name; default to the product's first colour.
    let colorSlug = '';
    if (p.colors.length) {
      const wanted = item.color ? resolveColor(String(item.color), colors).slug : '';
      colorSlug = p.colors.find((c) => c === item.color || c === wanted) || p.colors[0];
    }
    let size = '';
    if (p.sizes.length) {
      size = p.sizes.find((s) => s === item.size) || '';
      if (item.size && !size) throw badRequest(`“${p.name}” üçün “${item.size}” ölçüsü mövcud deyil.`);
      if (!size) size = p.sizes[0];
    } else if (item.size) {
      size = cleanText(item.size, 40);
    }

    const variant = variants.find((v) => v.product_id === p.id && v.color === colorSlug && v.size === (p.sizes.length ? size : ''))
      || variants.find((v) => v.product_id === p.id && v.color === colorSlug && v.size === '')
      || null;
    if (p.track_stock && !variant) {
      throw badRequest(`“${p.name}” üçün seçilmiş rəng/ölçü kombinasiyası mövcud deyil.`);
    }
    const unit = variant && variant.price_override != null ? Number(variant.price_override) : Number(p.price);
    lines.push({
      product_id: p.id,
      variant_id: variant ? variant.id : null,
      name: p.name,
      sku: variant ? variant.sku : p.sku || p.slug,
      size,
      color: colorSlug ? resolveColor(colorSlug, colors).n : '',
      color_slug: colorSlug,
      quantity: qty,
      unit_price: unit,
      total: money(unit * qty),
      track_stock: p.track_stock,
      allow_backorder: p.allow_backorder,
    });
  }
  // Merge duplicate lines (same variant) so stock checks see the real quantity.
  const merged = [];
  for (const l of lines) {
    const same = merged.find((m) => m.product_id === l.product_id && m.color_slug === l.color_slug && m.size === l.size);
    if (same) {
      same.quantity = Math.min(99, same.quantity + l.quantity);
      same.total = money(same.unit_price * same.quantity);
    } else merged.push(l);
  }
  return merged;
}

async function checkout(request, reply) {
  const b = request.body;
  const billing = b.billing || {};
  const firstName = cleanText(billing.first_name, 80);
  const lastName = cleanText(billing.last_name, 80);
  const phone = normalizePhone(cleanText(billing.phone, 40));
  const address = cleanText(billing.address_1, 300);
  const city = cleanText(billing.city, 80) || 'Bakı';
  const email = cleanText(billing.email, 120);
  const note = cleanText(billing.note, 1000);
  if (!firstName || !address || phone.replace(/\D/g, '').length < 7) {
    throw badRequest('Zəhmət olmasa ad, telefon və ünvan xanalarını düzgün doldurun.');
  }
  const paymentMethod = PAYMENT_METHODS[b.payment_method] ? b.payment_method : 'cod';

  const store = await getSetting('store');
  const lines = await resolveCart(b.items);
  const subtotal = money(lines.reduce((s, l) => s + l.total, 0));

  const order = await sql.begin(async (tx) => {
    let discount = 0;
    let couponCode = '';
    if (b.coupon) {
      // Row lock: concurrent checkouts cannot overrun the usage limit.
      const [coupon] = await tx`SELECT * FROM coupons WHERE code = ${String(b.coupon).trim().toUpperCase()} FOR UPDATE`;
      ({ discount } = evaluateCoupon(coupon, subtotal));
      couponCode = coupon.code;
      await tx`UPDATE coupons SET used_count = used_count + 1 WHERE id = ${coupon.id}`;
    }
    const shipping = shippingFor(subtotal, store);
    const total = money(Math.max(0, subtotal - discount) + shipping);
    const stockPlan = await planOrderStock(tx, lines);

    const [o] = await tx`
      INSERT INTO orders (status, first_name, last_name, phone, email, city, address, customer_note, payment_method,
                          subtotal, discount, shipping, total, coupon_code, ip, source)
      VALUES ('new', ${firstName}, ${lastName}, ${phone}, ${email}, ${city}, ${address}, ${note}, ${paymentMethod},
              ${subtotal}, ${discount}, ${shipping}, ${total}, ${couponCode}, ${request.ip || ''}, 'web')
      RETURNING *`;
    for (const l of lines) {
      await tx`
        INSERT INTO order_items (order_id, product_id, variant_id, name, sku, size, color, color_slug, quantity, unit_price, total)
        VALUES (${o.id}, ${l.product_id}, ${l.variant_id}, ${l.name}, ${l.sku}, ${l.size}, ${l.color}, ${l.color_slug}, ${l.quantity}, ${l.unit_price}, ${l.total})`;
      await tx`UPDATE products SET sales_count = sales_count + ${l.quantity} WHERE id = ${l.product_id}`;
    }
    await tx`INSERT INTO order_history (order_id, status, note) VALUES (${o.id}, 'new', ${`Saytdan sifariş (${PAYMENT_METHODS[paymentMethod]})`})`;
    await applyOrderStock(tx, o.id, stockPlan);
    return o;
  });

  reply.status(201);
  return {
    success: true,
    order_id: order.id,
    order_number: String(order.id),
    status: order.status,
    subtotal: order.subtotal,
    discount: order.discount,
    shipping: order.shipping,
    total: order.total,
    currency: 'AZN',
    date_created: new Date(order.created_at).toISOString(),
    message: 'Sifarişiniz uğurla qeydə alındı!',
  };
}

export default async function orderRoutes(app) {
  const limit = { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } }, schema: checkoutSchema };
  app.post('/orders', limit, checkout);
  app.post('/checkout', limit, checkout); // backwards-compatible alias

  app.get('/orders/track', {
    config: { rateLimit: { max: 30, timeWindow: '10 minutes' } },
  }, async (request) => {
    const id = Number(String(request.query.order_id || request.query.id || '').replace(/\D/g, ''));
    if (!id) throw badRequest('Zəhmət olmasa sifariş nömrəsini daxil edin.');
    const [o] = await sql`SELECT * FROM orders WHERE id = ${id}`;
    if (!o) throw notFound('Bu nömrə ilə sifariş tapılmadı.');

    // Full contact details only when the caller proves they know the phone number.
    const given = String(request.query.phone || '').replace(/\D/g, '');
    const verified = given.length >= 7 && o.phone.replace(/\D/g, '').endsWith(given.slice(-9));
    const items = await sql`SELECT * FROM order_items WHERE order_id = ${o.id} ORDER BY id`;
    const history = await sql`SELECT status, created_at FROM order_history WHERE order_id = ${o.id} ORDER BY created_at`;
    const st = ORDER_STATUSES[o.status] || ORDER_STATUSES.new;
    const fullName = `${o.first_name} ${o.last_name}`.trim();
    return {
      success: true,
      order_id: o.id,
      order_number: String(o.id),
      status: o.status,
      status_label: st.label,
      step: st.step,
      verified,
      subtotal: o.subtotal,
      discount: o.discount,
      shipping: o.shipping,
      total: o.total.toFixed(2),
      currency: 'AZN',
      payment_method: PAYMENT_METHODS[o.payment_method] || o.payment_method,
      date: formatDateTimeAz(o.created_at),
      customer_name: verified ? fullName : maskName(fullName),
      city: o.city,
      address: verified ? o.address : maskAddress(o.address),
      items: items.map((i) => ({ name: i.name, qty: i.quantity, total: i.total.toFixed(2), size: i.size, color: i.color })),
      history: history.map((h) => ({ status: h.status, label: ORDER_STATUSES[h.status]?.label || h.status, date: formatDateTimeAz(h.created_at) })),
    };
  });

  app.post('/coupons/validate', {
    config: { rateLimit: { max: 20, timeWindow: '10 minutes' } },
    schema: { body: { type: 'object', required: ['code'], properties: { code: { type: 'string', maxLength: 40 }, subtotal: { type: ['number', 'string'] } } } },
  }, async (request) => {
    const subtotal = money(Number(request.body.subtotal) || 0);
    const coupon = await findCoupon(request.body.code);
    try {
      const { discount } = evaluateCoupon(coupon, subtotal);
      return {
        valid: true,
        code: coupon.code,
        type: coupon.type,
        amount: coupon.amount,
        min_subtotal: coupon.min_subtotal,
        discount,
        message: coupon.type === 'percent' ? `Promokod tətbiq edildi: ${coupon.amount}% endirim` : `Promokod tətbiq edildi: ${coupon.amount} ₼ endirim`,
      };
    } catch (err) {
      return { valid: false, code: String(request.body.code || '').toUpperCase(), discount: 0, message: err.message };
    }
  });
}
