# Bodi.az E-Commerce — Headless Store & WordPress/WooCommerce Backend

Bu layihə **Bodi.az** körpə geyimləri mağazasının müstəqil (headless) e-ticarət arxitekturasıdır.

- **Frontend:** 12 səhifəlik yüksək performanslı, müasir e-ticarət arayüzü (Tailwind CSS, Plus Jakarta Sans, Vanilla JS, Decoupled API Adapter `api.js`).
- **Backend:** WordPress + WooCommerce (Stok, məhsul kataloqu, sifarişlər, kuponlar, rəylər və Store API təminatçısı). Astra mövzusu aktivdir.
- **API Arxitekturası (Decoupled Adapter):** Frontend birbaşa backend bazasına və ya spesifik WordPress strukturuna bağlı deyil. Bütün sorğular vahid `BODI_API` adapteri vasitəsilə həyata keçirilir. Gələcəkdə WordPress başqa bir e-ticarət mühərriki (Medusa, Shopify və s.) ilə əvəzlənsə belə, yalnız adapter yenilənir — 12 HTML frontend səhifəsində heç bir dəyişiklik tələb olunmur.
- **Dinamik Rəng və Atribut Mexanizmi:** WooCommerce-də istənilən sayda və adda rəng əlavə edildikdə (`pa_color` və ya `Rəng` atributu), frontend avtomatik olaraq bu rəngləri çəkir, palitraya uyğunlaşdırır və məhsul səhifəsində swatch butonları yaradır.
- **Rəylər Sistemi:** Həm ümumi rəylər səhifəsi (`reviews.html`), həm də məhsul səhifəsində (`product.html`) real WooCommerce rəyləri API ilə sinxronlaşır və yeni rəy bildirişi birbaşa bazaya yazılır.

---

## 📁 Qovluq Strukturu

```
bodi.az/
├── docker-compose.yml          # Yerli və server Docker konfiqurasiyası (DB, WP, Frontend)
├── docker/
│   ├── apache-allowoverride.conf # WP REST API rewrite qaydalarını aktivləşdirir
│   ├── astra.zip               # Astra mövzusu
│   ├── woocommerce.zip         # WooCommerce modulu
│   └── wp-cli.phar             # Avtomatlaşdırma aləti
├── backend/
│   ├── init.sql                # Verilənlər bazası ixracı (bütün məhsullar və tənzimləmələr)
│   └── mu-plugins/
│       └── bodi-cors-api.php   # Headless frontend üçün CORS, Checkout, Reviews & Tracking API
├── frontend/                   # 12 səhifəlik müstəqil e-ticarət mağazası
│   ├── index.html, category.html, product.html, cart.html, checkout.html ...
│   ├── reviews.html            # Müştəri rəyləri və yeni rəy formu
│   ├── track-order.html        # Canlı sifariş izləmə
│   └── assets/
│       ├── css/styles.css      # Dizayn tokenləri və animasiyalar
│       ├── images/             # Məhsul və brend şəkilləri
│       └── js/
│           ├── api.js          # Decoupled API Service & WooCommerceAdapter
│           ├── products.js     # Dinamik rəng generatoru, modellər və fallback kataloq
│           ├── store.js        # Səbət, promokod və istək siyahısı (localStorage)
│           └── layout.js       # Dinamik header, footer və bildirişlər
└── scripts/
    ├── dev-setup.sh            # Tək komanda ilə bütün mühitin avtomatik qurulması
    ├── seed-products.php       # Əsas məhsulları WooCommerce-ə daxil edən skript
    ├── seed-reviews.php        # Müştəri rəylərini bazaya toxuyan skript
    ├── export-db.sh            # Baza nüsxəsini backend/init.sql faylına çıxarır
    └── import-db.sh            # Baza nüsxəsini bərpa edir
```

---

## 🚀 Yerli Kompüterdə İşə Salma (Local Dev)

Layihə tam olaraq avtomatlaşdırılıb:

```bash
cd /home/k4/bodi.az
docker compose up -d
```

Əgər sıfırdan qurmaq istəyirsinizsə:
```bash
cd /home/k4/bodi.az
./scripts/dev-setup.sh
```

Bu skript avtomatik olaraq:
1. Docker container-lərini (`bodi-db`, `bodi-wp`, `bodi-frontend`) qaldırır.
2. WordPress, WooCommerce və Astra mövzusunu sazlayır.
3. Valyutanı **AZN (₼)** olaraq təyin edir.
4. Pretty permalinks (`/%postname%/`) və CORS tənzimləmələrini edir.
5. Məhsulları və rəyləri bazaya daxil edir.

### 🌐 Giriş Ünvanları:
- **Mağaza (Frontend):** [http://localhost:8096](http://localhost:8096)
- **WordPress Admin:** [http://localhost:8085/wp-admin](http://localhost:8085/wp-admin)
  - **İstifadəçi:** `bodi_admin`
  - **Şifrə:** `***REMOVED***`
- **Store API Məhsullar:** [http://localhost:8085/wp-json/wc/store/v1/products](http://localhost:8085/wp-json/wc/store/v1/products)
- **Rəylər API:** [http://localhost:8085/wp-json/bodi/v1/reviews](http://localhost:8085/wp-json/bodi/v1/reviews)
- **Sifariş İzləmə API:** [http://localhost:8085/wp-json/bodi/v1/track-order?order_id=53](http://localhost:8085/wp-json/bodi/v1/track-order?order_id=53)

---

## 🐙 GitHub-a Göndərmə (Git Push)

Yerli repozitoriyanı GitHub-a göndərmək üçün:

```bash
cd /home/k4/bodi.az
git add .
git commit -m "feat: unified bodi.az decoupled headless architecture with dynamic attributes and reviews"

# GitHub-da repozitoriyanı bağlayın:
# git remote add origin git@github.com:<istifadeci_adi>/bodi.az.git
# git branch -M main
# git push -u origin main
```

---

## ☁️ Serverə Quraşdırma (`***REMOVED***`)

Serverdə artıq SSH açarınız sazlanıb. Canlıya almaq üçün:

1. **Serverə daxil olun:**
   ```bash
   ssh root@***REMOVED***
   ```
2. **Repozitoriyanı çəkin:**
   ```bash
   git clone git@github.com:<istifadeci_adi>/bodi.az.git /opt/bodi.az
   cd /opt/bodi.az
   ./scripts/dev-setup.sh
   ./scripts/import-db.sh backend/init.sql
   ```
3. **Nginx yönləndirməsi:**
   - `bodi.az` -> `http://127.0.0.1:8096` (Frontend)
   - `api.bodi.az` -> `http://127.0.0.1:8085` (WordPress Backend)
