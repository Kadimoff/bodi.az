import sanitizeHtml from 'sanitize-html';

// Rich text from the admin editor is rendered with innerHTML on the storefront,
// so it is always sanitized on the way in.
const OPTIONS = {
  allowedTags: [
    'p', 'br', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'blockquote',
    'ul', 'ol', 'li', 'a', 'img', 'figure', 'figcaption', 'hr', 'table', 'thead',
    'tbody', 'tr', 'th', 'td', 'span', 'code', 'pre',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    th: ['colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => {
      const external = /^https?:\/\//i.test(attribs.href || '') && !/^https?:\/\/(www\.)?bodi\.az/i.test(attribs.href);
      return {
        tagName,
        attribs: external ? { ...attribs, target: '_blank', rel: 'noopener noreferrer' } : attribs,
      };
    },
    img: (tagName, attribs) => ({ tagName, attribs: { loading: 'lazy', ...attribs } }),
    b: 'strong',
    i: 'em',
  },
};

export function cleanHtml(html) {
  return sanitizeHtml(String(html || ''), OPTIONS).trim();
}

// Plain text that the storefront interpolates into HTML templates (and attribute
// values), so angle brackets are dropped and straight double quotes become
// typographic ones — the result can never open a tag or close an attribute.
export function cleanText(text, max = 5000) {
  return sanitizeHtml(String(text ?? ''), { allowedTags: [], allowedAttributes: {} })
    .replace(/&lt;|&gt;|[<>]/g, '')
    .replace(/&quot;|"/g, '”')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, max);
}

// Links typed in the admin: relative paths, anchors, http(s), mailto, tel.
export function cleanUrl(url, max = 2000) {
  const s = String(url ?? '').trim().slice(0, max);
  if (!s) return '';
  if (/^(https?:\/\/|mailto:|tel:|#|\/|[a-z0-9_-]+\.html|assets\/|uploads\/|\?)/i.test(s) && !/["<>\s]/.test(s)) return s;
  return '';
}
