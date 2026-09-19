/* Bodi.az — Real WooCommerce & WordPress Headless API Client
   Full integration for real products, checkout, coupons, order tracking, blog, and WhatsApp direct buy. */
(function (global) {
  "use strict";

  // Determine API base URL
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

  // Transform WooCommerce Store API product to Bodi frontend product format
  function transformProduct(p) {
    const div = Math.pow(10, (p.prices && p.prices.currency_minor_unit) || 2);
    const rawPrice = p.prices ? Number(p.prices.price) / div : 0;
    const rawRegular = p.prices ? Number(p.prices.regular_price) / div : 0;
    const isSale = rawRegular > rawPrice && rawPrice > 0;

    const catSlug = (p.categories && p.categories[0] && p.categories[0].slug) || "bodi";
    
    // Find attributes
    const colorAttr = (p.attributes || []).find(a => a.name === "Rəng" || a.name.toLowerCase() === "color");
    const colorKey = (colorAttr && colorAttr.terms && colorAttr.terms[0] && colorAttr.terms[0].slug) || "cream";

    const matAttr = (p.attributes || []).find(a => a.name === "Material" || a.name.toLowerCase() === "material");
    const material = (matAttr && matAttr.terms && matAttr.terms[0] && matAttr.terms[0].name) || "100% Pambıq";

    const cleanDesc = (p.description || p.short_description || "")
      .replace(/<[^>]*>?/gm, "").trim();

    // Real image handling: WP media upload or local high-res product photo
    let imgSrc = "";
    if (p.images && p.images.length > 0 && p.images[0].src) {
      imgSrc = p.images[0].src;
    } else {
      imgSrc = `assets/images/products/${p.slug}.jpg`;
    }

    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      cat: catSlug,
      material: material,
      price: rawPrice,
      old: isSale ? rawRegular : null,
      color: colorKey,
      image: imgSrc,
      rating: Math.round(Number(p.average_rating) || 5),
      reviews: Number(p.review_count) || 24,
      badge: isSale ? `-${Math.round((1 - rawPrice / rawRegular) * 100)}%` : (p.on_sale ? "Endirim" : ""),
      isNew: !isSale,
      desc: cleanDesc,
      wpProduct: p
    };
  }

  /* ---------- API METHODS ---------- */

  // Load real products from WooCommerce Store API
  async function fetchProducts() {
    try {
      const res = await fetch(`${API_BASE}/wp-json/wc/store/v1/products?per_page=100`, {
        headers: getHeaders()
      });
      if (!res.ok) throw new Error("WP API returned HTTP " + res.status);
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
      console.warn("[Bodi API] WordPress API unreachable, using offline fallback:", err.message);
    }
    return global.BODI ? global.BODI.PRODUCTS : [];
  }

  // Real Order Creation in WooCommerce
  async function submitCheckout(payload) {
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
  }

  // Real Order Tracking from WooCommerce
  async function trackOrder(orderId) {
    const res = await fetch(`${API_BASE}/wp-json/bodi/v1/track-order?order_id=${encodeURIComponent(orderId)}`, {
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok || data.code) {
      throw new Error(data.message || "Sifariş tapılmadı.");
    }
    return data;
  }

  // Real Blog Posts from WordPress
  async function fetchPosts() {
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
  }

  // Real Contact Form submission
  async function submitContact(payload) {
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

  // WhatsApp 1-Click Buy Link Generator
  function getWhatsAppBuyUrl(product, size, color, qty) {
    const count = qty || 1;
    const pageUrl = window.location.href;
    const priceText = product.price ? product.price + " ₼" : "";
    
    let msg = `Salam, Bodi.az saytından bu məhsulu sifariş etmək istəyirəm:\n\n`;
    msg += `🛍️ Məhsul: ${product.name}\n`;
    if (color) msg += `🎨 Rəng: ${color}\n`;
    if (size) msg += `📏 Ölçü: ${size}\n`;
    msg += `🔢 Say: ${count} ədəd\n`;
    if (priceText) msg += `💰 Qiymət: ${priceText}\n`;
    msg += `🔗 Link: ${pageUrl}\n\n`;
    msg += `Zəhmət olmasa çatdırılma üçün qeydə alasınız.`;

    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
  }

  // WhatsApp Cart Order Link Generator
  function getWhatsAppCartUrl(cartItems, total) {
    let msg = `Salam, Bodi.az saytından səbətimdəki məhsulları sifariş etmək istəyirəm:\n\n`;
    cartItems.forEach((it, idx) => {
      msg += `${idx + 1}. ${it.product.name} — ${it.item.qty} ədəd (${it.item.size || ''} / ${it.item.color || ''}) — ${it.line.toFixed(2)} ₼\n`;
    });
    msg += `\n💰 Yekun Məbləğ: ${total.toFixed(2)} ₼\n`;
    msg += `Zəhmət olmasa çatdırılma üçün qeydə alasınız.`;
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
  }

  // Fetch real reviews from WordPress / WooCommerce
  async function fetchReviews(productId) {
    try {
      const url = `${API_BASE}/wp-json/bodi/v1/reviews${productId ? '?product_id=' + encodeURIComponent(productId) : ''}`;
      const res = await fetch(url, { headers: getHeaders() });
      if (!res.ok) throw new Error("API error " + res.status);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        if (!productId && global.BODI) {
          global.BODI.REVIEWS = data;
          window.dispatchEvent(new CustomEvent("bodi:reviews-updated", { detail: data }));
        }
        return data;
      }
    } catch (err) {
      console.warn("[Bodi API] Error fetching reviews:", err.message);
    }
    return global.BODI ? global.BODI.REVIEWS : [];
  }

  // Submit real review to WordPress / WooCommerce
  async function submitReview(payload) {
    const res = await fetch(`${API_BASE}/wp-json/bodi/v1/reviews`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || data.code) {
      throw new Error(data.message || "Rəy göndərilə bilmədi.");
    }
    return data;
  }

  global.BODI_API = {
    API_BASE,
    WHATSAPP_NUMBER,
    fetchProducts,
    submitCheckout,
    trackOrder,
    fetchPosts,
    submitContact,
    fetchReviews,
    submitReview,
    getWhatsAppBuyUrl,
    getWhatsAppCartUrl,
    transformProduct
  };

  // Auto-fetch products and reviews on script load
  fetchProducts();
  fetchReviews();
})(window);
