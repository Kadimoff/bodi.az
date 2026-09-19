/* Bodi.az — Product catalog + soft SVG placeholder generator + renderers.
   Self-contained: no external image deps. Soft gradient "product" tiles
   follow the Serene Childhood warm palette. */
(function (global) {
  "use strict";

  const COLORS = {
    cream:  { a: "#fdf9f3", b: "#f1ede7", label: "#8a8478" },
    beige:  { a: "#efe8da", b: "#ddd0ba", label: "#8a7a5c" },
    sage:   { a: "#d4e0cf", b: "#b8ccb5", label: "#5f705c" },
    peach:  { a: "#fbe3d6", b: "#f6c7b0", label: "#a76a52" },
    terracotta:{ a: "#ecc6b3", b: "#d99e80", label: "#9a5238" },
    white:  { a: "#ffffff", b: "#eeece6", label: "#9a988f" },
    sky:    { a: "#d6e4ea", b: "#b6cbd6", label: "#54707e" },
    lavender:{ a: "#e2dceb", b: "#c9bcdf", label: "#6e5e8c" },
    mustard:{ a: "#efe2bd", b: "#dcc485", label: "#8a7334" },
    rose:   { a: "#f4d9da", b: "#ebb4b7", label: "#a65a5e" }
  };

  // Soft gradient SVG with a onesie silhouette + color name.
  function ph(colorKey, labelText) {
    const c = COLORS[colorKey] || COLORS.cream;
    const txt = (labelText || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750" viewBox="0 0 600 750">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${c.a}"/>
          <stop offset="1" stop-color="${c.b}"/>
        </linearGradient>
      </defs>
      <rect width="600" height="750" fill="url(#g)"/>
      <g fill="${c.label}" opacity="0.16">
        <path d="M240 300 h24 l20-22 a18 18 0 0 1 32 0 l20 22 h24 v70 l-26 12 v226 a18 18 0 0 1-18 18 h-52 a18 18 0 0 1-18-18 V382 l-26-12 z"/>
        <circle cx="262" cy="312" r="4"/>
        <circle cx="338" cy="312" r="4"/>
      </g>
      <text x="300" y="650" text-anchor="middle" font-family="Plus Jakarta Sans, sans-serif" font-size="26" font-weight="700" fill="${c.label}" opacity="0.55" letter-spacing="1">${txt}</text>
    </svg>`;
    return "data:image/svg+xml," + encodeURIComponent(svg);
  }

  // Wide hero / banner placeholder
  function phWide(colorKey, labelText) {
    const c = COLORS[colorKey] || COLORS.cream;
    const txt = (labelText || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="900" viewBox="0 0 1280 900">
      <defs><linearGradient id="gw" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${c.a}"/><stop offset="1" stop-color="${c.b}"/>
      </linearGradient></defs>
      <rect width="1280" height="900" fill="url(#gw)"/>
      <g fill="${c.label}" opacity="0.12">
        <circle cx="980" cy="260" r="220"/>
        <ellipse cx="300" cy="700" rx="260" ry="140"/>
      </g>
      <text x="640" y="480" text-anchor="middle" font-family="Plus Jakarta Sans, sans-serif" font-size="42" font-weight="700" fill="${c.label}" opacity="0.4" letter-spacing="2">${txt}</text>
    </svg>`;
    return "data:image/svg+xml," + encodeURIComponent(svg);
  }

  const SIZES = ["0-3 ay", "3-6 ay", "6-9 ay", "9-12 ay", "12-18 ay"];

  const PRODUCTS = [
    { id: 1, slug: "ag-pambiq-bodi", name: "Ağ Pambıq Bodi", cat: "bodi", material: "100% Orqanik Pambıq", price: 24.90, old: 35.00, color: "white", rating: 5, reviews: 124, badge: "-28%", isNew: false, desc: "Körpənizin həssas dərisi üçün xüsusi olaraq toxunmuş, nəfəs alan və yumşaq orqanik pambıqdan hazırlanmış bodi. Gündəlik istifadə üçün mükəmməl rahatlıq." },
    { id: 2, slug: "bej-uzunqol-bodi", name: "Bej Rəngli Uzunqol Bodi", cat: "bodi", material: "Orqanik Pambıq", price: 24.90, color: "beige", rating: 5, reviews: 88, badge: "Yeni", isNew: true, desc: "Yumşaq orqanik pambıqdan uzunqol bodi. Soyuq günlərdə rahat və isti saxlayır." },
    { id: 3, slug: "adacayi-qisaqol-bodi", name: "Adaçayı Rəngli Qısaqol Bodi", cat: "bodi", material: "100% Pambıq", price: 19.90, color: "sage", rating: 5, reviews: 56, desc: "Sakit adaçayı yaşıılında, incə naxışlı qısaqol bodi. Yay ayları üçün idealdır." },
    { id: 4, slug: "saftali-yay-bodisi", name: "Şaftalı Rəngli Yay Bodisi", cat: "bodi", material: "Kətan Qarışığı", price: 22.90, old: 28.90, color: "peach", rating: 4, reviews: 41, badge: "-20%", desc: "Şaftalı tonlarında, yüngül və nəfəs alan yay bodisi." },
    { id: 5, slug: "naxisli-ag-bodi", name: "Naxışlı Ağ Bodi", cat: "bodi", material: "Orqanik Pambıq", price: 26.50, color: "white", rating: 5, reviews: 73, desc: "Zeytun budağı naxışlı, incə zərif ağ bodi. Xüsusi günlər üçün." },
    { id: 6, slug: "terracotta-uzunqol-bodi", name: "Terrakotta Uzunqol Bodi", cat: "bodi", material: "100% Pambıq", price: 25.90, color: "terracotta", rating: 5, reviews: 39, isNew: true, badge: "Yeni", desc: "Terrakotta rəngli, payız üçün isti uzunqol bodi." },

    { id: 7, slug: "yumshaq-yeni-dogan-tulumu", name: "Yumşaq Yeni Doğulan Tulumu", cat: "tulum", material: "Orqanik Pambıq", price: 34.90, color: "cream", rating: 5, reviews: 102, badge: "Yeni", isNew: true, desc: "Yeni doğulanlar üçün yumşaq, fermuarlı bütün bədən tulumu. Rahat geyinmə və soyunma." },
    { id: 8, slug: "lavanta-yuxu-tulumu", name: "Lavanta Yuxu Tulumu", cat: "tulum", material: "100% Pambıq", price: 29.90, old: 38.00, color: "lavender", rating: 5, reviews: 67, badge: "-21%", desc: "Sakitləşdirici lavanta rəngində yuxu tulumu. Rahat bir gecə yuxusu üçün." },
    { id: 9, slug: "sage-double-tulum", name: "Adaçayı İki Parçalı Tulum", cat: "tulum", material: "Orqanik Pambıq", price: 39.90, color: "sage", rating: 5, reviews: 48, desc: "İki parçalı, praktik və isti. Alt dəyişdirmə üçün asanlıq." },
    { id: 10, slug: "seftali-fermuar-tulum", name: "Şaftalı Fermuarlı Tulum", cat: "tulum", material: "Kətan Qarışığı", price: 32.50, color: "peach", rating: 4, reviews: 35, desc: "Tam fermuarlı, yumşaq toxunuşlu gündəlik tulum." },

    { id: 11, slug: "ilkin-des-goyler", name: "İlkin Dəst — Göylər", cat: "dest", material: "100% Pambıq", price: 54.90, old: 69.00, color: "sky", rating: 5, reviews: 91, badge: "-20%", desc: "3 ədəd bodi + 1 tulumdan ibarət hədiyyəlik dəst. Yeni doğulanlar üçün ideal." },
    { id: 12, slug: "dest-sehrli-mevsumler", name: "Dəst — Sehrli Mövsümlər", cat: "dest", material: "Orqanik Pambıq", price: 59.90, color: "mustard", rating: 5, reviews: 44, badge: "Yeni", isNew: true, desc: "Hər fəsil üçün uyğun, 4 parçalı uniseks dəst." },
    { id: 13, slug: "dest-tebrik-nvaziş", name: "Dəst — Təbrik & Nəvaziş", cat: "dest", material: "Orqanik Pambıq", price: 49.90, color: "rose", rating: 5, reviews: 28, desc: "Zərif çəhrayı tonlarda, xüsusi günlər üçün 3 parçalı dəst." },

    { id: 14, slug: "org-pambiq-sapqa", name: "Orqanik Pambıq Şapqa", cat: "bodi", material: "100% Orqanik Pambıq", price: 12.90, color: "cream", rating: 5, reviews: 60, desc: "Yumşaq, qulaqları qoruyan nəfəs alan şapqa." },
    { id: 15, slug: "yum-alt-paltar", name: "Yumşaq Alt Paltar", cat: "bodi", material: "100% Pambıq", price: 18.90, old: 24.00, color: "sage", rating: 4, reviews: 33, badge: "-21%", desc: "Həssas dəri üçün yumşaq alt paltarı. Təmiz və təbii material." },
    { id: 16, slug: "pambiq-corab-desi", name: "Pambıq Çorab Dəsti (4 cüt)", cat: "bodi", material: "100% Pambıq", price: 14.90, color: "beige", rating: 5, reviews: 77, desc: "Kaydırmayan tabanlı, 4 cütlük yumşaq çorab dəsti." }
  ];

  const CAT_NAMES = {
    bodi: "Bodilər",
    tulum: "Tulumlar",
    dest: "Dəstlər"
  };

  function money(n) { return (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, "") + " ₼"; }

  function getBySlug(slug) { return PRODUCTS.find(p => p.slug === slug); }
  function getById(id) { return PRODUCTS.find(p => p.id === Number(id)); }
  function getByCat(cat) { return PRODUCTS.filter(p => p.cat === cat); }
  function getNew() { return PRODUCTS.filter(p => p.isNew); }
  function getSale() { return PRODUCTS.filter(p => p.old); }
  function related(p, n) {
    return PRODUCTS.filter(x => x.cat === p.cat && x.id !== p.id).slice(0, n || 4);
  }

  function stars(rating) {
    let s = "";
    for (let i = 1; i <= 5; i++) {
      s += `<span class="material-symbols-outlined ${i <= Math.floor(rating) ? 'ms-fill' : ''} ${i === Math.ceil(rating) && rating % 1 ? '' : ''}" style="font-size:18px">star</span>`;
    }
    return s;
  }

  // Renders a product card. `wished` toggles heart fill.
  function getProductImage(p) {
    if (p && p.image) return p.image;
    if (p && p.slug) return "assets/images/products/" + p.slug + ".jpg";
    return ph(p ? p.color : "cream", p ? p.name : "");
  }

  function card(p, opts) {
    opts = opts || {};
    const img = getProductImage(p);
    const wished = opts.wished ? "ms-fill text-secondary" : "";
    const tag = p.badge
      ? `<span class="${p.badge.includes('%') ? 'bg-error-container text-on-error-container' : 'bg-primary/10 text-primary'} font-label-sm text-[10px] px-2 py-1 rounded-full uppercase tracking-wider">${p.badge}</span>`
      : "";
    const price = p.old
      ? `<div class="flex items-baseline gap-2"><span class="font-headline-sm text-headline-sm text-error">${money(p.price)}</span><span class="font-body-sm text-body-sm text-on-surface-variant line-through">${money(p.old)}</span></div>`
      : `<div class="font-headline-sm text-headline-sm text-primary">${money(p.price)}</div>`;
    return `
    <div class="group bg-surface-container-lowest rounded-xl p-3 md:p-4 card-ambient hover:-translate-y-1 transition-all duration-300 flex flex-col reveal">
      <a href="product.html?p=${p.slug}" class="relative aspect-[4/5] rounded-lg overflow-hidden bg-surface-container-low mb-4 block">
        <img src="${img}" alt="${p.name}" class="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500" loading="lazy">
        <div class="absolute top-2 left-2 flex flex-col gap-1">${tag}</div>
      </a>
      <button data-wish="${p.id}" aria-label="İstək siyahısına əlavə et" class="absolute top-5 right-5 w-8 h-8 bg-surface/80 backdrop-blur-sm rounded-full flex items-center justify-center text-on-surface-variant hover:text-secondary hover:bg-surface transition-colors shadow-sm">
        <span class="material-symbols-outlined text-[18px] ${wished}">favorite</span>
      </button>
      <div class="flex-grow flex flex-col">
        <div class="text-xs font-label-sm text-tertiary mb-1 uppercase tracking-widest">${p.material}</div>
        <a href="product.html?p=${p.slug}" class="font-body-md text-body-md text-on-surface font-medium mb-1 clamp-2 hover:text-primary transition-colors">${p.name}</a>
        <div class="flex items-center gap-1 text-primary mb-2">${stars(p.rating)}<span class="font-body-sm text-body-sm text-on-surface-variant ml-1">(${p.reviews})</span></div>
        <div class="mt-auto pt-2 flex items-center justify-between">
          ${price}
          <button data-add="${p.id}" aria-label="Səbətə at" class="w-10 h-10 bg-surface-container hover:bg-primary hover:text-on-primary rounded-full flex items-center justify-center transition-colors text-primary">
            <span class="material-symbols-outlined text-[20px]">add_shopping_cart</span>
          </button>
        </div>
      </div>
    </div>`;
  }

  // Customer reviews — tied to real products. az-AZ names + cities.
  const REVIEWS = [
    { id: 1, productId: 1,  rating: 5, quote: "Material keyfiyyəti sadəcə möhtəşəmdir. Qızımın dərisi üçün ən yumşaq bodi tapdıq, çatdırılma da çox sürətli oldu.", author: "Leyla Əliyeva", city: "Bakı" },
    { id: 2, productId: 7,  rating: 5, quote: "Yeni doğulan oğlum üçün tulum dəsti aldım. Təbiiliyi və yumşaqlığı heç bir yerdə görməmişdim. Artıq daimi müştəriyəm.", author: "Nərminə Məmmədova", city: "Sumqayıt" },
    { id: 3, productId: 11, rating: 5, quote: "Hədiyyəlik dəsti doğum günü üçün sifariş etdim. Qablaşdırma belə çox zərif idi. Hər kəsə məsləhət görürəm.", author: "Aydan Rəhimli", city: "Gəncə" },
    { id: 4, productId: 8,  rating: 5, quote: "Lavanta yuxu tulumu qızımın gecə yuxusunu tam dəyişdi. Yumşaq, nəfəs alan və gözəl rəngdədir.", author: "Gülay Hüseynova", city: "Bakı" },
    { id: 5, productId: 5,  rating: 5, quote: "Naxışlı ağ bodi xüsusi günlər üçün həqiqətən gözəl seçimdir. Keyfiyyət gözləntilərimi aşdı.", author: "Səbinə Quliyeva", city: "Mingəçevir" },
    { id: 6, productId: 16, rating: 5, quote: "Çorab dəsti praktik və keyfiyyətlidir. Kaydırmayan taban sayəsində rahat sürünür. Tövsiyə edirəm.", author: "Aysel Əsgərova", city: "Lənkəran" },
    { id: 7, productId: 14, rating: 5, quote: "Orqanik pambıq şapqa qulaqları tam qoruyur. Qış aylarında oğlumdan heç ayırmıram.", author: "Tural Əhmədov", city: "Şəki" },
    { id: 8, productId: 2,  rating: 5, quote: "Bej uzunqol bodi payız üçün idealdır. Yumşaq toxunuşu və sowuq günlərdə isti saxlayır.", author: "Könül İsmayılova", city: "Bakı" },
    { id: 9, productId: 12, rating: 5, quote: "Sehrli Mövsümlər dəsti hər fəsil üçün uyğun gəldi. Dörd parça birdən — qiymətə dəyər.", author: "Rəsmiyyə Əbdülrəhman", city: "Xırdalan" }
  ];

  // Aggregate review count across the catalog (formatted az-AZ: "1.240").
  function totalReviews() {
    return PRODUCTS.reduce((s, p) => s + (p.reviews || 0), 0);
  }
  function totalReviewsFormatted() {
    const n = totalReviews();
    return (typeof n === "number" && n.toLocaleString)
      ? n.toLocaleString("az-AZ")
      : ("" + n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }
  // Weighted average rating across the catalog.
  function avgRating() {
    const n = totalReviews();
    if (!n) return "5.0";
    const t = PRODUCTS.reduce((s, p) => s + (p.reviews || 0) * (p.rating || 5), 0);
    return (t / n).toFixed(1);
  }

  // 5 animated stars (rv-star class drives the CSS keyframe stagger).
  function reviewStarsHTML(rating) {
    rating = rating == null ? 5 : rating;
    let s = "";
    for (let i = 1; i <= 5; i++) {
      s += `<span class="material-symbols-outlined rv-star ${i <= rating ? "ms-fill" : ""}" style="font-size:18px">star</span>`;
    }
    return `<span class="rv-stars" role="img" aria-label="${rating} ulduz">${s}</span>`;
  }

  // Review card: product image + animated stars + quote + author.
  function reviewCard(r) {
    const p = getById(r.productId);
    const img = p ? ph(p.color, p.name) : ph("cream", "Bodi.az");
    const alt = p ? p.name : "Bodi.az";
    const pname = p ? `<span class="rv-product">${p.name}</span>` : "";
    return `<article class="rv-card reveal">
      <div class="rv-image"><img src="${img}" alt="${alt}" loading="lazy"></div>
      <div class="rv-body">
        ${reviewStarsHTML(r.rating)}
        ${pname}
        <blockquote class="rv-quote">“${r.quote}”</blockquote>
        <div class="rv-author"><strong>— ${r.author}</strong><span>${r.city}</span></div>
      </div>
    </article>`;
  }

  global.BODI = {
    getProductImage,
    COLORS, SIZES, PRODUCTS, CAT_NAMES, REVIEWS,
    ph, phWide, money, stars, card,
    getBySlug, getById, getByCat, getNew, getSale, related,
    totalReviews, totalReviewsFormatted, avgRating, reviewStarsHTML, reviewCard
  };
})(window);
