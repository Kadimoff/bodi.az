# Bodi.az E-Commerce — Headless Store & WordPress Backend

Bu layihə **Bodi.az** körpə geyimləri mağazasının hibrid headless e-ticarət arxitekturasıdır.

- **Frontend:** 12 səhifəlik yüksək performanslı, müasir e-ticarət arayüzü (Tailwind CSS, Plus Jakarta Sans, Vanilla JS, WooCommerce Store API müştərisi `api.js`).
- **Backend:** WordPress + WooCommerce (Stok, məhsul kataloqu, sifarişlər, kuponlar və Store API təminatçısı). Astra mövzusu aktivdir.
- **API Əlaqəsi:** `frontend/assets/js/api.js` vasitəsilə birbaşa WooCommerce Store API (`/wp-json/wc/store/v1/`) ilə inteqrasiya edilib. WordPress əlçatmaz olduqda belə sayt avtomatik olaraq daxili fallback məlumatları ilə fasiləsiz işləməyə davam edir.

---

## 📁 Qovluq Strukturu

```
bodi-ecommerce/
├── docker-compose.yml          # Yerli və server Docker konfiqurasiyası (DB, WP, Frontend)
├── docker/
│   └── apache-allowoverride.conf # WP REST API rewrite qaydalarını aktivləşdirir
├── backend/
│   ├── init.sql                # Verilənlər bazası ixracı (bütün məhsullar və tənzimləmələr)
│   └── mu-plugins/
│       └── bodi-cors-api.php   # Headless frontend üçün CORS və API başlıqları
├── frontend/                   # 12 səhifəlik e-ticarət mağazası
│   ├── index.html, category.html, product.html, cart.html, checkout.html ...
│   └── assets/
│       └── js/
│           ├── api.js          # WooCommerce Store API müştərisi (avtomatik məhsul və səbət sinxronizasiyası)
│           ├── products.js     # Məhsul modelləri, kart renderi və fallback məlumatlar
│           ├── store.js        # Səbət və istək siyahısı (localStorage)
│           └── layout.js       # Dinamik header, footer və bildirişlər
└── scripts/
    ├── dev-setup.sh            # Tək komanda ilə bütün mühitin avtomatik qurulması
    ├── seed-products.php       # 16 əsas məhsulu WooCommerce-ə daxil edən skript
    ├── export-db.sh            # Baza nüsxəsini backend/init.sql faylına çıxarır
    └── import-db.sh            # Baza nüsxəsini bərpa edir
```

---

## 🚀 Yerli Kompüterdə İşə Salma (Local Dev)

Layihə tam olaraq avtomatlaşdırılıb:

```bash
cd /home/k4/bodi-ecommerce
./scripts/dev-setup.sh
```

Bu skript avtomatik olaraq:
1. Docker container-lərini (`bodi-db`, `bodi-wp`, `bodi-frontend`) qaldırır.
2. WordPress, WooCommerce və Astra mövzusunu quraşdırır.
3. Valyutanı **AZN (₼)** olaraq təyin edir.
4. Pretty permalinks (`/%postname%/`) və CORS tənzimləmələrini edir.
5. 16 məhsulu (kateqoriyalar, qiymətlər, rənglər, materiallar, ölçülər) bazaya toxuyur.

### 🌐 Giriş Ünvanları:
- **Mağaza (Frontend):** [http://localhost:8096](http://localhost:8096)
- **WordPress Admin:** [http://localhost:8085/wp-admin](http://localhost:8085/wp-admin)
  - **İstifadəçi:** `bodi_admin`
  - **Şifrə:** `***REMOVED***`
- **Store API:** [http://localhost:8085/wp-json/wc/store/v1/products](http://localhost:8085/wp-json/wc/store/v1/products)

---

## 🐙 GitHub-a Göndərmə (Git Push)

Yerli repozitoriyanı GitHub-a göndərmək üçün:

```bash
cd /home/k4/bodi-ecommerce
git init
git add .
git commit -m "feat: initial bodi.az headless e-commerce stack with woocommerce store api"

# GitHub-da yaratdığınız boş repozitoriyanı bağlayın:
# git remote add origin git@github.com:<istifadeci_adi>/bodi-ecommerce.git
# git branch -M main
# git push -u origin main
```

---

## ☁️ Serverə Quraşdırma (`***REMOVED***`)

Serverdə artıq SSH açarınız sazlanıb. GitHub-dan çəkərək canlıya almaq üçün addımlar:

1. **Serverə daxil olun:**
   ```bash
   ssh root@***REMOVED***
   ```
2. **Repozitoriyanı çəkin:**
   ```bash
   git clone git@github.com:<istifadeci_adi>/bodi-ecommerce.git /opt/bodi-ecommerce
   cd /opt/bodi-ecommerce
   ./scripts/dev-setup.sh
   ./scripts/import-db.sh backend/init.sql
   ```
3. **Nginx yönləndirməsi:**
   - `bodi.az` -> `http://127.0.0.1:8096` (Frontend)
   - `api.bodi.az` -> `http://127.0.0.1:8085` (WordPress Backend)
