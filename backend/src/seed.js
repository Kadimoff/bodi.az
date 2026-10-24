import fs from 'node:fs/promises';
import path from 'node:path';
import { sql } from './db.js';
import { config } from './config.js';
import { hashPassword } from './lib/password.js';
import { clearColorCache } from './lib/catalog.js';
import { importSnapshot } from './lib/snapshot.js';

// Fallback palette for an install without a snapshot.
const COLORS = [
  ['cream', 'Krem', '#fdf9f3', '#f1ede7', '#8a8478', ['krem']],
  ['beige', 'Bej', '#efe8da', '#ddd0ba', '#8a7a5c', ['bej']],
  ['sage', 'Adaçayı', '#d4e0cf', '#b8ccb5', '#5f705c', ['adacayi', 'yasil', 'green']],
  ['peach', 'Şaftalı', '#fbe3d6', '#f6c7b0', '#a76a52', ['saftali', 'seftali']],
  ['terracotta', 'Terrakotta', '#ecc6b3', '#d99e80', '#9a5238', ['terrakotta']],
  ['white', 'Ağ', '#ffffff', '#eeece6', '#9a988f', ['ag', 'beyaz']],
  ['sky', 'Göy / Mavi', '#d6e4ea', '#b6cbd6', '#54707e', ['goy', 'mavi', 'blue', 'goymavi']],
  ['lavender', 'Lavanta', '#e2dceb', '#c9bcdf', '#6e5e8c', ['lavanta', 'benovseyi', 'purple']],
  ['mustard', 'Xardal', '#efe2bd', '#dcc485', '#8a7334', ['xardal', 'sari', 'yellow']],
  ['rose', 'Çəhrayı', '#f4d9da', '#ebb4b7', '#a65a5e', ['cehrayi', 'gul', 'pink']],
  ['mint', 'Nanə', '#d7ece4', '#bce0d3', '#537869', ['nane']],
  ['olive', 'Zeytun', '#e2e6d5', '#c8d1b1', '#687350', ['zeytun']],
  ['grey', 'Boz', '#f0f0f0', '#dcdcdc', '#707070', ['boz', 'gray', 'gri']],
  ['black', 'Qara', '#555555', '#2b2b2b', '#ffffff', ['qara', 'siyah']],
  ['brown', 'Qəhvəyi', '#e3d2c5', '#c8b09f', '#6d4e3a', ['qehveyi', 'kahverengi']],
];

async function ensureRoot(log) {
  const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM users WHERE role = 'root'`;
  if (n) return;
  if (!config.rootPassword) {
    log.error('[seed] ADMIN_ROOT_PASSWORD təyin edilməyib — root istifadəçi yaradılmadı.');
    return;
  }
  await sql`
    INSERT INTO users (username, full_name, role, password_hash)
    VALUES (${config.rootUsername}, 'Root Administrator', 'root', ${await hashPassword(config.rootPassword)})
    ON CONFLICT (username) DO UPDATE SET role = 'root', is_active = true`;
  log.info(`[seed] root istifadəçi yaradıldı: ${config.rootUsername}`);
}

async function ensureColors() {
  const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM colors`;
  if (n) return;
  let order = 0;
  for (const [slug, name, hex, dark, label, aliases] of COLORS) {
    await sql`INSERT INTO colors (slug, name, hex, hex_dark, label_color, aliases, sort_order)
              VALUES (${slug}, ${name}, ${hex}, ${dark}, ${label}, ${aliases}, ${order++})`;
  }
  clearColorCache();
}

async function ensureWarehouse() {
  const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM warehouses`;
  if (!n) await sql`INSERT INTO warehouses (code, name, address, is_default) VALUES ('ANB-01', 'Əsas anbar', 'Bakı', true)`;
}

/**
 * First boot: root user, then the bundled snapshot (seed/data.json + images)
 * when the catalog is empty, then defaults for anything still missing.
 */
export async function seed(log = console) {
  await ensureRoot(log);
  const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM products`;
  if (!n) {
    try {
      await fs.access(path.join(config.seedDir, 'data.json'));
      await importSnapshot(config.seedDir, log);
    } catch (err) {
      if (err.code === 'ENOENT') log.info('[seed] seed/data.json yoxdur, boş kataloqla başlanılır.');
      else throw err;
    }
  }
  await ensureColors();
  await ensureWarehouse();
}
