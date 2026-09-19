# Bodi.az — Körpə Geyimi E-ticarət

Statik çoxsəhifəli sayt. Stitch dizayn analizindən (Serene Childhood / "Nurtured Comfort")
tokinlərlə — Tailwind CDN + Plus Jakarta Sans + Material Symbols. Vanilla JS, xarici asılılıq yoxdur
(Tailwind CDN font/icon istisna). Səbət və istək siyahısı localStorage-da saxlanır.

## Səhifələr (12)

| Səhifə | Fayl | Təsvir |
|---|---|---|
| Ana səhifə | `index.html` | Hero, trust bar, kateqoriyalar, populyar/yeni məhsullar, promo, dəyərlər, rəylər |
| Kateqoriya | `category.html` | Filtrlər (yaş/material/rəng/qiymət/endirim), sıralama, pagination. `?cat=bodi\|tulum\|dest`, `?filter=new\|sale`, `?q=` |
| Məhsul | `product.html` | Qalereya, rəng/ölçü seçimi, miqdar, accordion, oxşar məhsullar. `?p=<slug>` |
| Səbət | `cart.html` | Miqdar dəyişmə, silmə, promokod (`BODI10`), pulsuz çatdırılma hesabı |
| Ödəniş | `checkout.html` | 3 addım (çatdırılma→ödəniş→yoxlama), kart/qapıda ödəniş |
| Hesab | `account.html` | Sifarişlər (status filter), ünvanlar, istək siyahısı, parametrlər |
| Sifariş izlə | `track-order.html` | 4 addımlı izləmə stepper |
| Bloq | `blog.html` + `blog-post.html` | Kateqoriya filter, oxuma vaxtı |
| Haqqımızda | `about.html` | Hekayə, dəyərlər, davamlılıq, statistika |
| Əlaqə | `contact.html` | Form, mağazalar (Port Baku, Gənclik Mall) |
| FAQ | `faq.html` | Accordion, canlı axtarış, ölçü cədvəli, sticky nav |
| 404 | `404.html` | Animasiyalı, crawl band |

## Arxitektura

```
assets/
  css/styles.css      # dizayn tokenləri, accordion, animasiyalar, toast
  js/tw-config.js     # Tailwind config (Serene Childhood rəng/font/spacing)
  js/products.js      # 16 məhsul kataloqu + SVG placeholder generator + card renderer
  js/store.js         # localStorage səbət + istək siyahısı + toast
  js/layout.js        # shared header/footer/mobil nav inject, badge, click delegation
```

Hər səhifə: `<head>`-də eyni 5 səkript (Tailwind CDN → tw-config → fontlar → styles.css),
`<body>` sonunda `products.js → store.js → layout.js → səhifə scripti`. Header/footer
`#site-header` / `#site-footer` yuvalarına JS ilə inject olunur (DRY).

## Dizayn tokenləri (DESIGN.md-dən)

- **Primary (sage):** `#4f614e` · **Secondary (muted coral):** `#86503e`
- **Surface (warm white):** `#fdf9f3` · **On-surface:** `#1c1c18`
- **Font:** Plus Jakarta Sans · **Radius:** 0.5–1.5rem · **Shadow:** `0 10px 30px rgba(62,61,57,.05)`

## İşə salma

```bash
cd bodi.az
python3 -m http.server 8000
# → http://localhost:8000
```

Və ya istənilən statik host (Netlify, GitHub Pages, nginx) — build addımı yoxdur.

## Funksional detalılar

- **Səbət:** `addToCart` eyni məhsul+ölçü+rəng üçün miqdarı birləşdirir. 50 ₼+ pulsuz çatdırılma.
- **İstək siyahısı:** ürək ikonları `data-wish` attribute ilə, `account.html#wish`-də görüntülənir.
- **Ödəniş:** stepper JS ilə irəliləyir, tamamlayanda səbəti təmizləyib track-order-a yönləndirir.
- **Şəkillər:** real foto yoxdur — `BODI.ph(color, label)` yumşaq gradient + onesie silueti SVG data-URI
  yaradır (offline, design-a uyğun). Real məhsul fotoları üçün `products.js`-də `ph()` çağırılarını
  URL-lə əvəz edin.
- **Promokod:** `BODI10`.

## Mənbə

`/home/k4/Downloads/stitch_bodi.az_e_commerce_architecture_analysis.zip` — Stitch tərəfindən
yaranmış 12 ekran + DESIGN.md (Serene Childhood).
