/* Bodi.az — Shared layout: header + footer + mobile nav injection, badges, global click handlers. */
(function () {
  "use strict";

  const path = location.pathname.split("/").pop() || "index.html";

  const NAV = [
    { href: "category.html?cat=bodi", label: "Bodilər", match: ["category.html"] },
    { href: "category.html?cat=tulum", label: "Tulumlar", match: [] },
    { href: "category.html?cat=dest", label: "Dəstlər", match: [] },
    { href: "category.html?filter=new", label: "Yeni kolleksiya", match: [] },
    { href: "category.html?filter=sale", label: "Endirim", match: [] },
    { href: "blog.html", label: "Bloq", match: ["blog.html", "blog-post.html"] }
  ];

  function navLink(n) {
    const active = n.match.includes(path) ? "text-primary font-bold border-b-2 border-primary pb-1" : "text-on-surface-variant hover:text-primary";
    return `<a class="${active} transition-colors font-body-md text-body-md" href="${n.href}">${n.label}</a>`;
  }

  const header = `
  <header class="bg-surface sticky top-0 z-40 shadow-sm w-full">
    <div class="flex justify-between items-center w-full px-gutter max-w-container-max mx-auto h-20">
      <a class="font-display-lg text-display-lg-mobile md:text-display-lg text-primary tracking-tight" href="index.html">Bodi.az</a>
      <nav class="hidden md:flex items-center gap-md">
        ${NAV.map(navLink).join("")}
      </nav>
      <div class="flex items-center gap-sm">
        <a href="category.html" aria-label="Axtarış" class="p-2 text-primary hover:bg-surface-container-low transition-all rounded-full"><span class="material-symbols-outlined">search</span></a>
        <a href="account.html" aria-label="Profil" class="p-2 text-primary hover:bg-surface-container-low transition-all rounded-full hidden md:block"><span class="material-symbols-outlined">person</span></a>
        <a href="account.html#wish" aria-label="İstək siyahısı" class="p-2 text-primary hover:bg-surface-container-low transition-all rounded-full relative">
          <span class="material-symbols-outlined">favorite</span>
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
        <span class="font-headline-md text-headline-md text-primary">Bodi.az</span>
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

  const mobNav = (active) => `
  <nav class="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center bg-surface px-2 py-3 shadow-[0px_-4px_20px_rgba(0,0,0,0.05)] rounded-t-xl md:hidden">
    ${[
      { i: "home", l: "Ana səhifə", href: "index.html", a: active === "home" },
      { i: "category", l: "Kateqoriya", href: "category.html", a: active === "category" },
      { i: "search", l: "Axtarış", href: "category.html", a: false },
      { i: "favorite", l: "İstək", href: "account.html#wish", a: false },
      { i: "shopping_bag", l: "Səbət", href: "cart.html", a: active === "cart", badge: true }
    ].map(t => `
      <a class="flex flex-col items-center justify-center ${t.a ? "text-primary bg-primary-fixed/30 rounded-full px-4 py-1" : "text-on-surface-variant"} transition-colors" href="${t.href}">
        <span class="material-symbols-outlined ${t.a ? 'ms-fill' : ''}">${t.i}</span>
        <span class="font-label-sm text-label-sm mt-1">${t.l}</span>
        ${t.badge ? `<span data-cart-count class="absolute right-2 top-1 bg-error text-on-error text-[8px] font-bold px-1 rounded-full hidden">0</span>` : ""}
      </a>`).join("")}
  </nav>`;

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
