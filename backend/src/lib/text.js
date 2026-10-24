// Azerbaijani-aware text helpers: slugs, plain text, dates.

const AZ_MAP = {
  ə: 'e', Ə: 'e', ı: 'i', I: 'i', İ: 'i', ö: 'o', Ö: 'o', ü: 'u', Ü: 'u',
  ç: 'c', Ç: 'c', ş: 's', Ş: 's', ğ: 'g', Ğ: 'g',
};

export function slugify(input, maxLength = 80) {
  const s = String(input || '')
    .replace(/[əƏıIİöÖüÜçÇşŞğĞ]/g, (ch) => AZ_MAP[ch])
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' ve ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s.slice(0, maxLength).replace(/-+$/g, '');
}

// Lowercased ASCII key used to match colour names/aliases ("Göy" → "goy").
export function asciiKey(input) {
  return slugify(input).replace(/-/g, '');
}

export function stripHtml(html) {
  return String(html || '')
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncate(text, max) {
  const s = String(text || '').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:–—-]+$/, '') + '…';
}

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const AZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
const AZ_MONTHS_SHORT = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avq', 'sen', 'okt', 'noy', 'dek'];
const TZ = 'Asia/Baku';

function bakuParts(date) {
  const d = date instanceof Date ? date : new Date(date);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return { y: get('year'), m: Number(get('month')), d: Number(get('day')), hh: get('hour'), mm: get('minute') };
}

// "20 sentyabr 2026"
export function formatDateAz(date) {
  if (!date) return '';
  const p = bakuParts(date);
  return `${p.d} ${AZ_MONTHS[p.m - 1]} ${p.y}`;
}

// "20 sen 2026"
export function formatDateAzShort(date) {
  if (!date) return '';
  const p = bakuParts(date);
  return `${p.d} ${AZ_MONTHS_SHORT[p.m - 1]} ${p.y}`;
}

// "20.09.2026 14:32"
export function formatDateTimeAz(date) {
  if (!date) return '';
  const p = bakuParts(date);
  return `${String(p.d).padStart(2, '0')}.${String(p.m).padStart(2, '0')}.${p.y} ${p.hh}:${p.mm}`;
}

export function readingMinutes(html) {
  const words = stripHtml(html).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function money(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}
