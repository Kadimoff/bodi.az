import { sql } from '../db.js';

export const DEFAULT_STORE = {
  store_name: 'Bodi.az',
  whatsapp: '994501234567',
  phone: '+994-50-123-45-67',
  email: 'info@bodi.az',
  currency: 'AZN',
  currency_symbol: '₼',
  shipping_fee: 5,
  free_shipping_threshold: 50,
  review_auto_approve: true,
  low_stock_threshold: 3,
  sizes: ['0-3 ay', '3-6 ay', '6-9 ay', '9-12 ay', '12-18 ay'],
  return_days: 14,
};

export const DEFAULT_SEO = {
  meta_title: 'Bodi.az — Körpələr üçün 100% Orqanik Pambıq Geyimlər',
  meta_description: 'Körpələriniz üçün 100% orqanik pambıqdan hazırlanmış yumşaq və rahat geyimlər. Bodilər, tulumlar və dəstlər. Bakı daxili 24 saat çatdırılma.',
  keywords: 'körpə geyimləri, orqanik pambıq, bodi, tulum, bakı, bodi.az, uşaq paltarları',
  canonical_url: 'https://bodi.az/',
  robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
  title_template: '%s | Bodi.az',
  product_title_template: '%s — 100% Orqanik Pambıq | Bodi.az',
  category_title_template: '%s — Körpə Geyimləri | Bodi.az',
  og_title: '',
  og_description: '',
  og_image: '/assets/images/products/ag-pambiq-bodi.jpg',
  og_type: 'website',
  og_site_name: 'Bodi.az',
  twitter_card: 'summary_large_image',
  twitter_title: '',
  twitter_description: '',
  twitter_image: '',
  schema_store_name: 'Bodi.az',
  schema_store_type: 'ClothingStore',
  schema_logo: '/assets/images/products/ag-pambiq-bodi.jpg',
  schema_phone: '+994-50-123-45-67',
  schema_city: 'Bakı',
  schema_country: 'AZ',
  schema_price_range: '₼₼',
  schema_opening_hours: 'Mo-Su 09:00-21:00',
  schema_social_instagram: 'https://instagram.com/bodi.az',
  schema_social_facebook: 'https://facebook.com/bodi.az',
  google_site_verification: '',
  yandex_verification: '',
  bing_verification: '',
};

export const DEFAULT_HOMEPAGE = {
  hero: {
    badge: 'Yeni Kolleksiya',
    title_line1: 'Balacalar üçün',
    title_highlight: 'yumşaq və rahat',
    title_line2: 'yeni kolleksiya',
    description: 'Körpənizin həssas dərisinə uyğun, rahat və gündəlik istifadə üçün seçilmiş geyimlər. Hər toxunuşda sevgi.',
    btn_primary_text: 'Kolleksiyaya bax',
    btn_primary_url: 'category.html?filter=new',
    btn_secondary_text: 'Bütün məhsullar',
    btn_secondary_url: 'category.html?cat=bodi',
    bg_image: 'assets/images/hero-bg.jpg',
    bg_video: 'assets/videos/hero-baby.mp4',
    bg_color: '#b8d5e5',
  },
  trust_bar: [
    { icon: 'local_shipping', title: 'Bakı üzrə sürətli çatdırılma', subtitle: 'Sifarişiniz gün ərzində qapınızda.' },
    { icon: 'verified_user', title: 'Təhlükəsiz ödəniş', subtitle: '100% təhlükəsiz və qorunan sistem.' },
    { icon: 'change_circle', title: 'Rahat dəyişdirmə və qaytarma', subtitle: '14 gün ərzində problemsiz iadə.' },
    { icon: 'spa', title: 'Seçilmiş materiallar', subtitle: '100% orqanik pambıq və hipoallergen.' },
  ],
  categories: {
    eyebrow: 'Kateqoriyalar',
    title: 'Övladınız üçün',
    items: [
      { slug: 'bodi', name: 'Bodilər', badge: '100% Pambıq', subtitle: 'Gündəlik rahatlıq və zəriflik', image: 'assets/images/products/ag-pambiq-bodi.jpg', url: 'category.html?cat=bodi' },
      { slug: 'tulum', name: 'Tulumlar', badge: 'Yumşaq Qoruma', subtitle: 'Bütün bədən qorunması və isti yuxu', image: 'assets/images/products/yumshaq-yeni-dogan-tulumu.jpg', url: 'category.html?cat=tulum' },
      { slug: 'dest', name: 'Dəstlər', badge: 'Hədiyyəlik', subtitle: 'Hədiyyəlik zərif kolleksiyalar', image: 'assets/images/products/dest-sehrli-mevsumler.jpg', url: 'category.html?cat=dest' },
    ],
  },
  featured_header: { eyebrow: 'Seçilmiş', title: 'Populyar məhsullar' },
  promo: {
    badge: 'Endirim Kampaniyası',
    title: 'Yeni kolleksiyada 20%-ə qədər',
    description: 'Payız üçün yumşaq orqanik pambıq bodilər və tulumlar. Məhdud müddətə xüsusi qiymətlərlə.',
    btn_text: 'Endirimdə bax',
    btn_url: 'category.html?filter=sale',
    image: 'assets/images/products/bej-uzunqol-bodi.jpg',
  },
  new_header: { eyebrow: 'Cəmi bizdə', title: 'Yeni gələnlər' },
  values: {
    eyebrow: 'Niyə Bodi.az?',
    title: 'Hər toxunuşda sevgi',
    description: 'Biz inanırıq ki, hər bir körpə ən yumşaq qucaqlara layiqdir.',
    items: [
      { icon: 'spa', title: '100% Üzvi Pambıq', description: 'Hipoallergen, sertifikatlaşdırılmış orqanik materiallar. Körpənizin dərisi üçün ən təhlükəsiz seçim.' },
      { icon: 'volunteer_activism', title: 'Yumşaq Toxunuş', description: 'Hər məhsul ən incə toxunuş üçün xüsusi olaraq seçilir. Rahatlıq hər toxumada.' },
      { icon: 'eco', title: 'Davamlı İstehsal', description: 'Təbiətlə harmoniyada, təkrar emal oluna bilən qablaşdırma və etik istehsal.' },
    ],
  },
  reviews_header: {
    eyebrow: 'Rəylər',
    title: 'Valideynlər nə deyir',
    description: 'Real valideynlərin real təcrübələri — yumşaq toxunuş və sevgi dolu məhsullarımız haqqında.',
    link_text: 'Bütün rəylərə bax →',
    link_url: 'reviews.html',
  },
  gallery: {
    eyebrow: 'İnstagram & Lookbook',
    title: 'Balacaların sevimli anları',
    description: 'Valideynlərin bizim məhsullarla çəkdiyi ən gözəl xatirələr. Bizi @bodi.az tag edin!',
    items: [
      { image: 'assets/images/products/ag-pambiq-bodi.jpg', title: 'Ağ Pambıq Rahatlığı', tag: '0-3 ay', link: 'https://instagram.com/bodi.az', animation: 'zoom-in' },
      { image: 'assets/images/products/yumshaq-yeni-dogan-tulumu.jpg', title: 'Şirin Yuxu Tulumu', tag: '3-6 ay', link: 'https://instagram.com/bodi.az', animation: 'fade-up' },
      { image: 'assets/images/products/dest-sehrli-mevsumler.jpg', title: 'Sehrli Mövsümlər Dəsti', tag: 'Hədiyyəlik', link: 'https://instagram.com/bodi.az', animation: 'slide-up' },
      { image: 'assets/images/products/bej-uzunqol-bodi.jpg', title: 'Təbii Bej Stil', tag: 'Payız Kolleksiyası', link: 'https://instagram.com/bodi.az', animation: 'zoom-in' },
    ],
  },
  animations: {
    hero_style: 'fade-up',
    sections_style: 'stagger-up',
    lumen_shimmer: true,
    lumen_speed: 'normal',
    spark_glint: true,
  },
};

const DEFAULTS = { store: DEFAULT_STORE, seo: DEFAULT_SEO, homepage: DEFAULT_HOMEPAGE };

function isPlainObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

// Objects merge recursively; arrays and scalars from `override` replace defaults.
export function deepMerge(base, override) {
  if (!isPlainObject(base) || !isPlainObject(override)) return override === undefined ? base : override;
  const out = { ...base };
  for (const [k, v] of Object.entries(override)) {
    out[k] = isPlainObject(v) && isPlainObject(base[k]) ? deepMerge(base[k], v) : v;
  }
  return out;
}

const cache = new Map();

export async function getSetting(key) {
  if (cache.has(key)) return cache.get(key);
  const [row] = await sql`SELECT value FROM settings WHERE key = ${key}`;
  const value = deepMerge(DEFAULTS[key] || {}, row ? row.value : {});
  cache.set(key, value);
  return value;
}

export async function saveSetting(key, value, userId = null) {
  await sql`
    INSERT INTO settings (key, value, updated_by, updated_at)
    VALUES (${key}, ${sql.json(value)}, ${userId}, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`;
  cache.delete(key);
  return getSetting(key);
}

export function clearSettingsCache() {
  cache.clear();
}
