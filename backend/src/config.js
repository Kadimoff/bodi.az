import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function env(name, fallback) {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

export const config = {
  root,
  env: env('NODE_ENV', 'development'),
  host: env('HOST', '0.0.0.0'),
  port: Number(env('PORT', 4000)),
  databaseUrl: env('DATABASE_URL', 'postgres://bodi:bodi@localhost:5432/bodi'),
  // Public site origin, used in canonical URLs, sitemap and schema.org graphs.
  siteUrl: env('SITE_URL', 'https://bodi.az').replace(/\/+$/, ''),
  uploadsDir: path.resolve(env('UPLOADS_DIR', path.join(root, 'uploads'))),
  frontendDir: path.resolve(env('FRONTEND_DIR', path.join(root, '..', 'frontend'))),
  seedDir: path.resolve(env('SEED_DIR', path.join(root, 'seed'))),
  adminDir: path.join(root, 'admin'),
  cookieSecure: env('COOKIE_SECURE', 'false') === 'true',
  sessionDays: Number(env('SESSION_DAYS', 7)),
  rootUsername: env('ADMIN_ROOT_USERNAME', 'root'),
  rootPassword: env('ADMIN_ROOT_PASSWORD', ''),
  maxImageBytes: Number(env('MAX_IMAGE_MB', 15)) * 1024 * 1024,
  maxVideoBytes: Number(env('MAX_VIDEO_MB', 80)) * 1024 * 1024,
};
