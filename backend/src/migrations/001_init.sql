-- Bodi.az core schema: catalog, media, SEO, orders, inventory (anbar), admin.

CREATE TABLE users (
  id            serial PRIMARY KEY,
  username      text NOT NULL UNIQUE,
  full_name     text NOT NULL DEFAULT '',
  email         text NOT NULL DEFAULT '',
  password_hash text NOT NULL,
  role          text NOT NULL DEFAULT 'editor' CHECK (role IN ('root', 'admin', 'editor', 'warehouse')),
  is_active     boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id          text PRIMARY KEY, -- sha256(token)
  user_id     int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  ip          text NOT NULL DEFAULT '',
  user_agent  text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE media (
  id            serial PRIMARY KEY,
  kind          text NOT NULL DEFAULT 'image' CHECK (kind IN ('image', 'video')),
  path          text NOT NULL UNIQUE,      -- relative to uploads dir, e.g. 2026/10/ag-bodi-3f2a.jpg
  original_name text NOT NULL,
  mime          text NOT NULL,
  size          int NOT NULL,
  width         int,
  height        int,
  alt           text NOT NULL DEFAULT '',
  title         text NOT NULL DEFAULT '',
  caption       text NOT NULL DEFAULT '',
  formats       jsonb NOT NULL DEFAULT '{}', -- { thumb|small|medium|large: { path, width, height, size } } (webp)
  uploaded_by   int REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE colors (
  slug        text PRIMARY KEY,
  name        text NOT NULL,
  hex         text NOT NULL,           -- açıq ton (gradient start / swatch)
  hex_dark    text NOT NULL,           -- tünd ton (gradient end / border)
  label_color text NOT NULL,           -- placeholder text colour
  aliases     text[] NOT NULL DEFAULT '{}',
  sort_order  int NOT NULL DEFAULT 0
);

CREATE TABLE categories (
  id          serial PRIMARY KEY,
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  parent_id   int REFERENCES categories(id) ON DELETE SET NULL,
  image_id    int REFERENCES media(id) ON DELETE SET NULL,
  sort_order  int NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  seo         jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id                serial PRIMARY KEY,
  slug              text NOT NULL UNIQUE,
  name              text NOT NULL,
  sku               text UNIQUE,
  status            text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  category_id       int REFERENCES categories(id) ON DELETE SET NULL,
  short_description text NOT NULL DEFAULT '',
  description       text NOT NULL DEFAULT '',
  material          text NOT NULL DEFAULT '',
  price             numeric(10, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  compare_at_price  numeric(10, 2) CHECK (compare_at_price IS NULL OR compare_at_price >= 0),
  cost_price        numeric(10, 2) CHECK (cost_price IS NULL OR cost_price >= 0),
  badge             text NOT NULL DEFAULT '',
  is_new            boolean NOT NULL DEFAULT false,
  is_featured       boolean NOT NULL DEFAULT false,
  colors            text[] NOT NULL DEFAULT '{}',
  sizes             text[] NOT NULL DEFAULT '{}',
  attributes        jsonb NOT NULL DEFAULT '[]', -- [{ name, value }]
  track_stock       boolean NOT NULL DEFAULT false,
  allow_backorder   boolean NOT NULL DEFAULT false,
  rating_avg        numeric(3, 2) NOT NULL DEFAULT 0,
  rating_count      int NOT NULL DEFAULT 0,
  sales_count       int NOT NULL DEFAULT 0,
  sort_order        int NOT NULL DEFAULT 0,
  seo               jsonb NOT NULL DEFAULT '{}',
  published_at      timestamptz,
  created_by        int REFERENCES users(id) ON DELETE SET NULL,
  updated_by        int REFERENCES users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_category_idx ON products (category_id);
CREATE INDEX products_status_idx ON products (status);

CREATE TABLE product_images (
  product_id int NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  media_id   int NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  position   int NOT NULL DEFAULT 0,
  color      text NOT NULL DEFAULT '', -- optional: image belongs to a specific colour
  PRIMARY KEY (product_id, media_id)
);

-- Old slugs keep resolving after a rename (301 for crawlers).
CREATE TABLE slug_redirects (
  entity     text NOT NULL CHECK (entity IN ('product', 'category', 'post')),
  old_slug   text NOT NULL,
  entity_id  int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity, old_slug)
);

CREATE TABLE product_variants (
  id             serial PRIMARY KEY,
  product_id     int NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku            text NOT NULL UNIQUE,
  color          text NOT NULL DEFAULT '',
  size           text NOT NULL DEFAULT '',
  barcode        text NOT NULL DEFAULT '',
  price_override numeric(10, 2),
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, color, size)
);

CREATE TABLE warehouses (
  id         serial PRIMARY KEY,
  code       text NOT NULL UNIQUE,
  name       text NOT NULL,
  address    text NOT NULL DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX warehouses_single_default ON warehouses (is_default) WHERE is_default;

CREATE TABLE stock_levels (
  variant_id   int NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  warehouse_id int NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  quantity     int NOT NULL DEFAULT 0,
  min_quantity int NOT NULL DEFAULT 0, -- minimum qalıq (xəbərdarlıq həddi)
  bin_location text NOT NULL DEFAULT '', -- rəf / yer
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (variant_id, warehouse_id)
);

CREATE TABLE suppliers (
  id             serial PRIMARY KEY,
  name           text NOT NULL,
  contact_person text NOT NULL DEFAULT '',
  phone          text NOT NULL DEFAULT '',
  email          text NOT NULL DEFAULT '',
  address        text NOT NULL DEFAULT '',
  tax_id         text NOT NULL DEFAULT '', -- VÖEN
  note           text NOT NULL DEFAULT '',
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE stock_documents (
  id                  serial PRIMARY KEY,
  doc_no              text NOT NULL UNIQUE,
  type                text NOT NULL CHECK (type IN ('receipt', 'issue', 'transfer', 'adjustment')),
  status              text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'cancelled')),
  warehouse_id        int NOT NULL REFERENCES warehouses(id),
  target_warehouse_id int REFERENCES warehouses(id),
  supplier_id         int REFERENCES suppliers(id) ON DELETE SET NULL,
  reference           text NOT NULL DEFAULT '', -- qaimə / faktura №
  note                text NOT NULL DEFAULT '',
  doc_date            date NOT NULL DEFAULT current_date,
  created_by          int REFERENCES users(id) ON DELETE SET NULL,
  posted_by           int REFERENCES users(id) ON DELETE SET NULL,
  posted_at           timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (type <> 'transfer' OR (target_warehouse_id IS NOT NULL AND target_warehouse_id <> warehouse_id))
);

CREATE TABLE stock_document_lines (
  id          serial PRIMARY KEY,
  document_id int NOT NULL REFERENCES stock_documents(id) ON DELETE CASCADE,
  variant_id  int NOT NULL REFERENCES product_variants(id),
  quantity    int NOT NULL CHECK (quantity >= 0), -- inventarizasiyada: sayılmış miqdar
  unit_cost   numeric(10, 2),
  note        text NOT NULL DEFAULT ''
);
CREATE INDEX stock_document_lines_doc_idx ON stock_document_lines (document_id);

CREATE TABLE coupons (
  id           serial PRIMARY KEY,
  code         text NOT NULL UNIQUE CHECK (code = upper(code)),
  type         text NOT NULL CHECK (type IN ('percent', 'fixed')),
  amount       numeric(10, 2) NOT NULL CHECK (amount > 0),
  min_subtotal numeric(10, 2) NOT NULL DEFAULT 0,
  usage_limit  int,
  used_count   int NOT NULL DEFAULT 0,
  starts_at    timestamptz,
  expires_at   timestamptz,
  is_active    boolean NOT NULL DEFAULT true,
  description  text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  id                 serial PRIMARY KEY,
  status             text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'processing', 'shipped', 'completed', 'cancelled', 'returned')),
  payment_status     text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  first_name         text NOT NULL DEFAULT '',
  last_name          text NOT NULL DEFAULT '',
  phone              text NOT NULL DEFAULT '',
  email              text NOT NULL DEFAULT '',
  city               text NOT NULL DEFAULT '',
  address            text NOT NULL DEFAULT '',
  customer_note      text NOT NULL DEFAULT '',
  admin_note         text NOT NULL DEFAULT '',
  payment_method     text NOT NULL DEFAULT 'cod',
  subtotal           numeric(10, 2) NOT NULL DEFAULT 0,
  discount           numeric(10, 2) NOT NULL DEFAULT 0,
  shipping           numeric(10, 2) NOT NULL DEFAULT 0,
  total              numeric(10, 2) NOT NULL DEFAULT 0,
  coupon_code        text NOT NULL DEFAULT '',
  warehouse_id       int REFERENCES warehouses(id) ON DELETE SET NULL,
  stock_applied      boolean NOT NULL DEFAULT false,
  source             text NOT NULL DEFAULT 'web',
  ip                 text NOT NULL DEFAULT '',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_status_idx ON orders (status);
CREATE INDEX orders_created_idx ON orders (created_at DESC);

CREATE TABLE order_items (
  id         serial PRIMARY KEY,
  order_id   int NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id int REFERENCES products(id) ON DELETE SET NULL,
  variant_id int REFERENCES product_variants(id) ON DELETE SET NULL,
  name       text NOT NULL,
  sku        text NOT NULL DEFAULT '',
  size       text NOT NULL DEFAULT '',
  color      text NOT NULL DEFAULT '', -- display name
  color_slug text NOT NULL DEFAULT '',
  quantity   int NOT NULL CHECK (quantity > 0),
  unit_price numeric(10, 2) NOT NULL,
  total      numeric(10, 2) NOT NULL
);
CREATE INDEX order_items_order_idx ON order_items (order_id);

CREATE TABLE order_history (
  id         serial PRIMARY KEY,
  order_id   int NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status     text NOT NULL,
  note       text NOT NULL DEFAULT '',
  user_id    int REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE stock_movements (
  id           bigserial PRIMARY KEY,
  variant_id   int NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  warehouse_id int NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  type         text NOT NULL CHECK (type IN ('receipt', 'issue', 'transfer_in', 'transfer_out', 'adjustment', 'sale', 'return')),
  quantity     int NOT NULL, -- signed delta
  balance_after int NOT NULL,
  unit_cost    numeric(10, 2),
  document_id  int REFERENCES stock_documents(id) ON DELETE SET NULL,
  order_id     int REFERENCES orders(id) ON DELETE SET NULL,
  note         text NOT NULL DEFAULT '',
  user_id      int REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stock_movements_variant_idx ON stock_movements (variant_id, created_at DESC);
CREATE INDEX stock_movements_created_idx ON stock_movements (created_at DESC);

CREATE TABLE reviews (
  id          serial PRIMARY KEY,
  product_id  int NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  author      text NOT NULL,
  city        text NOT NULL DEFAULT '',
  rating      smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  content     text NOT NULL,
  reply       text NOT NULL DEFAULT '',
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  is_verified boolean NOT NULL DEFAULT false,
  ip          text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reviews_product_idx ON reviews (product_id, status);

CREATE TABLE posts (
  id              serial PRIMARY KEY,
  slug            text NOT NULL UNIQUE,
  title           text NOT NULL,
  excerpt         text NOT NULL DEFAULT '',
  content         text NOT NULL DEFAULT '',
  cover_id        int REFERENCES media(id) ON DELETE SET NULL,
  category        text NOT NULL DEFAULT '',
  tags            text[] NOT NULL DEFAULT '{}',
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  reading_minutes int NOT NULL DEFAULT 0,
  seo             jsonb NOT NULL DEFAULT '{}',
  author_id       int REFERENCES users(id) ON DELETE SET NULL,
  published_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE contact_messages (
  id         serial PRIMARY KEY,
  name       text NOT NULL,
  phone      text NOT NULL DEFAULT '',
  email      text NOT NULL DEFAULT '',
  message    text NOT NULL DEFAULT '',
  status     text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'archived')),
  ip         text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_by int REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id         bigserial PRIMARY KEY,
  user_id    int REFERENCES users(id) ON DELETE SET NULL,
  action     text NOT NULL,
  entity     text NOT NULL,
  entity_id  text NOT NULL DEFAULT '',
  summary    text NOT NULL DEFAULT '',
  ip         text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_created_idx ON audit_log (created_at DESC);
