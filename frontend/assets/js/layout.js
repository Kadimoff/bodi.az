/* Bodi.az — Shared layout: header + footer + mobile nav injection, badges, global click handlers. */
(function () {
  "use strict";

  const path = location.pathname.split("/").pop() || "index.html";
  const currentFull = path + location.search;

  // Category entries are replaced by the live catalog (Admin → Kateqoriyalar) once it loads,
  // so a new category (e.g. "Dəstlər") shows up in the menu as soon as it has products.
  const NAV_CATS = [
    { href: "category.html?cat=bodi", label: "Bodilər" },
    { href: "category.html?cat=tulum", label: "Tulumlar" },
    { href: "category.html?cat=dest", label: "Çaplı Bodilər" }
  ];
  const NAV = [
    { href: "category.html?filter=sale", label: "Endirim" },
    { href: "reviews.html", label: "Rəylər" },
    { href: "blog.html", label: "Bloq" }
  ];

  function navLink(n) {
    let active = false;
    if (n.href === currentFull) {
      active = true;
    } else if (!n.href.includes("?") && (path === n.href || (n.href === "blog.html" && path === "blog-post.html"))) {
      active = true;
    }
    const activeClass = active ? "text-primary font-bold border-b-2 border-primary pb-1" : "text-on-surface-variant hover:text-primary";
    return `<a class="${activeClass} transition-colors font-body-md text-body-md" href="${n.href}">${n.label}</a>`;
  }

  const header = `
  <header class="bg-surface sticky top-0 z-40 shadow-sm w-full">
    <div class="flex justify-between items-center w-full px-3 sm:px-4 md:px-gutter max-w-container-max mx-auto h-16 md:h-20">
      <div class="flex items-center gap-1 min-w-0">
        <button type="button" data-drawer-open aria-label="Menyunu aç" aria-controls="mobile-drawer" aria-expanded="false" class="md:hidden -ml-2 p-2 text-primary hover:bg-surface-container-low rounded-full transition-colors">
          <span class="material-symbols-outlined" style="font-size:28px">menu</span>
        </button>
        <a class="flex items-center gap-2 md:gap-2.5 min-w-0 font-display-lg text-[26px] leading-8 font-bold md:text-display-lg text-primary tracking-tight" href="index.html" aria-label="Bodi.az — ana səhifə">
          <img src="assets/images/brand/logo-160.png" alt="Bodi.az loqosu" width="56" height="56" class="w-10 h-10 md:w-14 md:h-14 flex-shrink-0" decoding="async">
          <span>Bodi.az</span>
        </a>
      </div>
      <nav class="hidden md:flex items-center gap-md">
        <span data-nav-cats class="contents">${NAV_CATS.map(navLink).join("")}</span>
        ${NAV.map(navLink).join("")}
      </nav>
      <div class="flex items-center gap-1 md:gap-sm flex-shrink-0">
        <a href="category.html?focus=search" aria-label="Axtarış" class="hidden md:inline-flex p-2 text-primary hover:bg-surface-container-low transition-all rounded-full"><span class="material-symbols-outlined">search</span></a>
        <a href="wishlist.html" aria-label="İstək siyahısı" class="p-2 text-primary hover:bg-surface-container-low transition-all rounded-full relative">
          <span class="material-symbols-outlined${path === "wishlist.html" ? " ms-fill" : ""}">favorite</span>
          <span data-wish-count class="absolute top-1 right-1 bg-secondary text-on-secondary font-label-sm text-[10px] rounded-full min-w-4 h-4 px-1 flex items-center justify-center hidden">0</span>
        </a>
        <a href="cart.html" aria-label="Səbət" class="p-2 text-primary hover:bg-surface-container-low transition-all rounded-full relative">
          <span class="material-symbols-outlined">shopping_cart</span>
          <span data-cart-count class="absolute top-1 right-1 bg-error text-on-error font-label-sm text-[10px] rounded-full w-4 h-4 flex items-center justify-center hidden">0</span>
        </a>
      </div>
    </div>
  </header>`;

  const footer = `
  <footer class="bg-surface-container-low w-full pt-xl pb-32 md:pb-xl mt-xl border-t border-surface-dim/20">
    <div class="grid grid-cols-1 md:grid-cols-4 gap-md px-gutter max-w-container-max mx-auto">
      <div class="space-y-4 col-span-1">
        <a href="index.html" class="flex items-center gap-2.5 font-headline-md text-headline-md text-primary">
          <img src="assets/images/brand/logo-160.png" alt="Bodi.az loqosu" width="48" height="48" class="w-12 h-12 flex-shrink-0" loading="lazy" decoding="async">
          <span>Bodi.az</span>
        </a>
        <p class="font-body-sm text-body-sm text-on-surface-variant max-w-xs">Körpələrinizin rahatlığı və təhlükəsizliyi üçün ən yaxşı materiallardan hazırlanmış geyimlər. Nurtured Comfort.</p>
        <div class="flex gap-3 pt-2 text-on-surface-variant">
          <a href="#" class="hover:text-primary transition-colors"><span class="material-symbols-outlined">photo_camera</span></a>
          <a href="#" class="hover:text-primary transition-colors"><span class="material-symbols-outlined">share</span></a>
          <a href="#" class="hover:text-primary transition-colors"><span class="material-symbols-outlined">mail</span></a>
        </div>
      </div>
      <div class="col-span-1">
        <h4 class="font-headline-sm text-headline-sm text-primary mb-4">Şirkət</h4>
        <ul class="space-y-2">
          <li><a class="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors" href="about.html">Haqqımızda</a></li>
          <li><a class="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors" href="reviews.html">Müştəri Rəyləri</a></li>
          <li><a class="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors" href="contact.html">Əlaqə</a></li>
          <li><a class="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors" href="contact.html#stores">Mağazalar</a></li>
          <li><a class="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors" href="blog.html">Bloq</a></li>
        </ul>
      </div>
      <div class="col-span-1">
        <h4 class="font-headline-sm text-headline-sm text-primary mb-4">Müştəri xidmətləri</h4>
        <ul class="space-y-2">
          <li><a class="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors" href="faq.html#cat-catdirilma">Çatdırılma</a></li>
          <li><a class="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors" href="faq.html#cat-odenis">Ödəniş</a></li>
          <li><a class="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors" href="faq.html#cat-qaytarma">Qaytarma</a></li>
          <li><a class="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors" href="faq.html#cat-olcu">Ölçü bələdçisi</a></li>
          <li><a class="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors" href="track-order.html">Sifarişi izlə</a></li>
        </ul>
      </div>
      <div class="col-span-1">
        <h4 class="font-headline-sm text-headline-sm text-primary mb-4">Xəbərlər və Endirimlər</h4>
        <p class="font-body-sm text-body-sm text-on-surface-variant mb-4">Yeni kolleksiyalar və endirimlərdən ilk xəbərdar olun.</p>
        <form class="flex flex-col gap-2" onsubmit="return STORE.toast('Abunə oldunuz — təşəkkürlər!','mail'),false">
          <input class="w-full px-4 py-3 rounded-lg border border-outline-variant bg-surface-container-lowest focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-body-sm text-body-sm placeholder:text-outline" placeholder="E-poçt ünvanınız" type="email" required>
          <button class="w-full px-4 py-3 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:bg-primary-container transition-colors shadow-sm" type="submit">Abunə ol</button>
        </form>
      </div>
    </div>
    <div class="px-gutter max-w-container-max mx-auto mt-xl pt-md border-t border-surface-dim/30 flex flex-col md:flex-row justify-between items-center gap-4">
      <p class="font-body-sm text-body-sm text-on-surface-variant">© 2024 Bodi.az. Bütün hüquqlar qorunur.</p>
      <div class="flex gap-2 text-outline">
        <span class="material-symbols-outlined text-[20px]">credit_card</span>
        <span class="material-symbols-outlined text-[20px]">account_balance</span>
        <span class="material-symbols-outlined text-[20px]">savings</span>
      </div>
    </div>
  </footer>`;

  const WA_LOGO_SVG = `<svg class="w-6 h-6 fill-[#25D366]" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>`;

  const mobNav = (active) => `
  <nav class="fixed bottom-0 left-0 right-0 z-50 flex items-stretch bg-surface px-1 pt-2 pb-2 shadow-[0px_-4px_20px_rgba(0,0,0,0.05)] rounded-t-xl md:hidden">
    ${[
      { i: "home", l: "Ana səhifə", href: "index.html", a: active === "home" },
      { i: "category", l: "Kolleksiya", href: "category.html", a: active === "category" },
      { i: "search", l: "Axtarış", href: "category.html?focus=search", a: false },
      { i: "shopping_bag", l: "Səbət", href: "cart.html", a: active === "cart", badge: true }
    ].map(t => `
      <a class="flex-1 min-w-0 flex flex-col items-center justify-center py-1 mx-0.5 rounded-2xl ${t.a ? "text-primary bg-primary-fixed/30" : "text-on-surface-variant"} transition-colors relative" href="${t.href}" ${t.external ? 'target="_blank" rel="noopener"' : ''}>
        <span class="material-symbols-outlined ${t.a ? 'ms-fill' : ''}">${t.i}</span>
        <span class="font-label-sm text-[11px] leading-4 mt-0.5 max-w-full truncate">${t.l}</span>
        ${t.badge ? `<span data-cart-count class="absolute left-1/2 ml-1.5 top-0 bg-error text-on-error text-[9px] leading-[14px] min-w-[14px] text-center font-bold px-1 rounded-full hidden">0</span>` : ""}
      </a>`).join("")}
  </nav>`;

  /* ---------- Mobile drawer (burger menu) ---------- */
  const STATIC_CATS = [
    { slug: "bodi", name: "Bodilər" },
    { slug: "tulum", name: "Tulumlar" },
    { slug: "dest", name: "Çaplı Bodilər" }
  ];

  function isCurrent(href) {
    return href === currentFull || (!href.includes("?") && path === href);
  }

  function drawerLink(href, label, icon, extra) {
    const on = isCurrent(href);
    return `<a href="${href}" class="flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${on ? "bg-primary-fixed/40 text-primary font-bold" : "text-on-surface hover:bg-surface-container-low"}"${on ? ' aria-current="page"' : ""}>
      <span class="material-symbols-outlined text-primary ${on ? "ms-fill" : ""}" style="font-size:22px">${icon}</span>
      <span class="flex-1 font-body-md text-body-md">${label}</span>
      ${extra || '<span class="material-symbols-outlined text-outline" style="font-size:20px">chevron_right</span>'}
    </a>`;
  }

  function categoryLinks(cats) {
    return cats.map(c => drawerLink(
      "category.html?cat=" + encodeURIComponent(c.slug),
      c.name,
      "checkroom",
      c.count != null ? `<span class="font-label-sm text-label-sm text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">${c.count}</span>` : ""
    )).join("");
  }

  const drawer = `
  <div id="mobile-drawer" class="fixed inset-0 z-[60] md:hidden pointer-events-none" aria-hidden="true">
    <div data-drawer-close class="absolute inset-0 bg-on-surface/40 opacity-0 transition-opacity duration-300" data-drawer-overlay></div>
    <aside role="dialog" aria-modal="true" aria-label="Menyu" class="absolute left-0 top-0 h-full w-[86%] max-w-[340px] bg-surface shadow-2xl -translate-x-full transition-transform duration-300 ease-out flex flex-col" data-drawer-panel>
      <div class="flex items-center justify-between px-4 h-20 border-b border-surface-variant/60 flex-shrink-0">
        <a href="index.html" class="flex items-center gap-2 font-headline-md text-headline-md text-primary">
          <img src="assets/images/brand/logo-160.png" alt="Bodi.az loqosu" width="40" height="40" class="w-10 h-10">
          <span>Bodi.az</span>
        </a>
        <button type="button" data-drawer-close aria-label="Menyunu bağla" class="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container-low rounded-full transition-colors">
          <span class="material-symbols-outlined" style="font-size:26px">close</span>
        </button>
      </div>
      <nav class="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Mobil menyu">
        <div>
          <p class="px-3 mb-1 font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant">Kateqoriyalar</p>
          <div data-drawer-cats>${categoryLinks(STATIC_CATS)}</div>
          ${drawerLink("category.html", "Bütün məhsullar", "grid_view")}
        </div>
        <div>
          <p class="px-3 mb-1 font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant">Kolleksiyalar</p>
          ${drawerLink("category.html?filter=sale", "Endirim", "sell")}
          ${drawerLink("wishlist.html", "İstək siyahısı", "favorite", '<span data-wish-count class="font-label-sm text-label-sm text-on-secondary bg-secondary px-2 py-0.5 rounded-full hidden">0</span>')}
        </div>
        <div>
          <p class="px-3 mb-1 font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant">Bodi.az</p>
          ${drawerLink("reviews.html", "Müştəri rəyləri", "reviews")}
          ${drawerLink("blog.html", "Bloq", "article")}
          ${drawerLink("about.html", "Haqqımızda", "info")}
          ${drawerLink("faq.html", "Tez-tez verilən suallar", "help")}
          ${drawerLink("track-order.html", "Sifarişi izlə", "local_shipping")}
          ${drawerLink("contact.html", "Əlaqə", "call")}
        </div>
      </nav>
      <div class="p-4 border-t border-surface-variant/60 flex-shrink-0">
        <a data-drawer-wa href="https://wa.me/994501234567" target="_blank" rel="noopener" class="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#25D366] text-white font-label-md text-label-md shadow-sm">
          ${WA_LOGO_SVG.replace("fill-[#25D366]", "fill-white")} WhatsApp ilə yazın
        </a>
      </div>
    </aside>
  </div>`;

  function setupDrawer() {
    const root = document.getElementById("mobile-drawer");
    if (!root) return;
    const panel = root.querySelector("[data-drawer-panel]");
    const overlay = root.querySelector("[data-drawer-overlay]");
    const toggles = document.querySelectorAll("[data-drawer-open]");
    let lastFocus = null;

    function setOpen(open) {
      root.classList.toggle("pointer-events-none", !open);
      root.setAttribute("aria-hidden", open ? "false" : "true");
      overlay.classList.toggle("opacity-0", !open);
      panel.classList.toggle("-translate-x-full", !open);
      document.body.style.overflow = open ? "hidden" : "";
      toggles.forEach(t => t.setAttribute("aria-expanded", String(open)));
      if (open) {
        lastFocus = document.activeElement;
        const wa = root.querySelector("[data-drawer-wa]");
        const num = (window.BODI_API && window.BODI_API.WHATSAPP_NUMBER) || "994501234567";
        if (wa) wa.href = "https://wa.me/" + num + "?text=" + encodeURIComponent("Salam, Bodi.az saytından məlumat almaq istəyirəm");
        setTimeout(() => { const c = root.querySelector("button[data-drawer-close]"); if (c) c.focus(); }, 50);
      } else if (lastFocus) {
        lastFocus.focus();
      }
    }

    toggles.forEach(t => t.addEventListener("click", () => setOpen(true)));
    root.addEventListener("click", (e) => {
      if (e.target.closest("[data-drawer-close]") || e.target.closest("a[href]")) setOpen(false);
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && root.getAttribute("aria-hidden") === "false") setOpen(false); });
    window.matchMedia("(min-width: 768px)").addEventListener("change", (mq) => { if (mq.matches) setOpen(false); });

    // Categories managed in the admin panel replace the static list
    // (whether they arrived before or after the drawer was built).
    function renderCats(list) {
      const cats = (list || []).filter(c => c.count > 0 || STATIC_CATS.some(s => s.slug === c.slug));
      const box = root.querySelector("[data-drawer-cats]");
      if (box && cats.length) box.innerHTML = categoryLinks(cats);
      const nav = document.querySelector("[data-nav-cats]");
      if (nav && cats.length) nav.innerHTML = cats.map(c => navLink({ href: "category.html?cat=" + encodeURIComponent(c.slug), label: c.name })).join("");
    }
    renderCats(window.BODI_API && window.BODI_API.adapter && window.BODI_API.adapter.categories);
    window.addEventListener("bodi:categories-updated", (e) => renderCats(e.detail));
  }

  /* ---------- Floating WhatsApp button (all pages) ---------- */
  const WA_TEXT = "Salam, Bodi.az saytından məhsullarla bağlı məlumat almaq istəyirəm";
  const fab = `
  <aside id="floating-wa" aria-label="Sürətli Əlaqə" class="fixed bottom-20 right-4 md:bottom-8 md:right-8 z-40 flex flex-col items-end gap-2">
    <a href="https://wa.me/994501234567?text=${encodeURIComponent(WA_TEXT)}" target="_blank" rel="noopener" aria-label="WhatsApp ilə yazın" class="lumen-btn lumen-wa group">
      <span class="lumen-btn-inner px-4 py-3 sm:px-5 sm:py-3.5">
        ${WA_LOGO_SVG.replace("fill-[#25D366]", "fill-white flex-shrink-0 transition-transform duration-300 group-hover:scale-110")}
        <span class="font-bold text-sm hidden sm:inline tracking-wide">WhatsApp ilə Sual Ver</span>
      </span>
    </a>
  </aside>`;

  // Every wa.me link follows the number set in the admin panel (Tənzimləmələr).
  function applyWhatsAppNumber() {
    const num = window.BODI_API && window.BODI_API.WHATSAPP_NUMBER;
    if (!num) return;
    document.querySelectorAll('#floating-wa a[href*="wa.me/"], [data-drawer-wa]').forEach(a => {
      a.href = a.href.replace(/wa\.me\/\d+/, "wa.me/" + num);
    });
  }

  // Map page → mobile active key
  const MOB_KEY = {
    "index.html": "home",
    "category.html": "category",
    "product.html": "category",
    "cart.html": "cart"
  };

  function inject() {
    const h = document.getElementById("site-header"); if (h) h.innerHTML = header;
    const f = document.getElementById("site-footer"); if (f) f.innerHTML = footer;
    const m = document.getElementById("mobile-nav");
    if (m) m.innerHTML = mobNav(MOB_KEY[path] || "");
    if (h && !document.getElementById("mobile-drawer")) {
      document.body.insertAdjacentHTML("beforeend", drawer);
      setupDrawer();
    }
    if (h && !document.getElementById("floating-wa")) {
      document.body.insertAdjacentHTML("beforeend", fab);
    }
    applyWhatsAppNumber();
    window.addEventListener("bodi:settings-loaded", applyWhatsAppNumber);

    // Global click delegation: add-to-cart + wishlist
    document.addEventListener("click", (e) => {
      const add = e.target.closest("[data-add]");
      if (add) { e.preventDefault(); STORE.addToCart(add.getAttribute("data-add"), 1); return; }
      const wish = e.target.closest("[data-wish]");
      if (wish) { e.preventDefault(); STORE.toggleWish(wish.getAttribute("data-wish")); return; }
    });

    // Restore correct wish state on any card hearts after render
    setTimeout(() => {
      document.querySelectorAll("[data-wish]").forEach(btn => {
        const id = Number(btn.getAttribute("data-wish"));
        if (STORE.isWished(id)) { btn.querySelector("span").classList.add("ms-fill", "text-secondary"); }
      });
      STORE.badge();
    }, 50);

    // Reveal-on-scroll
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { threshold: 0.08 });
    document.querySelectorAll(".reveal").forEach(el => io.observe(el));
  }

  document.addEventListener("DOMContentLoaded", inject);
})();
