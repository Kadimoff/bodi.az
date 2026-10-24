import { cleanText, cleanUrl } from './html.js';
import { badRequest } from './errors.js';

// Small coercion helpers for admin payloads (the admin UI is the only client).
export const str = (v, max = 500) => cleanText(v ?? '', max);
export const url = (v) => cleanUrl(v);
export const bool = (v) => v === true || v === 'true' || v === 1 || v === '1' || v === 'on';
export const int = (v, def = 0) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
};
export const intOrNull = (v) => (v === null || v === undefined || v === '' ? null : int(v, null));
export const num = (v, def = 0) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : def;
};
export const numOrNull = (v) => (v === null || v === undefined || v === '' ? null : num(v, null));
export const strList = (v, max = 100) => (Array.isArray(v) ? v : String(v || '').split(/[|,]/))
  .map((s) => cleanText(s, max))
  .filter(Boolean)
  .filter((s, i, a) => a.indexOf(s) === i);
export const dateOrNull = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
export const oneOf = (v, allowed, def) => (allowed.includes(v) ? v : def);

export function required(value, label) {
  if (value === '' || value === null || value === undefined) throw badRequest(`“${label}” xanası mütləqdir.`);
  return value;
}

// SEO block stored as jsonb on products, categories and posts.
export function seoBlock(s = {}) {
  return {
    title: str(s.title, 120),
    description: str(s.description, 320),
    keywords: str(s.keywords, 300),
    focus_keyword: str(s.focus_keyword, 80),
    canonical: url(s.canonical),
    og_image: url(s.og_image),
    noindex: bool(s.noindex),
  };
}

export function pageParams(query, defPer = 25) {
  const page = Math.max(1, int(query.page, 1));
  const perPage = Math.min(200, Math.max(1, int(query.per_page, defPer)));
  return { page, perPage, offset: (page - 1) * perPage };
}

// Recursively cleans a settings document: URL-ish keys become safe URLs,
// everything else plain text; booleans and numbers pass through.
export function cleanDeep(value, key = '') {
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => cleanDeep(v, key));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[cleanText(k, 60)] = cleanDeep(v, k);
    return out;
  }
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  if (/(^|_)(url|link|image|video|logo)$/.test(key)) return cleanUrl(value);
  if (/(^|_)color$/.test(key)) return /^#[0-9a-f]{3,8}$/i.test(String(value)) ? String(value) : '';
  return cleanText(value, 2000);
}
