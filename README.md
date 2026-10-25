# Bodi.az — Körpə geyimləri mağazası

Bodi.az körpə geyimləri onlayn mağazasıdır. Mağazanın öz backend-i və Strapi-yə bənzər admin paneli var (tam Azərbaycan dilində). Sayt, admin və API eyni portda işləyir.

| | |
|---|---|
| **Mağaza** | http://localhost:7777 |
| **Admin panel** | http://localhost:7777/admin |
| **API** | http://localhost:7777/api/v1 |
| **Sitemap** | http://localhost:7777/sitemap.xml |

## Arxitektura

```
            :7777
   ┌──────────────────────┐
   │  nginx (frontend)    │  statik səhifələr, /uploads (media volume)
   │                      │──── /api, /admin, /sitemap.xml ───┐
   │                      │──── SEO səhifələri (<head> SSR) ──┤
   └──────────────────────┘                                   ▼
                                               ┌──────────────────────────┐
                                               │ api (Node.js + Fastify)  │
                                               │ public API, admin API,   │
                                               │ admin SPA, SSR, sitemap  │
                                               └────────────┬─────────────┘
                                                            ▼
                                               ┌──────────────────────────┐
                                               │ PostgreSQL 16            │
                                               └──────────────────────────┘
```

- **frontend/**: 12 səhifəlik vitrin (Tailwind, Vanilla JS). Bütün sorğular `assets/js/api.js` adapterindən (`BODI_API`) keçir.
- **backend/**: öz sistemimiz.
  - `src/routes/public/*`: vitrin üçün API (məhsullar, kateqoriyalar, rəylər, sifariş, izləmə, promokod, bloq, əlaqə, ana səhifə, SEO).
  - `src/routes/admin/*`: admin API (sessiya cookie-si + CSRF qoruması, rol əsaslı icazələr).
  - `src/routes/site.js`: məhsul, kateqoriya, bloq və ana səhifə üçün server tərəfdə `<title>`, meta, OpenGraph və JSON-LD; dinamik `sitemap.xml`.
  - `src/migrations/*.sql`: verilənlər bazasının sxemi (başlanğıcda avtomatik tətbiq olunur).
  - `admin/`: admin panel (Preact + htm, build tələb etmir).
  - `seed/`: ilk işə salınmada idxal olunan məlumatlar (`data.json` + `images/`).

## İşə salma

```bash
cp .env.example .env      # POSTGRES_PASSWORD və ADMIN_ROOT_PASSWORD doldurun
docker compose up -d --build
```

İlk işə salınmada nə baş verir:
1. Miqrasiyalar tətbiq olunur.
2. `ADMIN_ROOT_USERNAME` / `ADMIN_ROOT_PASSWORD` ilə **root** istifadəçi yaradılır. Bu yalnız root yoxdursa baş verir. Sonradan şifrə `.env`-dən deyil, admin paneldən (Profil) dəyişdirilir.
3. Kataloq boşdursa, `backend/seed/` qovluğundakı məhsullar, şəkillər, rəylər, bloq, promokodlar və tənzimləmələr idxal olunur. Sifariş və müştəri məlumatları repoya daxil edilmir.

## Admin panel

| Bölmə | İmkanlar |
|---|---|
| **Kataloq** | Məhsullar (rəng × ölçü variantları, qalereya, rəngə görə şəkil, qiymət / köhnə qiymət / maya dəyəri, xüsusiyyətlər, kopyalama, toplu əməliyyatlar), kateqoriyalar, rəng palitrası |
| **Satış** | Sifarişlər (status axını, stokun avtomatik qaytarılması, WhatsApp ilə müştəriyə yazma, çap), promokodlar (faiz/sabit, limit, müddət, minimum səbət) |
| **Anbar** | Stok qalıqları (anbar üzrə, minimum qalıq, rəf), mədaxil / məxaric / transfer / inventarizasiya sənədləri, əks sənəd, dəyişməz hərəkət jurnalı, anbarlar, təchizatçılar, CSV ixracı |
| **Məzmun** | Ana səhifə blokları, bloq (zəngin redaktor, planlaşdırılmış dərc), rəylərin moderasiyası, müraciətlər, media kitabxanası |
| **SEO** | Qlobal meta, başlıq şablonları, OpenGraph, Schema.org, Google/Yandex/Bing təsdiq kodları, SEO auditi |
| **Sistem** | Mağaza tənzimləmələri (WhatsApp, çatdırılma qaydaları, rəy moderasiyası), istifadəçilər və rollar, fəaliyyət jurnalı |

**Rollar:**
- **Root:** hər şey.
- **Administrator:** hər şey; root hesabını idarə edə bilməz.
- **Redaktor:** kataloq, media, rəylər, məzmun, SEO.
- **Anbardar:** anbar və sifarişlər.

### Anbar necə işləyir
- Hər məhsulun rəng × ölçü kombinasiyası ayrıca **variant**dır (öz SKU-su, barkodu, istəyə bağlı fərdi qiyməti var).
- Qalıq yalnız **sənədlərlə** dəyişir: mədaxil, məxaric, transfer və inventarizasiya. Hər dəyişiklik hərəkət jurnalına yazılır. Təsdiqlənmiş sənəd dəyişdirilmir; düzəliş üçün əks sənəd yaradılır.
- Məhsulda **“Stoku izlə”** aktiv olduqda:
  - saytda yalnız qalığı olan rəng/ölçülər satılır;
  - checkout zamanı qalıq yoxlanılır və sifariş əvvəlcə əsas anbardan çıxılır;
  - ləğv edilən və ya qaytarılan sifariş məhsulları anbara geri qaytarır.
- İdxal olunan məhsullarda stok izlənmir (köhnə sistemdə də izlənmirdi). Mədaxil etdikdən sonra məhsulda açarı aktivləşdirin.

### SEO
- `product.html`, `category.html`, `blog-post.html`, `index.html` və digər məlumat səhifələrinin `<head>` hissəsi serverdə doldurulur. Belə olduqda Google və WhatsApp/Facebook önizləmələri real başlıq, təsvir və şəkil görür.
- JSON-LD sxemləri: Product (Offer, qaytarma və çatdırılma şərtləri), BreadcrumbList, CollectionPage, BlogPosting, Organization, WebSite.
- `aggregateRating` yalnız real rəylər olanda əlavə olunur.
- Dinamik `sitemap.xml` (şəkillərlə). `noindex` qeyd olunan səhifələr sitemap-a düşmür.
- Slug dəyişəndə köhnə URL avtomatik 301 ilə yeni URL-ə yönləndirilir. Tapılmayan məhsul və yazılar 404 status qaytarır.
- Şəkillər avtomatik WebP-yə çevrilir (160/480/960/1600 px) və EXIF/GPS məlumatlarından təmizlənir. Alt mətni olmayan şəkillər admin paneldə göstərilir.

## Faydalı əmrlər

```bash
# Ehtiyat nüsxə (kataloq, məzmun, tənzimləmələr və --orders ilə sifarişlər + şəkillər)
docker exec bodi-api node src/cli.js export /tmp/backup --orders
docker cp bodi-api:/tmp/backup ./backup-$(date +%F)

# Şifrəni bərpa etmək (məs. root şifrəsi unudulubsa)
docker exec -e NEW_PASSWORD='YeniŞifrə123' bodi-api node src/cli.js reset-password root

# Loglar
docker compose logs -f api
```

PostgreSQL məlumatları `pg_data` volume-unda, yüklənən şəkillər isə `uploads` volume-unda saxlanılır.

## Canlıya çıxarma (Coolify)

`docker-compose.yml` production üçündür; `docker-compose.override.yml` yalnız lokal inkişafda işləyir (7777 portu, faylların canlı qoşulması).

Coolify-da tətbiq belə qurulub:
- **Build pack:** Docker Compose. **Fayl:** `/docker-compose.yml`. **Branch:** `main`.
- **Domen:** `frontend` servisinə `https://bodi.az` və `https://www.bodi.az`. Traefik SSL-i özü alır.
- **Mühit dəyişənləri:**
  - `POSTGRES_PASSWORD` və `ADMIN_ROOT_PASSWORD` (mütləq);
  - `SITE_URL` (standart `https://bodi.az`) və `COOKIE_SECURE` (standart `true`).
- Yeni versiya: GitHub-a push → Coolify-da **Redeploy**. Verilənlər bazası və şəkillər volume-larda qalır.

Cloudflare: `bodi.az` və `www` qeydləri serverin IP-sinə proxied olaraq yönləndirilib. SSL/TLS rejimi **Full** və ya **Full (strict)** olmalıdır (Flexible yönləndirmə dövrünə səbəb olur).
