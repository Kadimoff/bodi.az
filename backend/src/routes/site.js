import fs from 'node:fs/promises';
import path from 'node:path';
import { sql } from '../db.js';
import { config } from '../config.js';
import { mediaUrl } from '../lib/media.js';
import { escapeHtml } from '../lib/text.js';
import { absUrl, productUrl, categoryUrl, postUrl } from '../lib/seo.js';
import { seoFor } from './public/content.js';

// Pages whose <head> is rendered server-side so crawlers and link previews
// (Google, Facebook, WhatsApp, Telegram) see real titles, descriptions and JSON-LD.
const SSR_PAGES = new Set(['index.html', 'product.html', 'category.html', 'blog-post.html', 'about.html', 'faq.html', 'contact.html', 'reviews.html', 'blog.html']);

const templateCache = new Map();

async function readTemplate(page) {
  const file = path.join(config.frontendDir, page);
  const stat = await fs.stat(file);
  const cached = templateCache.get(file);
  if (cached && cached.mtime === stat.mtimeMs) return cached.html;
  const html = await fs.readFile(file, 'utf8');
  templateCache.set(file, { mtime: stat.mtimeMs, html });
  return html;
}

function jsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

function headTags(seo) {
  const meta = (name, content) => (content ? `<meta name="${name}" content="${escapeHtml(content)}">` : '');
  const prop = (name, content) => (content ? `<meta property="${name}" content="${escapeHtml(content)}">` : '');
  return [
    `<title>${escapeHtml(seo.title)}</title>`,
    meta('description', seo.description),
    meta('keywords', seo.keywords),
    meta('robots', seo.robots),
    `<link rel="canonical" href="${escapeHtml(seo.canonical)}">`,
    prop('og:type', seo.og?.type),
    prop('og:title', seo.og?.title),
    prop('og:description', seo.og?.description),
    prop('og:image', seo.og?.image),
    prop('og:url', seo.og?.url),
    prop('og:site_name', seo.og?.site_name),
    prop('og:locale', seo.og?.locale || 'az_AZ'),
    meta('twitter:card', seo.twitter?.card),
    meta('twitter:title', seo.twitter?.title),
    meta('twitter:description', seo.twitter?.description),
    meta('twitter:image', seo.twitter?.image),
    meta('google-site-verification', seo.verification?.google),
    meta('yandex-verification', seo.verification?.yandex),
    meta('msvalidate.01', seo.verification?.bing),
    '<meta name="bodi-ssr" content="1">',
    seo.schema ? `<script type="application/ld+json" id="bodi-schema-ld">${jsonLd(seo.schema)}</script>` : '',
  ].filter(Boolean).join('\n');
}

const STRIP_PATTERNS = [
  /<title>[\s\S]*?<\/title>\s*/gi,
  /<meta\s+name="(description|keywords|robots|twitter:[^"]+|google-site-verification|yandex-verification|msvalidate\.01|bodi-ssr)"[^>]*>\s*/gi,
  /<meta\s+property="og:[^"]+"[^>]*>\s*/gi,
  /<link\s+rel="canonical"[^>]*>\s*/gi,
  /<script\s+type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>\s*/gi,
  /<!--\s*Structured Data[^>]*-->\s*/gi,
];

export function injectHead(html, seo) {
  const headEnd = html.search(/<\/head>/i);
  if (headEnd === -1) return html;
  let head = html.slice(0, headEnd);
  const rest = html.slice(headEnd);
  for (const re of STRIP_PATTERNS) head = head.replace(re, '');
  const tags = headTags(seo);
  const anchor = head.match(/<meta\s+name="viewport"[^>]*>/i) || head.match(/<meta\s+charset[^>]*>/i) || head.match(/<head[^>]*>/i);
  if (anchor) {
    const at = anchor.index + anchor[0].length;
    head = `${head.slice(0, at)}\n${tags}\n${head.slice(at)}`;
  } else {
    head += tags;
  }
  return head + rest;
}

async function notFoundPage(reply) {
  const html = await readTemplate('404.html').catch(() => '<!doctype html><title>404</title><h1>Səhifə tapılmadı</h1>');
  return reply.status(404).type('text/html; charset=utf-8').header('Cache-Control', 'no-store').send(html);
}

export default async function siteRoutes(app) {
  app.get('/ssr/:page', async (request, reply) => {
    const page = request.params.page;
    if (!SSR_PAGES.has(page)) return notFoundPage(reply);
    const q = request.query;

    let found;
    let redirect = null;
    if (page === 'product.html') {
      const slug = q.p || q.slug || q.id;
      found = slug ? await seoFor('product', String(slug)) : null;
      if (!found) return notFoundPage(reply);
      if (found.redirectedFrom) redirect = `/product.html?p=${encodeURIComponent(found.entity.slug)}`;
    } else if (page === 'category.html') {
      if (q.cat) {
        found = await seoFor('category', String(q.cat));
        if (!found) return notFoundPage(reply);
        if (found.redirectedFrom) redirect = `/category.html?cat=${encodeURIComponent(found.entity.slug)}`;
      } else {
        found = await seoFor('home');
        const title = q.filter === 'sale' ? 'Endirimli məhsullar' : q.filter === 'new' ? 'Yeni kolleksiya' : q.q ? `Axtarış: ${String(q.q).slice(0, 60)}` : 'Bütün məhsullar';
        const canonical = `${config.siteUrl}/category.html${q.filter ? `?filter=${encodeURIComponent(q.filter)}` : ''}`;
        found.seo = {
          ...found.seo,
          title: `${title} — Körpə Geyimləri | Bodi.az`,
          canonical,
          robots: q.q ? 'noindex, follow' : found.seo.robots,
          og: { ...found.seo.og, title: `${title} | Bodi.az`, url: canonical },
          schema: null,
        };
      }
    } else if (page === 'blog-post.html') {
      found = q.b ? await seoFor('post', String(q.b)) : null;
      if (!found) return notFoundPage(reply);
      if (found.redirectedFrom) redirect = `/blog-post.html?b=${encodeURIComponent(found.entity.slug)}`;
    } else if (page === 'index.html') {
      found = await seoFor('home');
    } else {
      found = await seoFor('page', page);
    }
    if (redirect) return reply.redirect(redirect, 301);

    const html = injectHead(await readTemplate(page), found.seo);
    return reply
      .type('text/html; charset=utf-8')
      .header('Cache-Control', 'public, max-age=60')
      .send(html);
  });

  app.get('/sitemap.xml', async (request, reply) => {
    const [products, categories, posts] = await Promise.all([
      sql`
        SELECT p.slug, p.name, p.updated_at, p.seo,
               COALESCE(json_agg(json_build_object('path', m.path, 'alt', m.alt) ORDER BY pi.position) FILTER (WHERE m.id IS NOT NULL), '[]') AS images
        FROM products p
        LEFT JOIN product_images pi ON pi.product_id = p.id
        LEFT JOIN media m ON m.id = pi.media_id
        WHERE p.status = 'published'
        GROUP BY p.id ORDER BY p.updated_at DESC`,
      sql`SELECT slug, updated_at, seo FROM categories WHERE is_active ORDER BY sort_order`,
      sql`SELECT slug, updated_at, seo FROM posts WHERE status = 'published' AND (published_at IS NULL OR published_at <= now()) ORDER BY published_at DESC`,
    ]);
    const day = (d) => new Date(d).toISOString().slice(0, 10);
    const today = day(new Date());
    const url = (loc, lastmod, freq, priority, extra = '') =>
      `  <url>\n    <loc>${escapeHtml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${freq}</changefreq>\n    <priority>${priority}</priority>${extra}\n  </url>`;

    const entries = [
      url(`${config.siteUrl}/`, today, 'daily', '1.0'),
      url(`${config.siteUrl}/category.html`, today, 'daily', '0.8'),
      ...categories.filter((c) => !c.seo?.noindex).map((c) => url(c.seo?.canonical || categoryUrl(c.slug), day(c.updated_at), 'daily', '0.9')),
      ...products.filter((p) => !p.seo?.noindex).map((p) => url(
        p.seo?.canonical || productUrl(p.slug),
        day(p.updated_at),
        'weekly',
        '0.8',
        p.images.slice(0, 5).map((i) => `\n    <image:image>\n      <image:loc>${escapeHtml(absUrl(mediaUrl(i.path)))}</image:loc>\n      <image:title>${escapeHtml(i.alt || p.name)}</image:title>\n    </image:image>`).join(''),
      )),
      url(`${config.siteUrl}/blog.html`, posts[0] ? day(posts[0].updated_at) : today, 'weekly', '0.6'),
      ...posts.filter((p) => !p.seo?.noindex).map((p) => url(p.seo?.canonical || postUrl(p.slug), day(p.updated_at), 'monthly', '0.6')),
      ...['about.html', 'reviews.html', 'faq.html', 'contact.html'].map((pg) => url(`${config.siteUrl}/${pg}`, today, 'monthly', '0.5')),
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${entries.join('\n')}\n</urlset>\n`;
    return reply.type('application/xml; charset=utf-8').header('Cache-Control', 'public, max-age=600').send(xml);
  });
}
