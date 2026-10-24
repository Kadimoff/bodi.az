import { config } from '../config.js';
import { truncate, stripHtml } from './text.js';

// Absolute URL on the public site for a root-relative or site-relative path.
export function absUrl(src) {
  if (!src) return '';
  if (/^https?:\/\//i.test(src)) return src;
  return `${config.siteUrl}/${String(src).replace(/^\/+/, '')}`;
}

function applyTemplate(tpl, value) {
  return tpl && tpl.includes('%s') ? tpl.replace('%s', value) : value;
}

function robotsFor(seo, fallback) {
  return seo && seo.noindex ? 'noindex, follow' : fallback;
}

function organization(g) {
  return {
    '@type': g.schema_store_type || 'ClothingStore',
    '@id': `${config.siteUrl}/#organization`,
    name: g.schema_store_name || 'Bodi.az',
    url: `${config.siteUrl}/`,
    logo: absUrl(g.schema_logo),
    image: absUrl(g.og_image || g.schema_logo),
    description: g.meta_description,
    priceRange: g.schema_price_range || '₼₼',
    openingHours: g.schema_opening_hours || undefined,
    telephone: g.schema_phone || undefined,
    address: { '@type': 'PostalAddress', addressLocality: g.schema_city || 'Bakı', addressCountry: g.schema_country || 'AZ' },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: g.schema_phone,
      contactType: 'customer service',
      availableLanguage: ['Azerbaijani', 'Russian', 'English'],
    },
    sameAs: [g.schema_social_instagram, g.schema_social_facebook].filter(Boolean),
  };
}

function payload({ title, description, keywords, canonical, robots, image, type, schema, g }) {
  const img = absUrl(image || g.og_image);
  return {
    title,
    description,
    keywords: keywords || g.keywords,
    canonical,
    robots,
    og: { type, title, description, image: img, url: canonical, site_name: g.og_site_name || 'Bodi.az', locale: 'az_AZ' },
    twitter: { card: g.twitter_card || 'summary_large_image', title, description, image: img },
    schema,
    verification: {
      google: g.google_site_verification || '',
      yandex: g.yandex_verification || '',
      bing: g.bing_verification || '',
    },
  };
}

export function productUrl(slug) {
  return `${config.siteUrl}/product.html?p=${encodeURIComponent(slug)}`;
}
export function categoryUrl(slug) {
  return `${config.siteUrl}/category.html?cat=${encodeURIComponent(slug)}`;
}
export function postUrl(slug) {
  return `${config.siteUrl}/blog-post.html?b=${encodeURIComponent(slug)}`;
}

export function homeSeo(g) {
  const canonical = `${config.siteUrl}/`;
  const title = g.meta_title;
  const p = payload({
    title,
    description: g.meta_description,
    canonical,
    robots: g.robots,
    image: g.og_image,
    type: g.og_type || 'website',
    g,
    schema: {
      '@context': 'https://schema.org',
      '@graph': [
        organization(g),
        {
          '@type': 'WebSite',
          '@id': `${config.siteUrl}/#website`,
          url: canonical,
          name: g.schema_store_name || 'Bodi.az',
          inLanguage: 'az',
          publisher: { '@id': `${config.siteUrl}/#organization` },
          potentialAction: {
            '@type': 'SearchAction',
            target: `${config.siteUrl}/category.html?q={search_term_string}`,
            'query-input': 'required name=search_term_string',
          },
        },
      ],
    },
  });
  if (g.og_title) p.og.title = g.og_title;
  if (g.og_description) p.og.description = g.og_description;
  if (g.twitter_title) p.twitter.title = g.twitter_title;
  if (g.twitter_description) p.twitter.description = g.twitter_description;
  if (g.twitter_image) p.twitter.image = absUrl(g.twitter_image);
  return p;
}

/**
 * Product page SEO. `product` is the storefront model from presentProduct
 * (detailed), `reviews` the approved reviews (newest first).
 */
export function productSeo(product, reviews, g, store) {
  const s = product.seo || {};
  const canonical = s.canonical || productUrl(product.slug);
  const title = s.title || applyTemplate(g.product_title_template, product.name);
  const description = s.description || truncate(
    `${product.name} — ${product.material}. ${product.desc} Qiymət: ${product.price} ₼. Bakı daxili sürətli çatdırılma, ${store.return_days} gün qaytarma.`,
    160,
  );
  const images = (product.images || []).map(absUrl);
  // Link previews (WhatsApp, Facebook) are most reliable with the original JPEG/PNG.
  const ogImage = s.og_image || product.gallery?.[0]?.url || images[0];

  const offer = {
    '@type': 'Offer',
    url: canonical,
    priceCurrency: 'AZN',
    price: Number(product.price).toFixed(2),
    priceValidUntil: `${new Date().getFullYear() + 1}-12-31`,
    itemCondition: 'https://schema.org/NewCondition',
    availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    seller: { '@id': `${config.siteUrl}/#organization` },
    hasMerchantReturnPolicy: {
      '@type': 'MerchantReturnPolicy',
      applicableCountry: 'AZ',
      returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
      merchantReturnDays: store.return_days,
      returnMethod: 'https://schema.org/ReturnByMail',
      returnFees: 'https://schema.org/FreeReturn',
    },
    shippingDetails: {
      '@type': 'OfferShippingDetails',
      shippingRate: { '@type': 'MonetaryAmount', value: product.price >= store.free_shipping_threshold ? '0.00' : Number(store.shipping_fee).toFixed(2), currency: 'AZN' },
      shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'AZ' },
      deliveryTime: {
        '@type': 'ShippingDeliveryTime',
        handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
        transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 3, unitCode: 'DAY' },
      },
    },
  };

  const productNode = {
    '@type': 'Product',
    '@id': `${canonical}#product`,
    name: product.name,
    url: canonical,
    description: stripHtml(product.descriptionHtml || product.desc) || description,
    image: images,
    sku: product.sku,
    mpn: `BODI-${product.id}`,
    brand: { '@type': 'Brand', name: g.schema_store_name || 'Bodi.az' },
    category: product.categories[0]?.name || product.cat,
    material: product.material,
    color: product.colors.map((c) => c.n).join(', '),
    size: product.sizes.join(', '),
    offers: offer,
  };
  // Google rejects aggregateRating without real reviews behind it.
  if (product.reviews > 0) {
    productNode.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(product.ratingAvg.toFixed(1)),
      reviewCount: product.reviews,
      bestRating: 5,
      worstRating: 1,
    };
    productNode.review = reviews.slice(0, 5).map((r) => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: r.author },
      reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
      reviewBody: r.quote,
      datePublished: r.datePublished,
    }));
  }

  return payload({
    title,
    description,
    keywords: s.keywords || [product.name, product.categories[0]?.name, 'körpə geyimi', 'orqanik pambıq', 'bodi.az'].filter(Boolean).join(', '),
    canonical,
    robots: robotsFor(s, g.robots),
    image: ogImage,
    type: 'product',
    g,
    schema: {
      '@context': 'https://schema.org',
      '@graph': [
        productNode,
        breadcrumbs([
          ['Ana səhifə', `${config.siteUrl}/`],
          product.categories[0] ? [product.categories[0].name, categoryUrl(product.cat)] : null,
          [product.name, canonical],
        ]),
      ],
    },
  });
}

export function categorySeo(category, products, g) {
  const s = category.seo || {};
  const canonical = s.canonical || categoryUrl(category.slug);
  const title = s.title || applyTemplate(g.category_title_template, category.name);
  const description = s.description || truncate(
    category.description ||
      `${category.name} kolleksiyası — Bodi.az-da 100% orqanik pambıqdan körpə geyimləri. Bakı daxili 24 saat çatdırılma və asan qaytarma.`,
    160,
  );
  return payload({
    title,
    description,
    keywords: s.keywords,
    canonical,
    robots: robotsFor(s, g.robots),
    image: s.og_image || category.image || products[0]?.image,
    type: 'website',
    g,
    schema: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'CollectionPage',
          '@id': `${canonical}#collection`,
          name: category.name,
          url: canonical,
          description,
          inLanguage: 'az',
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: products.length,
            itemListElement: products.slice(0, 30).map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: productUrl(p.slug), name: p.name })),
          },
        },
        breadcrumbs([
          ['Ana səhifə', `${config.siteUrl}/`],
          [category.name, canonical],
        ]),
      ],
    },
  });
}

export function postSeo(post, g) {
  const s = post.seo || {};
  const canonical = s.canonical || postUrl(post.slug);
  const title = s.title || applyTemplate(g.title_template, post.title);
  const description = s.description || truncate(post.excerpt || stripHtml(post.content), 160);
  const image = s.og_image || post.image;
  return payload({
    title,
    description,
    keywords: s.keywords,
    canonical,
    robots: robotsFor(s, g.robots),
    image,
    type: 'article',
    g,
    schema: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BlogPosting',
          '@id': `${canonical}#article`,
          headline: truncate(post.title, 110),
          url: canonical,
          description,
          image: image ? [absUrl(image)] : undefined,
          datePublished: post.publishedAt,
          dateModified: post.updatedAt,
          inLanguage: 'az',
          articleSection: post.cat || undefined,
          author: { '@type': 'Organization', name: `${g.schema_store_name || 'Bodi.az'} Komandası` },
          publisher: { '@id': `${config.siteUrl}/#organization` },
          mainEntityOfPage: canonical,
        },
        breadcrumbs([
          ['Ana səhifə', `${config.siteUrl}/`],
          ['Bloq', `${config.siteUrl}/blog.html`],
          [post.title, canonical],
        ]),
      ],
    },
  });
}

export function staticPageSeo(page, g) {
  const pages = {
    'about.html': ['Haqqımızda', 'Bodi.az hekayəsi: körpələr üçün 100% orqanik pambıq geyimlər, dəyərlərimiz və davamlı istehsal.'],
    'faq.html': ['Tez-tez verilən suallar', 'Çatdırılma, qaytarma, ölçü cədvəli və ödəniş haqqında ən çox verilən suallar.'],
    'contact.html': ['Əlaqə', 'Bodi.az ilə əlaqə: telefon, WhatsApp, e-poçt və mağaza ünvanlarımız.'],
    'reviews.html': ['Müştəri rəyləri', 'Valideynlərin Bodi.az məhsulları haqqında real rəyləri və qiymətləndirmələri.'],
    'blog.html': ['Valideyn bloqu', 'Körpə qulluğu, geyim seçimi və yuxu rejimi haqqında faydalı məqalələr.'],
  };
  const [name, description] = pages[page] || [];
  if (!name) return null;
  const canonical = `${config.siteUrl}/${page}`;
  return payload({
    title: applyTemplate(g.title_template, name),
    description,
    canonical,
    robots: g.robots,
    image: g.og_image,
    type: 'website',
    g,
    schema: {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebPage', '@id': `${canonical}#webpage`, url: canonical, name, description, inLanguage: 'az', isPartOf: { '@id': `${config.siteUrl}/#website` } },
        breadcrumbs([
          ['Ana səhifə', `${config.siteUrl}/`],
          [name, canonical],
        ]),
      ],
    },
  });
}

function breadcrumbs(items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.filter(Boolean).map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })),
  };
}

// ------------------------------------------------------------ SEO analyzer

/**
 * Yoast-style checks shown in the admin. Returns { score: 0..100, checks: [{ ok, level, text }] }.
 * level: 'good' | 'warn' | 'bad'.
 */
export function analyzeSeo({ title, description, slug, content, focusKeyword, images = [], kind = 'product' }) {
  const checks = [];
  const add = (level, text) => checks.push({ level, text });
  const kw = String(focusKeyword || '').trim().toLowerCase();
  const plain = stripHtml(content).toLowerCase();
  const t = String(title || '');
  const d = String(description || '');

  if (!t) add('bad', 'SEO başlığı boşdur.');
  else if (t.length < 30) add('warn', `SEO başlığı qısadır (${t.length} simvol). 50–60 simvol tövsiyə olunur.`);
  else if (t.length > 65) add('warn', `SEO başlığı uzundur (${t.length} simvol) və axtarışda kəsilə bilər.`);
  else add('good', `SEO başlığının uzunluğu idealdır (${t.length} simvol).`);

  if (!d) add('bad', 'Meta təsvir boşdur — Google mətndən təsadüfi parça göstərəcək.');
  else if (d.length < 110) add('warn', `Meta təsvir qısadır (${d.length} simvol). 120–160 simvol tövsiyə olunur.`);
  else if (d.length > 165) add('warn', `Meta təsvir uzundur (${d.length} simvol) və kəsiləcək.`);
  else add('good', `Meta təsvirin uzunluğu idealdır (${d.length} simvol).`);

  if (!slug) add('bad', 'URL (slug) boşdur.');
  else if (slug.length > 75) add('warn', 'URL çox uzundur. Qısa və açar sözlü URL seçin.');
  else add('good', 'URL qısa və oxunaqlıdır.');

  const words = plain.split(/\s+/).filter(Boolean).length;
  const minWords = kind === 'post' ? 300 : 50;
  if (words < minWords) add('warn', `Məzmun azdır (${words} söz). Ən azı ${minWords} söz tövsiyə olunur.`);
  else add('good', `Məzmun kifayət qədərdir (${words} söz).`);

  if (kind !== 'category') {
    const missingAlt = images.filter((i) => !String(i.alt || '').trim()).length;
    if (!images.length) add('bad', 'Heç bir şəkil əlavə edilməyib.');
    else if (missingAlt) add('warn', `${missingAlt} şəklin alt mətni (alt) yoxdur.`);
    else add('good', 'Bütün şəkillərin alt mətni var.');
  }

  if (!kw) {
    add('warn', 'Fokus açar söz təyin edilməyib.');
  } else {
    const kwSlug = kw.replace(/[əƏ]/g, 'e').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ç/g, 'c').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/\s+/g, '-');
    add(t.toLowerCase().includes(kw) ? 'good' : 'bad', t.toLowerCase().includes(kw) ? 'Açar söz başlıqda var.' : 'Açar söz SEO başlığında yoxdur.');
    add(d.toLowerCase().includes(kw) ? 'good' : 'warn', d.toLowerCase().includes(kw) ? 'Açar söz meta təsvirdə var.' : 'Açar söz meta təsvirdə yoxdur.');
    add(String(slug).includes(kwSlug) ? 'good' : 'warn', String(slug).includes(kwSlug) ? 'Açar söz URL-də var.' : 'Açar söz URL-də yoxdur.');
    const occurrences = plain.split(kw).length - 1;
    const density = words ? (occurrences * kw.split(/\s+/).length * 100) / words : 0;
    if (!occurrences) add('warn', 'Açar söz məzmunda keçmir.');
    else if (density > 3.5) add('warn', `Açar söz sıxlığı yüksəkdir (${density.toFixed(1)}%). Təbii yazın.`);
    else add('good', `Açar söz məzmunda ${occurrences} dəfə keçir.`);
  }

  const weights = { good: 1, warn: 0.5, bad: 0 };
  const score = checks.length ? Math.round((checks.reduce((s, c) => s + weights[c.level], 0) / checks.length) * 100) : 0;
  return { score, checks };
}
