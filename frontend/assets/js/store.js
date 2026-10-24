/* Bodi.az — Cart + Wishlist store (localStorage) + toast */
(function (global) {
  "use strict";

  const CART_KEY = "bodi_cart_v1";
  const WISH_KEY = "bodi_wish_v1";

  function read(k) { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } }
  function write(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

  /* ---------- CART ---------- */
  // item: { id, qty, size, color }
  function getCart() { return read(CART_KEY); }

  function addToCart(id, qty, size, color) {
    const cart = getCart();
    const key = id + "|" + (size || "") + "|" + (color || "");
    const existing = cart.find(i => (i.id + "|" + (i.size || "") + "|" + (i.color || "")) === key);
    if (existing) existing.qty = (existing.qty || 1) + (qty || 1);
    else cart.push({ id: Number(id), qty: qty || 1, size: size || null, color: color || null });
    write(CART_KEY, cart);
    badge();
    toast("Səbətə əlavə edildi", "shopping_bag");
  }

  function updateQty(idx, qty) {
    const cart = getCart();
    if (!cart[idx]) return;
    cart[idx].qty = Math.max(1, qty);
    write(CART_KEY, cart);
    badge();
  }

  function removeItem(idx) {
    const cart = getCart();
    cart.splice(idx, 1);
    write(CART_KEY, cart);
    badge();
  }

  function clearCart() { write(CART_KEY, []); badge(); }

  function cartCount() { return getCart().reduce((s, i) => s + i.qty, 0); }

  // Variant-specific price (set per colour/size in the admin) wins over the product price.
  function unitPrice(p, item) {
    const v = (p.variants || []).find(v => v.color === item.color && v.size === item.size);
    return v && v.price != null ? Number(v.price) : p.price;
  }

  function cartDetailed() {
    return getCart().map((i, idx) => {
      const p = BODI.getById(i.id);
      return { idx, item: i, product: p, line: p ? unitPrice(p, i) * i.qty : 0 };
    }).filter(x => x.product);
  }

  // Shipping rules come from the backend settings (admin → Tənzimləmələr); the
  // server recomputes everything at checkout, this is only the preview.
  function shippingRules() {
    const s = global.BODI_API && global.BODI_API.settings;
    return {
      fee: s && s.shipping_fee != null ? Number(s.shipping_fee) : 5,
      threshold: s && s.free_shipping_threshold != null ? Number(s.free_shipping_threshold) : 50
    };
  }

  function cartTotals() {
    const rows = cartDetailed();
    const rules = shippingRules();
    const subtotal = rows.reduce((s, r) => s + r.line, 0);
    const shipping = subtotal === 0 ? 0 : (subtotal >= rules.threshold ? 0 : rules.fee);
    return { subtotal, shipping, total: subtotal + shipping, freeShipRemaining: Math.max(0, rules.threshold - subtotal) };
  }

  /* ---------- WISHLIST ---------- */
  function getWish() { return read(WISH_KEY); }
  function isWished(id) { return getWish().includes(Number(id)); }
  function toggleWish(id) {
    id = Number(id);
    const w = getWish();
    const i = w.indexOf(id);
    if (i >= 0) { w.splice(i, 1); toast("İstək siyahısından çıxarıldı", "favorite"); }
    else { w.push(id); toast("İstək siyahısına əlavə edildi", "favorite"); }
    write(WISH_KEY, w);
    document.querySelectorAll(`[data-wish="${id}"]`).forEach(btn => {
      btn.querySelector("span").classList.toggle("ms-fill");
      btn.querySelector("span").classList.toggle("text-secondary");
    });
    return i < 0;
  }

  /* ---------- ORDERS ---------- */
  const ORDERS_KEY = "bodi_orders_v1";
  function getOrders() { return read(ORDERS_KEY); }
  function saveOrder(order) {
    const orders = getOrders();
    // Prepend new order
    orders.unshift(order);
    write(ORDERS_KEY, orders);
  }

  /* ---------- BADGE ---------- */
  function badge() {
    const n = cartCount();
    document.querySelectorAll("[data-cart-count]").forEach(el => {
      el.textContent = n;
      el.classList.toggle("hidden", n === 0);
    });
  }

  /* ---------- TOAST ---------- */
  function toast(msg, icon) {
    let root = document.getElementById("toast-root");
    if (!root) { root = document.createElement("div"); root.id = "toast-root"; document.body.appendChild(root); }
    const t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = `<span class="material-symbols-outlined" style="font-size:18px">${icon || "check"}</span>${msg}`;
    root.appendChild(t);
    setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity .3s"; }, 2200);
    setTimeout(() => t.remove(), 2600);
  }

  global.STORE = {
    getCart, addToCart, updateQty, removeItem, clearCart, cartCount, cartDetailed, cartTotals,
    getWish, isWished, toggleWish,
    getOrders, saveOrder,
    badge, toast
  };
})(window);
