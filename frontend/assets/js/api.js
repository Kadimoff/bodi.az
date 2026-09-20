/* ==============================================================================
   Bodi.az — Headless E-Commerce API Service & Decoupled Architecture
   
   Architecture:
   - Facade: BODI_API provides a platform-agnostic e-commerce client.
   - Adapter: WooCommerceAdapter translates between WordPress/WooCommerce REST APIs
     and Bodi canonical domain models.
   - Decoupling: If backend changes in the future (e.g., Medusa, Shopify, custom API),
     only the adapter needs to be replaced. All UI templates remain 100% agnostic.
   ============================================================================== */
(function (global) {
  "use strict";

  // 1. Configuration
  const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const DEFAULT_API_URL = isLocal ? 'http://localhost:8085' : 'https://api.bodi.az';
  const API_BASE = (window.BODI_CONFIG && window.BODI_CONFIG.apiUrl) || DEFAULT_API_URL;
  const WHATSAPP_NUMBER = (window.BODI_CONFIG && window.BODI_CONFIG.whatsapp) || "994501234567";

  function getHeaders() {
    return {
      "Content-Type": "application/json",
      "Accept": "application/json"
    };
  }

  // 2. Canonical Model Transformer
  // Transforms WooCommerce Store API product into Bodi Universal Product Model
  function transformProduct(p) {
    const div = Math.pow(10, (p.prices && p.prices.currency_minor_unit) || 2);
    const rawPrice = p.prices ? Number(p.prices.price) / div : 0;
    const rawRegular = p.prices ? Number(p.prices.regular_price) / div : 0;
    const isSale = rawRegular > rawPrice && rawPrice > 0;

    // Categories
    const categories = (p.categories || []).map(c => ({
      id: c.id,
      slug: c.slug,
      name: c.name
    }));
    const catSlug = (categories[0] && categories[0].slug) || "bodi";

    // Dynamic Attributes Extraction (Colors, Material, Sizes)
    const attrs = p.attributes || [];

    // Colors: support pa_color, pa_reng, Rəng, Color, etc.
    const colorAttr = attrs.find(a => {
      const n = (a.name || "").toLowerCase();
      return n === "rəng" || n === "reng" || n === "color" || n === "colour" ||
             a.taxonomy === "pa_color" || a.taxonomy === "pa_reng";
    });

    let productColors = [];
    if (colorAttr && Array.isArray(colorAttr.terms) && colorAttr.terms.length > 0) {
      productColors = colorAttr.terms.map(t => {
        const resolved = global.BODI ? global.BODI.resolveColor(t.name || t.slug) : { slug: t.slug, n: t.name, b: "#f1ede7" };
        return {
          slug: t.slug || resolved.slug,
          n: t.name || resolved.n,
          b: resolved.b,
          a: resolved.a,
          label: resolved.label
        };
      });
    } else if (colorAttr && Array.isArray(colorAttr.options) && colorAttr.options.length > 0) {
      productColors = colorAttr.options.map(opt => {
        return global.BODI ? global.BODI.resolveColor(opt) : { slug: opt, n: opt, b: "#f1ede7" };
      });
    }

    if (productColors.length === 0) {
      const fallbackKey = p.color || "cream";
      const resolved = global.BODI ? global.BODI.resolveColor(fallbackKey) : { slug: fallbackKey, n: "Krem", b: "#f1ede7" };
      productColors = [resolved];
    }

    const primaryColor = productColors[0].slug;

    // Sizes: support pa_size, pa_olcu, Ölçü, Size, etc.
    const sizeAttr = attrs.find(a => {
      const n = (a.name || "").toLowerCase();
      return n === "ölçü" || n === "olcu" || n === "size" ||
             a.taxonomy === "pa_size" || a.taxonomy === "pa_olcu";
    });

    let productSizes = [];
    if (sizeAttr && Array.isArray(sizeAttr.terms) && sizeAttr.terms.length > 0) {
      productSizes = sizeAttr.terms.map(t => t.name || t.slug);
    } else if (sizeAttr && Array.isArray(sizeAttr.options) && sizeAttr.options.length > 0) {
      productSizes = sizeAttr.options;
    }
    if (productSizes.length === 0) {
      productSizes = (global.BODI && global.BODI.SIZES) ? global.BODI.SIZES : ["0-3 ay", "3-6 ay", "6-9 ay", "9-12 ay", "12-18 ay"];
    }

    // Material
    const matAttr = attrs.find(a => {
      const n = (a.name || "").toLowerCase();
      return n === "material" || a.taxonomy === "pa_material";
    });
    const material = (matAttr && matAttr.terms && matAttr.terms[0] && matAttr.terms[0].name) ||
                     (matAttr && matAttr.options && matAttr.options[0]) ||
                     "100% Orqanik Pambıq";

    const cleanDesc = (p.description || p.short_description || "")
      .replace(/<[^>]*>?/gm, "").trim();

    // Image handling: WP media upload or local high-res fallback
    let imgSrc = "";
    let galleryImages = [];
    if (p.images && p.images.length > 0) {
      imgSrc = p.images[0].src;
      galleryImages = p.images.map(img => img.src);
    } else {
      imgSrc = `assets/images/products/${p.slug}.jpg`;
      galleryImages = [imgSrc];
    }

    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      cat: catSlug,
      categories: categories,
      material: material,
      price: rawPrice,
      old: isSale ? rawRegular : null,
      color: primaryColor,
      colors: productColors,
      sizes: productSizes,
      image: imgSrc,
      images: galleryImages,
      rating: Math.round(Number(p.average_rating) || 5),
      reviews: Number(p.review_count) || 24,
      badge: isSale ? `-${Math.round((1 - rawPrice / rawRegular) * 100)}%` : (p.on_sale ? "Endirim" : (p.is_new ? "Yeni" : "")),
      isNew: !isSale,
      desc: cleanDesc,
      inStock: p.is_in_stock !== false,
      sku: p.sku || p.slug,
      wpProduct: p
    };
  }

  // 3. WooCommerce Adapter Implementation
  const WooCommerceAdapter = {
    // Products
    async fetchProducts() {
      try {
        const res = await fetch(`${API_BASE}/wp-json/wc/store/v1/products?per_page=100`, {
          headers: getHeaders()
        });
        if (!res.ok) throw new Error("WP API HTTP " + res.status);
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map(transformProduct);
          if (global.BODI) {
            global.BODI.PRODUCTS = mapped;
            window.dispatchEvent(new CustomEvent("bodi:products-updated", { detail: mapped }));
          }
          return mapped;
        }
      } catch (err) {
        console.warn("[Bodi API] WordPress API offline, using fallback catalog:", err.message);
      }
      return global.BODI ? global.BODI.PRODUCTS : [];
    },

    // Categories
    async fetchCategories() {
      try {
        const res = await fetch(`${API_BASE}/wp-json/wc/store/v1/products/categories`, {
          headers: getHeaders()
        });
        if (!res.ok) throw new Error("WP API HTTP " + res.status);
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          if (global.BODI && global.BODI.CAT_NAMES) {
            data.forEach(c => {
              global.BODI.CAT_NAMES[c.slug] = c.name;
            });
            window.dispatchEvent(new CustomEvent("bodi:categories-updated", { detail: data }));
          }
          return data;
        }
      } catch (err) {
        console.warn("[Bodi API] Could not fetch categories from WP:", err.message);
      }
      return [];
    },

    // Reviews
    async fetchReviews(productId) {
      try {
        const url = `${API_BASE}/wp-json/bodi/v1/reviews${productId ? '?product_id=' + encodeURIComponent(productId) : ''}`;
        const res = await fetch(url, { headers: getHeaders() });
        if (!res.ok) throw new Error("API HTTP " + res.status);
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          if (!productId && global.BODI) {
            global.BODI.REVIEWS = data;
            window.dispatchEvent(new CustomEvent("bodi:reviews-updated", { detail: data }));
          }
          return data;
        }
      } catch (err) {
        console.warn("[Bodi API] Error fetching reviews from WP:", err.message);
      }
      return (!productId && global.BODI) ? global.BODI.REVIEWS : [];
    },

    async submitReview(payload) {
      const res = await fetch(`${API_BASE}/wp-json/bodi/v1/reviews`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || data.code) {
        throw new Error(data.message || "Rəy göndərilə bilmədi.");
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
      const res = await fetch(`${API_BASE}/wp-json/bodi/v1/checkout`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || data.code) {
        throw new Error(data.message || "Sifariş zamanı xəta baş verdi.");
      }
      return data;
    },

    async trackOrder(orderId) {
      const res = await fetch(`${API_BASE}/wp-json/bodi/v1/track-order?order_id=${encodeURIComponent(orderId)}`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (!res.ok || data.code) {
        throw new Error(data.message || "Sifariş tapılmadı.");
      }
      return data;
    },

    // Blog
    async fetchPosts() {
      try {
        const res = await fetch(`${API_BASE}/wp-json/wp/v2/posts?_embed&per_page=20`, {
          headers: getHeaders()
        });
        if (!res.ok) throw new Error("WP Posts API error");
        const data = await res.json();
        return data.map(post => {
          let catName = "Geyim";
          if (post._embedded && post._embedded['wp:term'] && post._embedded['wp:term'][0] && post._embedded['wp:term'][0][0]) {
            catName = post._embedded['wp:term'][0][0].name;
          }
          let featuredImg = "";
          if (post._embedded && post._embedded['wp:featuredmedia'] && post._embedded['wp:featuredmedia'][0]) {
            featuredImg = post._embedded['wp:featuredmedia'][0].source_url;
          }
          return {
            id: post.id,
            slug: post.slug,
            title: post.title.rendered,
            cat: catName,
            excerpt: post.excerpt.rendered.replace(/<[^>]*>?/gm, "").trim(),
            content: post.content.rendered,
            date: new Date(post.date).toLocaleDateString("az-AZ", { day: 'numeric', month: 'short', year: 'numeric' }),
            image: featuredImg,
            read: 5
          };
        });
      } catch (err) {
        console.warn("[Bodi API] Error fetching posts:", err.message);
        return [];
      }
    },

    // Contact
    async submitContact(payload) {
      const res = await fetch(`${API_BASE}/wp-json/bodi/v1/contact`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || data.code) {
        throw new Error(data.message || "Mesaj göndərilə bilmədi.");
      }
      return data;
    }
  };

  // 4. WhatsApp Direct Buy Integrations
  function getWhatsAppBuyUrl(product, size, color, qty) {
    const count = qty || 1;
    const origin = (typeof window !== 'undefined' && window.location.origin) || "https://bodi.az";
    const slug = product.slug || product.id || "bodi";
    const pageUrl = `${origin}/product.html?slug=${encodeURIComponent(slug)}`;
    const priceText = product.price ? product.price + " ₼" : "";
    const totalLine = product.price ? (Number(product.price) * count).toFixed(2) + " ₼" : "";
    const colorLabel = (typeof color === 'object' ? color.n : color) || "";
    
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
      const link = `${origin}/product.html?slug=${encodeURIComponent(slug)}`;
      const colorLabel = (typeof it.item.color === 'object' ? it.item.color.n : it.item.color) || '';
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
      const link = it.slug ? `${origin}/product.html?slug=${encodeURIComponent(it.slug)}` : '';
      msg += `${idx + 1}. ${it.name || it.slug} — ${it.qty} ədəd${it.size ? ' (' + it.size + ')' : ''}${it.color ? ' (' + it.color + ')' : ''}\n`;
      if (link) msg += `   🔗 Link: ${link}\n`;
    });
    msg += `\n💰 *Yekun Məbləğ:* ${Number(orderData.total || 0).toFixed(2)} ₼\n`;
    msg += `\nZəhmət olmasa sifarişi qeydə alasınız.`;
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
  }

  // 5. Global API Facade (Decoupled Interface)
  // This provides standardized modules so switching backends only requires changing WooCommerceAdapter
  const apiFacade = {
    version: "2.1.0",
    API_BASE,
    WHATSAPP_NUMBER,
    driver: "woocommerce",
    adapter: WooCommerceAdapter,

    // Domain Modules
    products: {
      list: () => WooCommerceAdapter.fetchProducts(),
      get: (slugOrId) => {
        if (!global.BODI) return null;
        return global.BODI.getBySlug(slugOrId) || global.BODI.getById(slugOrId);
      },
      categories: () => WooCommerceAdapter.fetchCategories()
    },

    reviews: {
      list: (productId) => WooCommerceAdapter.fetchReviews(productId),
      submit: (payload) => WooCommerceAdapter.submitReview(payload)
    },

    orders: {
      checkout: (payload) => WooCommerceAdapter.submitCheckout(payload),
      track: (orderId) => WooCommerceAdapter.trackOrder(orderId)
    },

    blog: {
      list: () => WooCommerceAdapter.fetchPosts()
    },

    contact: {
      submit: (payload) => WooCommerceAdapter.submitContact(payload)
    },

    whatsapp: {
      getBuyUrl: getWhatsAppBuyUrl,
      getCartUrl: getWhatsAppCartUrl,
      getOrderUrl: getWhatsAppOrderUrl
    },

    // Backward-compatible Top-level Methods
    fetchProducts: () => WooCommerceAdapter.fetchProducts(),
    fetchCategories: () => WooCommerceAdapter.fetchCategories(),
    fetchReviews: (productId) => WooCommerceAdapter.fetchReviews(productId),
    submitReview: (payload) => WooCommerceAdapter.submitReview(payload),
    submitCheckout: (payload) => WooCommerceAdapter.submitCheckout(payload),
    trackOrder: (orderId) => WooCommerceAdapter.trackOrder(orderId),
    fetchPosts: () => WooCommerceAdapter.fetchPosts(),
    submitContact: (payload) => WooCommerceAdapter.submitContact(payload),
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
  WooCommerceAdapter.fetchProducts();
  WooCommerceAdapter.fetchCategories();
  WooCommerceAdapter.fetchReviews();

  console.log("[Bodi API] v2.1.0 ready (Driver: WooCommerce / Endpoint: " + API_BASE + ")");

})(window);
