/* Bodi.az — WooCommerce Store API Client
   Connects modern frontend to WordPress / WooCommerce Store API with seamless fallback. */
(function (global) {
  "use strict";

  // Determine API base URL
  const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const DEFAULT_API_URL = isLocal ? 'http://localhost:8085' : 'https://api.bodi.az';
  const API_BASE = (window.BODI_CONFIG && window.BODI_CONFIG.apiUrl) || DEFAULT_API_URL;

  const TOKEN_KEY = "bodi_cart_token_v1";
  const NONCE_KEY = "bodi_cart_nonce_v1";

  function getCartToken() { return localStorage.getItem(TOKEN_KEY) || ""; }
  function setCartToken(t) { if (t) localStorage.setItem(TOKEN_KEY, t); }
  function getNonce() { return localStorage.getItem(NONCE_KEY) || ""; }
  function setNonce(n) { if (n) localStorage.setItem(NONCE_KEY, n); }

  function getHeaders() {
    const h = { "Content-Type": "application/json" };
    const token = getCartToken();
    const nonce = getNonce();
    if (token) h["Cart-Token"] = token;
    if (nonce) h["Nonce"] = nonce;
    return h;
  }

  function handleHeaders(res) {
    const token = res.headers.get("Cart-Token") || res.headers.get("cart-token");
    const nonce = res.headers.get("Nonce") || res.headers.get("nonce");
    if (token) setCartToken(token);
    if (nonce) setNonce(nonce);
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

    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      cat: catSlug,
      material: material,
      price: rawPrice,
      old: isSale ? rawRegular : null,
      color: colorKey,
      rating: Math.round(Number(p.average_rating) || 5),
      reviews: Number(p.review_count) || (Math.floor(Math.random() * 50) + 20),
      badge: isSale ? `-${Math.round((1 - rawPrice / rawRegular) * 100)}%` : (p.on_sale ? "Endirim" : ""),
      isNew: !isSale,
      desc: cleanDesc,
      wpProduct: p
    };
  }

  /* ---------- API METHODS ---------- */

  // Load products from WooCommerce Store API
  async function fetchProducts() {
    try {
      const res = await fetch(`${API_BASE}/wp-json/wc/store/v1/products?per_page=100`, {
        headers: getHeaders()
      });
      if (!res.ok) throw new Error("WP API returned HTTP " + res.status);
      handleHeaders(res);
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
      console.warn("[Bodi API] WordPress API not reachable, using offline fallback data:", err.message);
    }
    return global.BODI ? global.BODI.PRODUCTS : [];
  }

  // Add item to WooCommerce Cart
  async function addToCart(productId, qty, variation) {
    try {
      const res = await fetch(`${API_BASE}/wp-json/wc/store/v1/cart/add-item`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          id: productId,
          quantity: qty || 1,
          variation: variation || []
        })
      });
      handleHeaders(res);
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn("[Bodi API] Cart sync failed, staying with local storage:", err.message);
    }
    return null;
  }

  // Get current WooCommerce Cart
  async function getCart() {
    try {
      const res = await fetch(`${API_BASE}/wp-json/wc/store/v1/cart`, {
        headers: getHeaders()
      });
      handleHeaders(res);
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn("[Bodi API] Fetch cart failed:", err.message);
    }
    return null;
  }

  // Checkout submission
  async function checkout(orderData) {
    try {
      const res = await fetch(`${API_BASE}/wp-json/wc/store/v1/checkout`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(orderData)
      });
      handleHeaders(res);
      return await res.json();
    } catch (err) {
      console.error("[Bodi API] Checkout failed:", err);
      throw err;
    }
  }

  global.BODI_API = {
    API_BASE,
    fetchProducts,
    addToCart,
    getCart,
    checkout,
    transformProduct
  };

  // Auto-initialize products on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fetchProducts);
  } else {
    fetchProducts();
  }
})(window);
