/* ==============================================================================
   Bodi.az — 100% Score Frontend SEO & Schema.org JSON-LD Engine
   Synchronizes Meta Tags, OpenGraph, Twitter Cards, and Rich Snippet Schema Graphs
   from the Bodi backend (server-rendered <head>) & client models.
   ============================================================================== */
(function (global) {
  "use strict";

  const BASE_URL = "https://bodi.az";

  // Pages proxied through the backend already carry the final <head> (titles and
  // descriptions edited in the admin). Client-side SEO must not overwrite it.
  function serverRendered() {
    return !!document.querySelector('meta[name="bodi-ssr"]');
  }

  function setTag(selector, attr, val) {
    let el = document.querySelector(selector);
    if (!el) {
      el = document.createElement(selector.startsWith("meta") ? "meta" : "link");
      const match = selector.match(/\[([a-zA-Z0-9_\-:]+)="([^"]+)"\]/);
      if (match) el.setAttribute(match[1], match[2]);
      document.head.appendChild(el);
    }
    el.setAttribute(attr, val);
  }

  function setMetaName(name, val) {
    if (!val) return;
    setTag(`meta[name="${name}"]`, "content", val);
  }

  function setMetaProperty(prop, val) {
    if (!val) return;
    setTag(`meta[property="${prop}"]`, "content", val);
  }

  function setCanonical(url) {
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = url;
  }

  function injectSchema(schemaObj, scriptId = "bodi-schema-ld") {
    let script = document.getElementById(scriptId);
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(schemaObj, null, 2);
  }

  function fullImgUrl(src) {
    if (!src) return `${BASE_URL}/assets/images/products/ag-pambiq-bodi.jpg`;
    if (src.startsWith('http')) return src;
    return `${BASE_URL}/${src.replace(/^\/+/, '')}`;
  }

  const BODI_SEO = {
    // 1. Product Detail Page SEO & 100% Rich Results Schema
    applyProductSEO(p, reviewsList) {
      if (!p || serverRendered()) return;

      const title = `${p.name} — 100% Orqanik Pambıq | Bodi.az`;
      const desc = `${p.name} — ${p.material || '100% Orqanik Pambıq'}. ${p.desc || ''} Qiymət: ${p.price} ₼. Bakı daxili 24 saat çatdırılma və 14 gün qaytarma zəmanəti.`;
      const canonical = `${BASE_URL}/product.html?p=${p.slug}`;
      const img = fullImgUrl(p.image);

      document.title = title;
      setMetaName("description", desc);
      setMetaName("keywords", `${p.name}, körpə geyimi, bodi, orqanik pambıq, ${p.cat}, bodi.az`);
      setMetaName("robots", "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1");
      setCanonical(canonical);

      // OpenGraph
      setMetaProperty("og:type", "product");
      setMetaProperty("og:title", title);
      setMetaProperty("og:description", desc);
      setMetaProperty("og:image", img);
      setMetaProperty("og:url", canonical);
      setMetaProperty("og:site_name", "Bodi.az");
      setMetaProperty("og:locale", "az_AZ");

      // Twitter
      setMetaName("twitter:card", "summary_large_image");
      setMetaName("twitter:title", title);
      setMetaName("twitter:description", desc);
      setMetaName("twitter:image", img);

      // Calculate real review stats
      const revs = Array.isArray(reviewsList) && reviewsList.length > 0 ? reviewsList : (global.BODI ? (global.BODI.REVIEWS || []).filter(r => r.productId === p.id || r.productSlug === p.slug) : []);
      const count = revs.length > 0 ? revs.length : (p.reviews || 0);
      const avg = revs.length > 0 ? (revs.reduce((s, r) => s + (Number(r.rating) || 5), 0) / revs.length).toFixed(1) : (p.ratingAvg || p.rating || 5.0);

      const imagesArray = Array.isArray(p.images) && p.images.length > 0
        ? p.images.map(fullImgUrl)
        : [img];

      // Schema.org Graph (Product + BreadcrumbList + MerchantReturnPolicy + OfferShippingDetails)
      const schemaGraph = {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Product",
            "@id": `${canonical}#product`,
            "name": p.name,
            "url": canonical,
            "description": desc,
            "image": imagesArray,
            "sku": p.sku || p.slug,
            "mpn": `BODI-${p.id}`,
            "brand": {
              "@type": "Brand",
              "name": "Bodi.az"
            },
            "category": p.cat,
            "material": p.material || "100% Orqanik Pambıq",
            "offers": {
              "@type": "Offer",
              "@id": `${canonical}#offer`,
              "url": canonical,
              "priceCurrency": "AZN",
              "price": Number(p.price).toFixed(2),
              "priceValidUntil": "2027-12-31",
              "itemCondition": "https://schema.org/NewCondition",
              "availability": p.inStock !== false ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
              "seller": {
                "@type": "Organization",
                "name": "Bodi.az",
                "url": BASE_URL
              },
              "hasMerchantReturnPolicy": {
                "@type": "MerchantReturnPolicy",
                "applicableCountry": "AZ",
                "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
                "merchantReturnDays": 14,
                "returnMethod": "https://schema.org/ReturnByMail",
                "returnFees": "https://schema.org/FreeReturn"
              },
              "shippingDetails": {
                "@type": "OfferShippingDetails",
                "shippingRate": {
                  "@type": "MonetaryAmount",
                  "value": p.price >= 50 ? "0.00" : "5.00",
                  "currency": "AZN"
                },
                "shippingDestination": {
                  "@type": "DefinedRegion",
                  "addressCountry": "AZ"
                },
                "deliveryTime": {
                  "@type": "ShippingDeliveryTime",
                  "handlingTime": {
                    "@type": "QuantitativeValue",
                    "minValue": 0,
                    "maxValue": 1,
                    "unitCode": "DAY"
                  },
                  "transitTime": {
                    "@type": "QuantitativeValue",
                    "minValue": 1,
                    "maxValue": 2,
                    "unitCode": "DAY"
                  }
                }
              }
            },
            "aggregateRating": count > 0 ? {
              "@type": "AggregateRating",
              "ratingValue": Number(avg),
              "reviewCount": Number(count),
              "bestRating": 5,
              "worstRating": 1
            } : undefined,
            "review": revs.slice(0, 5).map(r => ({
              "@type": "Review",
              "author": {
                "@type": "Person",
                "name": r.author || "Müştəri"
              },
              "reviewRating": {
                "@type": "Rating",
                "ratingValue": Number(r.rating) || 5,
                "bestRating": 5,
                "worstRating": 1
              },
              "reviewBody": r.quote || "Əla məhsul",
              "datePublished": r.datePublished || undefined
            }))
          },
          {
            "@type": "BreadcrumbList",
            "@id": `${canonical}#breadcrumb`,
            "itemListElement": [
              {
                "@type": "ListItem",
                "position": 1,
                "name": "Ana səhifə",
                "item": BASE_URL
              },
              {
                "@type": "ListItem",
                "position": 2,
                "name": (global.BODI && global.BODI.CAT_NAMES && global.BODI.CAT_NAMES[p.cat]) || p.cat,
                "item": `${BASE_URL}/category.html?cat=${p.cat}`
              },
              {
                "@type": "ListItem",
                "position": 3,
                "name": p.name,
                "item": canonical
              }
            ]
          }
        ]
      };

      injectSchema(schemaGraph);
    },

    // 2. Category Page SEO
    applyCategorySEO(catSlug, catName) {
      if (serverRendered()) return;
      const canonical = `${BASE_URL}/category.html${catSlug ? '?cat=' + catSlug : ''}`;
      const title = `${catName || 'Körpə Geyimləri'} — 100% Orqanik Pambıq | Bodi.az`;
      const desc = `${catName || 'Körpə geyimləri'} kolleksiyası — Bodi.az-da 100% orqanik pambıqdan hazırlanmış körpə bodiləri, tulumları və dəstləri. Bakı daxili 24 saat çatdırılma.`;

      document.title = title;
      setMetaName("description", desc);
      setCanonical(canonical);
      setMetaProperty("og:title", title);
      setMetaProperty("og:description", desc);
      setMetaProperty("og:url", canonical);

      injectSchema({
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": catName,
        "url": canonical,
        "description": desc,
        "breadcrumb": {
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Ana səhifə", "item": BASE_URL },
            { "@type": "ListItem", "position": 2, "name": catName, "item": canonical }
          ]
        }
      });
    },

    // 3. FAQ Page SEO
    applyFAQSEO() {
      const faqItems = [];
      document.querySelectorAll(".faq-item, .acc-item").forEach(el => {
        const q = el.querySelector(".faq-question, .acc-head")?.textContent?.trim();
        const a = el.querySelector(".faq-answer, .acc-body")?.textContent?.trim();
        if (q && a) {
          faqItems.push({
            "@type": "Question",
            "name": q,
            "acceptedAnswer": {
              "@type": "Answer",
              "text": a
            }
          });
        }
      });

      if (faqItems.length > 0) {
        injectSchema({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": faqItems
        }, "bodi-faq-schema");
      }
    },

    // 4. Homepage Dynamic SEO & Schema.org JSON-LD Graph
    applyHomepageSEO(seo) {
      if (!seo || serverRendered()) return;

      const title = seo.title || document.title;
      const desc = seo.description || "";
      const canonical = seo.canonical || BASE_URL;

      if (title) document.title = title;
      if (desc) setMetaName("description", desc);
      if (seo.keywords) setMetaName("keywords", seo.keywords);
      if (seo.robots) setMetaName("robots", seo.robots);
      if (canonical) setCanonical(canonical);

      // OpenGraph
      if (seo.og) {
        if (seo.og.type) setMetaProperty("og:type", seo.og.type);
        if (seo.og.title) setMetaProperty("og:title", seo.og.title);
        if (seo.og.description) setMetaProperty("og:description", seo.og.description);
        if (seo.og.image) setMetaProperty("og:image", fullImgUrl(seo.og.image));
        if (seo.og.url) setMetaProperty("og:url", seo.og.url);
        if (seo.og.site_name) setMetaProperty("og:site_name", seo.og.site_name);
        if (seo.og.locale) setMetaProperty("og:locale", seo.og.locale);
      }

      // Twitter Cards
      if (seo.twitter) {
        if (seo.twitter.card) setMetaName("twitter:card", seo.twitter.card);
        if (seo.twitter.title) setMetaName("twitter:title", seo.twitter.title);
        if (seo.twitter.description) setMetaName("twitter:description", seo.twitter.description);
        if (seo.twitter.image) setMetaName("twitter:image", fullImgUrl(seo.twitter.image));
      }

      // Schema.org Graph
      if (seo.schema) {
        injectSchema(seo.schema, "bodi-schema-ld");
      }
    },

    // 5. Sync SEO metadata from backend endpoint if available
    async syncFromBackend(type, slug) {
      if (!window.BODI_API || !window.BODI_API.API_BASE) return;
      try {
        if (serverRendered()) return;
        const res = await fetch(`${window.BODI_API.API_BASE}/api/v1/seo?type=${encodeURIComponent(type)}&slug=${encodeURIComponent(slug || '')}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.title) {
          if (type === 'home') {
            this.applyHomepageSEO(data);
          } else {
            document.title = data.title;
            if (data.description) setMetaName("description", data.description);
            if (data.canonical) setCanonical(data.canonical);
            if (data.schema) injectSchema(data.schema);
          }
        }
      } catch (e) {
        // graceful client fallback
      }
    }
  };

  global.BODI_SEO = BODI_SEO;
})(window);
