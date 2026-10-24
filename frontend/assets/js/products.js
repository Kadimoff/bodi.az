/* Bodi.az — Product catalog + soft SVG placeholder generator + renderers.
   Self-contained: no external image deps. Soft gradient "product" tiles
   follow the Serene Childhood warm palette. */
(function (global) {
  "use strict";

  const COLORS = {
    cream:  { n: "Krem", a: "#fdf9f3", b: "#f1ede7", label: "#8a8478" },
    beige:  { n: "Bej", a: "#efe8da", b: "#ddd0ba", label: "#8a7a5c" },
    sage:   { n: "Adaçayı", a: "#d4e0cf", b: "#b8ccb5", label: "#5f705c" },
    peach:  { n: "Şaftalı", a: "#fbe3d6", b: "#f6c7b0", label: "#a76a52" },
    terracotta:{ n: "Terrakotta", a: "#ecc6b3", b: "#d99e80", label: "#9a5238" },
    white:  { n: "Ağ", a: "#ffffff", b: "#eeece6", label: "#9a988f" },
    sky:    { n: "Göy / Mavi", a: "#d6e4ea", b: "#b6cbd6", label: "#54707e" },
    lavender:{ n: "Lavanta", a: "#e2dceb", b: "#c9bcdf", label: "#6e5e8c" },
    mustard:{ n: "Xardal", a: "#efe2bd", b: "#dcc485", label: "#8a7334" },
    rose:   { n: "Çəhrayı", a: "#f4d9da", b: "#ebb4b7", label: "#a65a5e" },
    mint:   { n: "Nanə", a: "#d7ece4", b: "#bce0d3", label: "#537869" },
    olive:  { n: "Zeytun", a: "#e2e6d5", b: "#c8d1b1", label: "#687350" },
    grey:   { n: "Boz", a: "#f0f0f0", b: "#dcdcdc", label: "#707070" },
    black:  { n: "Qara", a: "#555555", b: "#2b2b2b", label: "#ffffff" },
    brown:  { n: "Qəhvəyi", a: "#e3d2c5", b: "#c8b09f", label: "#6d4e3a" }
  };

  // Resolve color string (from the API or local) to full color object
  function resolveColor(input) {
    if (!input) return { slug: "cream", ...COLORS.cream };
    if (typeof input === "object" && input.slug && input.b) return input;
    const str = String(typeof input === "object" ? (input.name || input.slug || "") : input).trim();
    const key = str.toLowerCase()
      .replace(/ə/g, "e").replace(/ı/g, "i").replace(/ç/g, "c").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ö/g, "o").replace(/ü/g, "u")
      .replace(/[^a-z0-9]/g, "");

    if (COLORS[key]) return { slug: key, ...COLORS[key], n: COLORS[key].n || str };

    const aliases = {
      ag: "white", beyaz: "white",
      bej: "beige",
      krem: "cream",
      adacayi: "sage", yasil: "sage", green: "sage",
      saftali: "peach", seftali: "peach",
      terrakotta: "terracotta",
      goy: "sky", mavi: "sky", blue: "sky",
      benovseyi: "lavender", lavanta: "lavender", purple: "lavender",
      xardal: "mustard", sari: "mustard", yellow: "mustard",
      cehrayi: "rose", gul: "rose", pink: "rose",
      nane: "mint",
      zeytun: "olive",
      boz: "grey", gray: "grey", gri: "grey",
      qara: "black", siyah: "black",
      qehveyi: "brown", kahverengi: "brown"
    };

    if (aliases[key] && COLORS[aliases[key]]) {
      return { slug: aliases[key], ...COLORS[aliases[key]], n: COLORS[aliases[key]].n || str };
    }

    // Dynamic pastel color fallback for ANY colour not in the palette
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return {
      slug: key || "custom",
      n: str,
      a: `hsl(${h}, 45%, 93%)`,
      b: `hsl(${h}, 40%, 82%)`,
      label: `hsl(${h}, 45%, 35%)`
    };
  }

  // Soft gradient SVG with a onesie silhouette + color name.
  function ph(colorKey, labelText) {
    const c = resolveColor(colorKey);
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
    { id: 10, slug: "ag-pambiq-bodi", name: "Ağ Pambıq Bodi", cat: "bodi", material: "100% Orqanik Pambıq", price: 24.90, old: 35.00, color: "white", rating: 5, reviews: 124, badge: "-28%", isNew: false, desc: "Körpənizin həssas dərisi üçün xüsusi olaraq toxunmuş, nəfəs alan və yumşaq orqanik pambıqdan hazırlanmış bodi. Gündəlik istifadə üçün mükəmməl rahatlıq." },
    { id: 11, slug: "bej-uzunqol-bodi", name: "Bej Rəngli Uzunqol Bodi", cat: "bodi", material: "Orqanik Pambıq", price: 24.90, color: "beige", rating: 5, reviews: 88, badge: "Yeni", isNew: true, desc: "Yumşaq orqanik pambıqdan uzunqol bodi. Soyuq günlərdə rahat və isti saxlayır." },
    { id: 12, slug: "adacayi-qisaqol-bodi", name: "Adaçayı Rəngli Qısaqol Bodi", cat: "bodi", material: "100% Pambıq", price: 19.90, color: "sage", rating: 5, reviews: 56, desc: "Sakit adaçayı yaşıılında, incə naxışlı qısaqol bodi. Yay ayları üçün idealdır." },
    { id: 13, slug: "saftali-yay-bodisi", name: "Şaftalı Rəngli Yay Bodisi", cat: "bodi", material: "Kətan Qarışığı", price: 22.90, old: 28.90, color: "peach", rating: 4, reviews: 41, badge: "-20%", desc: "Şaftalı tonlarında, yüngül və nəfəs alan yay bodisi." },
    { id: 14, slug: "naxisli-ag-bodi", name: "Naxışlı Ağ Bodi", cat: "bodi", material: "Orqanik Pambıq", price: 26.50, color: "white", rating: 5, reviews: 73, desc: "Zeytun budağı naxışlı, incə zərif ağ bodi. Xüsusi günlər üçün." },
    { id: 15, slug: "terracotta-uzunqol-bodi", name: "Terrakotta Uzunqol Bodi", cat: "bodi", material: "100% Pambıq", price: 25.90, color: "terracotta", rating: 5, reviews: 39, isNew: true, badge: "Yeni", desc: "Terrakotta rəngli, payız üçün isti uzunqol bodi." },

    { id: 16, slug: "yumshaq-yeni-dogan-tulumu", name: "Yumşaq Yeni Doğulan Tulumu", cat: "tulum", material: "Orqanik Pambıq", price: 34.90, color: "cream", rating: 5, reviews: 102, badge: "Yeni", isNew: true, desc: "Yeni doğulanlar üçün yumşaq, fermuarlı bütün bədən tulumu. Rahat geyinmə və soyunma." },
    { id: 17, slug: "lavanta-yuxu-tulumu", name: "Lavanta Yuxu Tulumu", cat: "tulum", material: "100% Pambıq", price: 29.90, old: 38.00, color: "lavender", rating: 5, reviews: 67, badge: "-21%", desc: "Sakitləşdirici lavanta rəngində yuxu tulumu. Rahat bir gecə yuxusu üçün." },
    { id: 18, slug: "sage-double-tulum", name: "Adaçayı İki Parçalı Tulum", cat: "tulum", material: "Orqanik Pambıq", price: 39.90, color: "sage", rating: 5, reviews: 48, desc: "İki parçalı, praktik və isti. Alt dəyişdirmə üçün asanlıq." },
    { id: 19, slug: "seftali-fermuar-tulum", name: "Şaftalı Fermuarlı Tulum", cat: "tulum", material: "Kətan Qarışığı", price: 32.50, color: "peach", rating: 4, reviews: 35, desc: "Tam fermuarlı, yumşaq toxunuşlu gündəlik tulum." },

    { id: 20, slug: "ilkin-des-goyler", name: "İlkin Dəst — Göylər", cat: "dest", material: "100% Pambıq", price: 54.90, old: 69.00, color: "sky", rating: 5, reviews: 91, badge: "-20%", desc: "3 ədəd bodi + 1 tulumdan ibarət hədiyyəlik dəst. Yeni doğulanlar üçün ideal." },
    { id: 21, slug: "dest-sehrli-mevsumler", name: "Dəst — Sehrli Mövsümlər", cat: "dest", material: "Orqanik Pambıq", price: 59.90, color: "mustard", rating: 5, reviews: 44, badge: "Yeni", isNew: true, desc: "Hər fəsil üçün uyğun, 4 parçalı uniseks dəst." },
    { id: 22, slug: "dest-tebrik-nvazis", name: "Dəst — Təbrik & Nəvaziş", cat: "dest", material: "Orqanik Pambıq", price: 49.90, color: "rose", rating: 5, reviews: 28, desc: "Zərif çəhrayı tonlarda, xüsusi günlər üçün 3 parçalı dəst." },

    { id: 23, slug: "org-pambiq-sapqa", name: "Orqanik Pambıq Şapqa", cat: "bodi", material: "100% Orqanik Pambıq", price: 12.90, color: "cream", rating: 5, reviews: 60, desc: "Yumşaq, qulaqları qoruyan nəfəs alan şapqa." },
    { id: 24, slug: "yum-alt-paltar", name: "Yumşaq Alt Paltar", cat: "bodi", material: "100% Pambıq", price: 18.90, old: 24.00, color: "sage", rating: 4, reviews: 33, badge: "-21%", desc: "Həssas dəri üçün yumşaq alt paltarı. Təmiz və təbii material." },
    { id: 25, slug: "pambiq-corab-desi", name: "Pambıq Çorab Dəsti (4 cüt)", cat: "bodi", material: "100% Pambıq", price: 14.90, color: "beige", rating: 5, reviews: 77, desc: "Kaydırmayan tabanlı, 4 cütlük yumşaq çorab dəsti." }
  ];

  const CAT_NAMES = {
    bodi: "Bodilər",
    tulum: "Tulumlar",
    dest: "Dəstlər"
  };

  function money(n) { return (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, "") + " ₼"; }

  function getBySlug(slug) { return PRODUCTS.find(p => p.slug === slug); }
  function getById(id) {
    if (id == null) return null;
    return PRODUCTS.find(p => p.id === Number(id)) || PRODUCTS.find(p => p.slug === String(id)) || PRODUCTS.find(p => String(p.id) === String(id));
  }
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
    if (p && p.cardImage) return p.cardImage;
    if (p && p.image) return p.image;
    if (p && p.slug) return "assets/images/products/" + p.slug + ".jpg";
    return ph(p ? p.color : "cream", p ? p.name : "");
  }

  function card(p, opts) {
    opts = opts || {};
    const img = getProductImage(p);
    const wished = opts.wished ? "ms-fill text-secondary" : "";
    const isSale = p.badge && (p.badge.includes('%') || p.badge.toLowerCase().includes('endir'));
    const soldOut = p.inStock === false;
    const tag = soldOut
      ? `<span class="spark-badge" style="background:#31302d;color:#fff">Stokda yoxdur</span>`
      : p.badge
        ? `<span class="spark-badge ${isSale ? 'spark-badge-sale' : 'spark-badge-new'}"><span class="spark-icon">✦</span>${p.badge}</span>`
        : "";
    const price = p.old
      ? `<div class="flex items-baseline gap-2"><span class="font-headline-sm text-headline-sm text-error">${money(p.price)}</span><span class="font-body-sm text-body-sm text-on-surface-variant line-through">${money(p.old)}</span></div>`
      : `<div class="font-headline-sm text-headline-sm text-primary">${money(p.price)}</div>`;
    return `
    <div class="group relative bg-surface-container-lowest rounded-2xl p-3.5 md:p-4 card-ambient hover:-translate-y-1 transition-all duration-300 flex flex-col reveal ${opts.extraClass || ''}">
      <a href="product.html?p=${p.slug}" draggable="false" class="relative aspect-[4/5] rounded-xl overflow-hidden bg-surface-container-low mb-3.5 md:mb-4 block select-none">
        <img src="${img}"${p.cardSrcset ? ` srcset="${p.cardSrcset}" sizes="(min-width: 1024px) 25vw, 50vw"` : ""} alt="${p.name}" width="480" height="600" draggable="false" class="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500 pointer-events-none select-none" loading="lazy" decoding="async">
        <div class="absolute top-2.5 left-2.5 flex flex-col gap-1">${tag}</div>
      </a>
      <button data-wish="${p.id}" aria-label="İstək siyahısına əlavə et" class="absolute top-5 right-5 w-8 h-8 bg-surface/85 backdrop-blur-sm rounded-full flex items-center justify-center text-on-surface-variant hover:text-secondary hover:bg-surface transition-colors shadow-sm">
        <span class="material-symbols-outlined text-[18px] ${wished}">favorite</span>
      </button>
      <div class="flex-grow flex flex-col">
        <div class="text-[11px] md:text-xs font-label-sm text-tertiary mb-1 uppercase tracking-widest font-semibold">${p.material}</div>
        <a href="product.html?p=${p.slug}" draggable="false" class="font-body-md text-sm md:text-body-md text-on-surface font-bold mb-1.5 clamp-2 hover:text-primary transition-colors leading-snug">${p.name}</a>
        <div class="flex items-center gap-1 text-primary mb-2.5">${stars(p.rating)}<span class="font-body-sm text-xs md:text-body-sm text-on-surface-variant ml-1 font-medium">(${p.reviews})</span></div>
        <div class="mt-auto pt-2 flex items-center justify-between border-t border-outline-variant/20">
          ${price}
          <button data-add="${p.id}" aria-label="Səbətə at"${soldOut ? ' disabled title="Stokda yoxdur" style="opacity:.4;pointer-events:none"' : ''} class="w-10 h-10 bg-surface-container hover:bg-primary hover:text-on-primary rounded-full flex items-center justify-center transition-colors text-primary shadow-xs">
            <span class="material-symbols-outlined text-[20px]">add_shopping_cart</span>
          </button>
        </div>
      </div>
    </div>`;
  }

  // Customer reviews — tied to real products. az-AZ names + cities.
  const REVIEWS = [
    { id: 1, productId: 10,  rating: 5, quote: "Material keyfiyyəti sadəcə möhtəşəmdir. Qızımın dərisi üçün ən yumşaq bodi tapdıq, çatdırılma da çox sürətli oldu.", author: "Leyla Əliyeva", city: "Bakı" },
    { id: 2, productId: 16,  rating: 5, quote: "Yeni doğulan oğlum üçün tulum dəsti aldım. Təbiiliyi və yumşaqlığı heç bir yerdə görməmişdim. Artıq daimi müştəriyəm.", author: "Nərminə Məmmədova", city: "Sumqayıt" },
    { id: 3, productId: 20, rating: 5, quote: "Hədiyyəlik dəsti doğum günü üçün sifariş etdim. Qablaşdırma belə çox zərif idi. Hər kəsə məsləhət görürəm.", author: "Aydan Rəhimli", city: "Gəncə" },
    { id: 4, productId: 17,  rating: 5, quote: "Lavanta yuxu tulumu qızımın gecə yuxusunu tam dəyişdi. Yumşaq, nəfəs alan və gözəl rəngdədir.", author: "Gülay Hüseynova", city: "Bakı" },
    { id: 5, productId: 14,  rating: 5, quote: "Naxışlı ağ bodi xüsusi günlər üçün həqiqətən gözəl seçimdir. Keyfiyyət gözləntilərimi aşdı.", author: "Səbinə Quliyeva", city: "Mingəçevir" },
    { id: 6, productId: 25, rating: 5, quote: "Çorab dəsti praktik və keyfiyyətlidir. Kaydırmayan taban sayəsində rahat sürünür. Tövsiyə edirəm.", author: "Aysel Əsgərova", city: "Lənkəran" },
    { id: 7, productId: 23, rating: 5, quote: "Orqanik pambıq şapqa qulaqları tam qoruyur. Qış aylarında oğlumdan heç ayırmıram.", author: "Tural Əhmədov", city: "Şəki" },
    { id: 8, productId: 11,  rating: 5, quote: "Bej uzunqol bodi payız üçün idealdır. Yumşaq toxunuşu və sowuq günlərdə isti saxlayır.", author: "Könül İsmayılova", city: "Bakı" },
    { id: 9, productId: 21, rating: 5, quote: "Sehrli Mövsümlər dəsti hər fəsil üçün uyğun gəldi. Dörd parça birdən — qiymətə dəyər.", author: "Rəsmiyyə Əbdülrəhman", city: "Xırdalan" }
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
    const p = getById(r.productId) || (r.productSlug ? getBySlug(r.productSlug) : null);
    const img = r.productImage || (p ? getProductImage(p) : "assets/images/products/ag-pambiq-bodi.jpg");
    const pName = r.productName || (p ? p.name : "Bodi.az");
    const pSlug = r.productSlug || (p ? p.slug : "");
    const productLink = pSlug ? `product.html?p=${pSlug}` : "#";
    const pname = pSlug
      ? `<a href="${productLink}" class="rv-product hover:text-primary font-medium transition-colors">${pName}</a>`
      : `<span class="rv-product">${pName}</span>`;

    return `<article class="rv-card reveal select-none">
      <div class="rv-image"><a href="${productLink}" draggable="false"><img src="${img}" alt="${pName}" loading="lazy" draggable="false" class="w-full h-full object-cover pointer-events-none select-none"></a></div>
      <div class="rv-body">
        ${reviewStarsHTML(r.rating)}
        ${pname}
        <blockquote class="rv-quote">“${r.quote}”</blockquote>
        <div class="rv-author"><strong>— ${r.author}</strong><span>${r.city || "Bakı"}</span></div>
      </div>
    </article>`;
  }

  global.BODI = {
    getProductImage,
    COLORS, SIZES, PRODUCTS, CAT_NAMES, REVIEWS,
    resolveColor,
    ph, phWide, money, stars, card,
    getBySlug, getById, getByCat, getNew, getSale, related,
    totalReviews, totalReviewsFormatted, avgRating, reviewStarsHTML, reviewCard
  };
})(window);
