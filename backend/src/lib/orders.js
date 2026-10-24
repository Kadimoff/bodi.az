import { sql } from '../db.js';
import { money } from './text.js';
import { badRequest } from './errors.js';

export const ORDER_STATUSES = {
  new: { label: 'Sifariş qəbul edildi', step: 1 },
  processing: { label: 'Hazırlanır', step: 2 },
  shipped: { label: 'Kuryerdə', step: 3 },
  completed: { label: 'Çatdırıldı', step: 4 },
  cancelled: { label: 'Ləğv edildi', step: 0 },
  returned: { label: 'Qaytarıldı', step: 0 },
};

export const PAYMENT_METHODS = {
  cod: 'Qapıda nağd ödəmə',
  whatsapp: 'WhatsApp ilə sifariş & təsdiq',
  card: 'Kartla ödəniş',
};

// Statuses in which an order's goods are considered out of the warehouse.
export const STOCK_HOLDING = new Set(['new', 'processing', 'shipped', 'completed']);

export async function findCoupon(code, tx = sql) {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return null;
  const [row] = await tx`SELECT * FROM coupons WHERE code = ${c}`;
  return row || null;
}

// Returns { coupon, discount } or throws a user-facing error.
export function evaluateCoupon(coupon, subtotal) {
  if (!coupon || !coupon.is_active) throw badRequest('Promokod yanlışdır və ya aktiv deyil.');
  const now = Date.now();
  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) throw badRequest('Bu promokod hələ aktiv deyil.');
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < now) throw badRequest('Promokodun müddəti bitib.');
  if (coupon.usage_limit != null && coupon.used_count >= coupon.usage_limit) throw badRequest('Promokodun istifadə limiti bitib.');
  if (subtotal < Number(coupon.min_subtotal || 0)) {
    throw badRequest(`Bu promokod minimum ${Number(coupon.min_subtotal).toFixed(2)} ₼ məbləğli sifarişlər üçündür.`);
  }
  const discount = coupon.type === 'percent'
    ? money((subtotal * Number(coupon.amount)) / 100)
    : money(Math.min(Number(coupon.amount), subtotal));
  return { coupon, discount };
}

export function shippingFor(subtotal, store) {
  if (subtotal <= 0) return 0;
  return subtotal >= Number(store.free_shipping_threshold) ? 0 : money(store.shipping_fee);
}

export function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 9) return `+994${digits}`; // 50 123 45 67
  if (digits.length === 10 && digits.startsWith('0')) return `+994${digits.slice(1)}`; // 050 123 45 67
  if (digits.length === 12 && digits.startsWith('994')) return `+${digits}`;
  return String(phone || '').trim();
}

export function maskName(s) {
  return String(s || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length <= 1 ? w : w[0] + '*'.repeat(Math.min(w.length - 1, 4))))
    .join(' ');
}

export function maskAddress(s) {
  const str = String(s || '');
  if (str.length <= 6) return '***';
  return str.slice(0, Math.ceil(str.length / 3)) + '***';
}
