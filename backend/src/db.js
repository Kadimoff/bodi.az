import fs from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';
import { config } from './config.js';

export const sql = postgres(config.databaseUrl, {
  max: 10,
  idle_timeout: 30,
  onnotice: () => {},
  types: {
    // numeric → JS number (prices fit comfortably in a double)
    numeric: { to: 1700, from: [1700], serialize: (x) => String(x), parse: (x) => Number(x) },
  },
});

const migrationsDir = path.join(config.root, 'src', 'migrations');

export async function migrate(log = console) {
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`;
  const done = new Set((await sql`SELECT name FROM schema_migrations`).map((r) => r.name));
  const files = (await fs.readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    if (done.has(file)) continue;
    const body = await fs.readFile(path.join(migrationsDir, file), 'utf8');
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`INSERT INTO schema_migrations (name) VALUES (${file})`;
    });
    log.info(`[db] miqrasiya tətbiq edildi: ${file}`);
  }
}

export async function waitForDb(log = console, attempts = 30) {
  for (let i = 1; i <= attempts; i++) {
    try {
      await sql`SELECT 1`;
      return;
    } catch (err) {
      if (i === attempts) throw err;
      log.warn(`[db] verilənlər bazası gözlənilir (${i}/${attempts}): ${err.message}`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}
