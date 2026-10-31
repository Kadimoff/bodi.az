/* ==============================================================================
   Bodi.az — Headless E-Commerce API Service & Decoupled Architecture

   Architecture:
   - Facade: BODI_API provides a platform-agnostic e-commerce client.
   - Adapter: BodiAdapter talks to Bodi's own backend (/api/v1). The backend
     already returns the canonical storefront models, so no translation layer
     is needed beyond keeping the shared BODI catalog arrays in sync.
   - Decoupling: All UI templates call the facade only; swapping the backend
     means replacing the adapter, nothing else.
   ============================================================================== */
(function (global) {
  "use strict";

  // 1. Configuration — same origin by default (nginx proxies /api to the backend)
  const API_BASE = ((window.BODI_CONFIG && window.BODI_CONFIG.apiUrl) || "").replace(/\/+$/, "");
  const API = API_BASE + "/api/v1";
  let WHATSAPP_NUMBER = (window.BODI_CONFIG && window.BODI_CONFIG.whatsapp) || "994501234567";

  function getHeaders() {
    return {
      "Content-Type": "application/json",
      "Accept": "application/json"
    };
  }

  async function request(path, options) {
    const res = await fetch(API + path, Object.assign({ headers: getHeaders() }, options || {}));
    let data = null;
    try { data = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok || (data && data.error)) {
      const err = new Error((data && data.message) || ("API HTTP " + res.status));
      err.status = res.status;
      err.code = data && data.code;
      throw err;
    }
    return data;
  }

  // Replace array contents in place: products.js helpers (getBySlug, getById,
  // getByCat, related…) close over the original arrays, so reassigning
  // BODI.PRODUCTS would leave them reading the static fallback catalog.
  function replaceInPlace(target, items) {
    target.splice(0, target.length, ...items);
    return target;
  }

  // 2. Canonical model passthrough (kept for templates that call transformProduct)
  function transformProduct(p) {
    if (!p) return p;
    const colors = Array.isArray(p.colors) && p.colors.length
      ? p.colors.map(c => (c && c.b) ? c : (global.BODI ? global.BODI.resolveColor(c) : c))
      : [global.BODI ? global.BODI.resolveColor(p.color || "cream") : { slug: "cream", n: "Krem", b: "#f1ede7" }];
    return Object.assign({}, p, {
      colors: colors,
      color: p.color || (colors[0] && colors[0].slug) || "cream",
      sizes: (Array.isArray(p.sizes) && p.sizes.length) ? p.sizes : ((global.BODI && global.BODI.SIZES) || []),
      images: (Array.isArray(p.images) && p.images.length) ? p.images : [p.image],
      reviews: Number(p.reviews) || 0
    });
  }

  // 3. Bodi backend adapter
  const BodiAdapter = {
    settings: null,
    categories: null,

    async fetchSettings() {
      try {
        const s = await request("/settings");
        BodiAdapter.settings = s;
        if (s && s.whatsapp) {
          WHATSAPP_NUMBER = s.whatsapp;
          apiFacade.WHATSAPP_NUMBER = s.whatsapp;
        }
        window.dispatchEvent(new CustomEvent("bodi:settings-loaded", { detail: s }));
        return s;
      } catch (err) {
        console.warn("[Bodi API] Settings unavailable:", err.message);
        return null;
      }
    },

    // Products
    async fetchProducts() {
      try {
        const data = await request("/products");
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map(transformProduct);
          if (global.BODI) {
            replaceInPlace(global.BODI.PRODUCTS, mapped);
            window.dispatchEvent(new CustomEvent("bodi:products-updated", { detail: global.BODI.PRODUCTS }));
          }
          return mapped;
        }
      } catch (err) {
        console.warn("[Bodi API] Backend offline, using fallback catalog:", err.message);
      }
      return global.BODI ? global.BODI.PRODUCTS : [];
    },

    async fetchProduct(slug) {
      return transformProduct(await request("/products/" + encodeURIComponent(slug)));
    },

    // Categories
    async fetchCategories() {
      try {
        const data = await request("/categories");
        if (Array.isArray(data) && data.length > 0) {
          BodiAdapter.categories = data;
          if (global.BODI && global.BODI.CAT_NAMES) {
            data.forEach(c => { global.BODI.CAT_NAMES[c.slug] = c.name; });
            window.dispatchEvent(new CustomEvent("bodi:categories-updated", { detail: data }));
          }
          return data;
        }
      } catch (err) {
        console.warn("[Bodi API] Could not fetch categories:", err.message);
      }
      return [];
    },

    // Reviews
    async fetchReviews(productId) {
      try {
        const data = await request("/reviews" + (productId ? "?product_id=" + encodeURIComponent(productId) : ""));
        if (Array.isArray(data)) {
          if (!productId && global.BODI && data.length > 0) {
            replaceInPlace(global.BODI.REVIEWS, data);
            window.dispatchEvent(new CustomEvent("bodi:reviews-updated", { detail: global.BODI.REVIEWS }));
          }
          return data;
        }
      } catch (err) {
        console.warn("[Bodi API] Error fetching reviews:", err.message);
      }
      return (!productId && global.BODI) ? global.BODI.REVIEWS : [];
    },

    // `photos` (optional): array of Blob/File — sent as multipart to /reviews/upload.
    async submitReview(payload, photos) {
      let data;
      if (photos && photos.length) {
        const fd = new FormData();
        Object.keys(payload || {}).forEach(k => { if (payload[k] != null) fd.append(k, String(payload[k])); });
        photos.forEach((f, i) => fd.append("photos", f, f.name || ("photo-" + (i + 1) + ".jpg")));
        data = await request("/reviews/upload", { method: "POST", body: fd, headers: { "Accept": "application/json" } });
      } else {
        data = await request("/reviews", { method: "POST", body: JSON.stringify(payload) });
      }
      if (data.review && global.BODI && Array.isArray(global.BODI.REVIEWS)) {
        const exists = global.BODI.REVIEWS.some(r => r.id === data.review.id);
        if (!exists) {
          global.BODI.REVIEWS.unshift(data.review);
          window.dispatchEvent(new CustomEvent("bodi:reviews-updated", { detail: global.BODI.REVIEWS }));
        }
      }
      return data;
    },

    // Orders & Checkout
    async submitCheckout(payload) {
      return request("/orders", { method: "POST", body: JSON.stringify(payload) });
    },

    async trackOrder(orderId, phone) {
      const q = "?order_id=" + encodeURIComponent(orderId) + (phone ? "&phone=" + encodeURIComponent(phone) : "");
      return request("/orders/track" + q);
    },

    async validateCoupon(code, subtotal) {
      return request("/coupons/validate", { method: "POST", body: JSON.stringify({ code: code, subtotal: subtotal }) });
    },

    // Blog
    async fetchPosts() {
      try {
        const data = await request("/posts");
        return (data || []).map(post => ({
          id: post.id,
          slug: post.slug,
          title: post.title,
          cat: post.cat || "Geyim",
          excerpt: post.excerpt,
          content: post.content,
          date: post.date,
          image: post.cardImage || post.image,
          imageLarge: post.image,
          imageAlt: post.imageAlt,
          read: post.read || 3,
          publishedAt: post.publishedAt
        }));
      } catch (err) {
        console.warn("[Bodi API] Error fetching posts:", err.message);
        return [];
      }
    },

    // Contact
    async submitContact(payload) {
      return request("/contact", { method: "POST", body: JSON.stringify(payload) });
    },

    // Homepage & Dynamic Content
    async fetchHomepage() {
      // 1. Instant cache retrieval
      try {
        const cached = localStorage.getItem("bodi_homepage_data");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.hero) {
            global.BODI_HOMEPAGE = parsed;
            window.dispatchEvent(new CustomEvent("bodi:homepage-loaded", { detail: parsed }));
          }
        }
      } catch (e) {}

      // 2. Network fetch
      try {
        const json = await request("/homepage");
        if (json && json.success && json.data) {
          global.BODI_HOMEPAGE = json.data;
          try {
            localStorage.setItem("bodi_homepage_data", JSON.stringify(json.data));
          } catch (e) {}
          window.dispatchEvent(new CustomEvent("bodi:homepage-loaded", { detail: json.data }));
          window.dispatchEvent(new CustomEvent("bodi:homepage-updated", { detail: json.data }));
          return json.data;
        }
      } catch (err) {
        console.warn("[Bodi API] Homepage fetch fallback:", err.message);
      }
      return global.BODI_HOMEPAGE || null;
    },

    async fetchSeo(type, slug) {
      return request("/seo?type=" + encodeURIComponent(type) + "&slug=" + encodeURIComponent(slug || ""));
    }
  };

  // 4. WhatsApp Direct Buy Integrations
  function productLink(origin, slug) {
    return `${origin}/product.html?p=${encodeURIComponent(slug)}`;
  }

  function getWhatsAppBuyUrl(product, size, color, qty) {
    const count = qty || 1;
    const origin = (typeof window !== 'undefined' && window.location.origin) || "https://bodi.az";
    const slug = product.slug || product.id || "bodi";
    const pageUrl = productLink(origin, slug);
    const priceText = product.price ? product.price + " ₼" : "";
    const totalLine = product.price ? (Number(product.price) * count).toFixed(2) + " ₼" : "";
    const colorObj = typeof color === 'object' ? color : (product.colors || []).find(c => c.slug === color);
    const colorLabel = (colorObj && colorObj.n) || color || "";

    let msg = `Salam, Bodi.az saytından bu məhsulu sifariş etmək istəyirəm:\n\n`;
    msg += `🛍️ *Məhsul:* ${product.name}\n`;
    msg += `🔗 *Məhsul Linki:* ${pageUrl}\n`;
    if (colorLabel) msg += `🎨 *Rəng:* ${colorLabel}\n`;
    if (size) msg += `📏 *Ölçü:* ${size}\n`;
    msg += `🔢 *Say:* ${count} ədəd\n`;
    if (priceText) msg += `💰 *Qiymət:* ${priceText} (Cəmi: ${totalLine})\n`;
    if (product.material) msg += `🌿 *Material:* ${product.material}\n`;
    if (product.desc) {
      const cleanDesc = product.desc.replace(/<[^>]*>?/gm, "").trim().slice(0, 130);
      if (cleanDesc) msg += `📝 *Məhsul haqqında:* ${cleanDesc}...\n`;
    }
    msg += `\nZəhmət olmasa çatdırılma üçün qeydə alasınız.`;

    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
  }

  function getWhatsAppCartUrl(cartItems, total) {
    const origin = (typeof window !== 'undefined' && window.location.origin) || "https://bodi.az";
    let msg = `Salam, Bodi.az saytından səbətimdəki məhsulları sifariş etmək istəyirəm:\n\n`;
    cartItems.forEach((it, idx) => {
      const p = it.product;
      const slug = p.slug || p.id;
      const link = productLink(origin, slug);
      const colorObj = typeof it.item.color === 'object' ? it.item.color : (p.colors || []).find(c => c.slug === it.item.color);
      const colorLabel = (colorObj && colorObj.n) || it.item.color || '';
      msg += `*${idx + 1}. ${p.name}*\n`;
      msg += `   🔗 Link: ${link}\n`;
      msg += `   📦 Detallar: ${it.item.qty} ədəd${it.item.size ? ' | Ölçü: ' + it.item.size : ''}${colorLabel ? ' | Rəng: ' + colorLabel : ''}\n`;
      if (p.material) msg += `   🌿 Material: ${p.material}\n`;
      msg += `   💰 Məbləğ: ${it.line.toFixed(2)} ₼\n\n`;
    });
    msg += `─────────────────────\n`;
    msg += `💵 *Yekun Məbləğ:* ${Number(total || 0).toFixed(2)} ₼\n\n`;
    msg += `Zəhmət olmasa çatdırılma üçün sifarişimi qeydə alasınız.`;
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
  }

  function getWhatsAppOrderUrl(orderData) {
    const origin = (typeof window !== 'undefined' && window.location.origin) || "https://bodi.az";
    let msg = `Salam, Bodi.az saytında sifariş rəsmiləşdirdim:\n\n`;
    msg += `📋 *Sifariş №:* #${orderData.order_id}\n`;
    msg += `👤 *Müştəri:* ${orderData.name}\n`;
    msg += `📞 *Telefon:* ${orderData.phone}\n`;
    msg += `📍 *Ünvan:* ${orderData.city ? orderData.city + ', ' : ''}${orderData.address}\n\n`;
    msg += `*Sifariş edilən məhsullar:*\n`;
    (orderData.items || []).forEach((it, idx) => {
      const link = it.slug ? productLink(origin, it.slug) : '';
      msg += `${idx + 1}. ${it.name || it.slug} — ${it.qty} ədəd${it.size ? ' (' + it.size + ')' : ''}${it.colorName || it.color ? ' (' + (it.colorName || it.color) + ')' : ''}\n`;
      if (link) msg += `   🔗 Link: ${link}\n`;
    });
    msg += `\n💰 *Yekun Məbləğ:* ${Number(orderData.total || 0).toFixed(2)} ₼\n`;
    msg += `\nZəhmət olmasa sifarişi qeydə alasınız.`;
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
  }

  // 5. Global API Facade (Decoupled Interface)
  const apiFacade = {
    version: "3.0.0",
    API_BASE,
    WHATSAPP_NUMBER,
    driver: "bodi",
    adapter: BodiAdapter,
    get settings() { return BodiAdapter.settings; },

    // Domain Modules
    products: {
      list: () => BodiAdapter.fetchProducts(),
      get: (slugOrId) => {
        if (!global.BODI) return null;
        return global.BODI.getBySlug(slugOrId) || global.BODI.getById(slugOrId);
      },
      fetch: (slug) => BodiAdapter.fetchProduct(slug),
      categories: () => BodiAdapter.fetchCategories()
    },

    reviews: {
      list: (productId) => BodiAdapter.fetchReviews(productId),
      submit: (payload, photos) => BodiAdapter.submitReview(payload, photos)
    },

    orders: {
      checkout: (payload) => BodiAdapter.submitCheckout(payload),
      track: (orderId, phone) => BodiAdapter.trackOrder(orderId, phone)
    },

    coupons: {
      validate: (code, subtotal) => BodiAdapter.validateCoupon(code, subtotal)
    },

    blog: {
      list: () => BodiAdapter.fetchPosts()
    },

    contact: {
      submit: (payload) => BodiAdapter.submitContact(payload)
    },

    homepage: {
      get: () => BodiAdapter.fetchHomepage()
    },

    seo: {
      get: (type, slug) => BodiAdapter.fetchSeo(type, slug)
    },

    whatsapp: {
      getBuyUrl: getWhatsAppBuyUrl,
      getCartUrl: getWhatsAppCartUrl,
      getOrderUrl: getWhatsAppOrderUrl
    },

    // Backward-compatible Top-level Methods
    fetchProducts: () => BodiAdapter.fetchProducts(),
    fetchCategories: () => BodiAdapter.fetchCategories(),
    fetchReviews: (productId) => BodiAdapter.fetchReviews(productId),
    submitReview: (payload, photos) => BodiAdapter.submitReview(payload, photos),
    submitCheckout: (payload) => BodiAdapter.submitCheckout(payload),
    trackOrder: (orderId, phone) => BodiAdapter.trackOrder(orderId, phone),
    validateCoupon: (code, subtotal) => BodiAdapter.validateCoupon(code, subtotal),
    fetchPosts: () => BodiAdapter.fetchPosts(),
    submitContact: (payload) => BodiAdapter.submitContact(payload),
    fetchHomepage: () => BodiAdapter.fetchHomepage(),
    getWhatsAppBuyUrl,
    getWhatsAppCartUrl,
    getWhatsAppOrderUrl,
    transformProduct
  };

  global.BODI_API = apiFacade;
  if (typeof window !== "undefined") {
    window.BODI_API = apiFacade;
  }

  // Auto-fetch data on initialization
  BodiAdapter.fetchSettings();
  BodiAdapter.fetchProducts();
  BodiAdapter.fetchCategories();
  BodiAdapter.fetchReviews();
  BodiAdapter.fetchHomepage();

  console.log("[Bodi API] v3.0.0 ready (Driver: Bodi / Endpoint: " + API + ")");

})(window);
