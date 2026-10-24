import path from 'node:path';
import fs from 'node:fs/promises';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { config } from './config.js';
import { sql, migrate, waitForDb } from './db.js';
import { seed } from './seed.js';
import { errorHandler } from './lib/errors.js';
import { requireAdmin } from './lib/auth.js';

import catalogRoutes from './routes/public/catalog.js';
import reviewRoutes from './routes/public/reviews.js';
import orderRoutes from './routes/public/orders.js';
import contentRoutes from './routes/public/content.js';
import siteRoutes from './routes/site.js';
import authRoutes from './routes/admin/auth.js';
import productAdminRoutes from './routes/admin/products.js';
import catalogAdminRoutes from './routes/admin/catalog.js';
import mediaAdminRoutes from './routes/admin/media.js';
import orderAdminRoutes from './routes/admin/orders.js';
import contentAdminRoutes from './routes/admin/content.js';
import inventoryRoutes from './routes/admin/inventory.js';
import systemRoutes from './routes/admin/system.js';

export async function buildServer() {
  const app = Fastify({
    logger: { level: config.env === 'production' ? 'info' : 'debug', redact: ['req.headers.cookie', 'body.password'] },
    trustProxy: true,
    bodyLimit: 2 * 1024 * 1024,
    ajv: { customOptions: { coerceTypes: false, removeAdditional: false, allowUnionTypes: true } },
  });

  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler((request, reply) => reply.status(404).send({ error: true, code: 'not_found', message: 'Belə bir ünvan yoxdur.' }));

  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  await app.register(multipart, { limits: { fileSize: Math.max(config.maxImageBytes, config.maxVideoBytes), files: 20 } });

  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    if (request.url.startsWith('/api/admin') || request.url.startsWith('/admin')) {
      reply.header('X-Frame-Options', 'DENY');
      reply.header('Referrer-Policy', 'same-origin');
      if (request.url.startsWith('/api/admin')) reply.header('Cache-Control', 'no-store');
    }
    return payload;
  });

  app.get('/api/health', { logLevel: 'warn' }, async () => {
    await sql`SELECT 1`;
    return { ok: true };
  });

  // Public storefront API
  await app.register(async (api) => {
    await api.register(catalogRoutes);
    await api.register(reviewRoutes);
    await api.register(orderRoutes);
    await api.register(contentRoutes);
  }, { prefix: '/api/v1' });

  // Admin API (session cookie + CSRF header)
  await app.register(authRoutes, { prefix: '/api/admin/auth' });
  await app.register(async (admin) => {
    admin.addHook('onRequest', requireAdmin);
    await admin.register(productAdminRoutes);
    await admin.register(catalogAdminRoutes);
    await admin.register(mediaAdminRoutes);
    await admin.register(orderAdminRoutes);
    await admin.register(contentAdminRoutes);
    await admin.register(inventoryRoutes);
    await admin.register(systemRoutes);
  }, { prefix: '/api/admin' });

  // Server-rendered <head>, sitemap
  await app.register(siteRoutes);

  // Uploaded media (nginx serves these directly in docker; this covers direct access)
  await fs.mkdir(config.uploadsDir, { recursive: true });
  await app.register(fastifyStatic, {
    root: config.uploadsDir,
    prefix: '/uploads/',
    decorateReply: false,
    maxAge: '30d',
    immutable: true,
  });

  // Admin SPA + its vendored ES modules
  await app.register(fastifyStatic, { root: config.adminDir, prefix: '/admin/', decorateReply: false, index: ['index.html'], maxAge: 0 });
  const vendor = {
    'preact.mjs': 'preact/dist/preact.module.js',
    'preact-hooks.mjs': 'preact/hooks/dist/hooks.module.js',
    'htm.mjs': 'htm/dist/htm.module.js',
  };
  app.get('/admin-vendor/:file', async (request, reply) => {
    const rel = vendor[request.params.file];
    if (!rel) return reply.status(404).send();
    const code = await fs.readFile(path.join(config.root, 'node_modules', rel), 'utf8');
    return reply.type('text/javascript; charset=utf-8').header('Cache-Control', 'public, max-age=86400').send(code);
  });
  app.get('/admin', (request, reply) => reply.redirect('/admin/'));

  return app;
}

async function main() {
  const app = await buildServer();
  await waitForDb(app.log);
  await migrate(app.log);
  await seed(app.log);
  await app.listen({ host: config.host, port: config.port });
  const shutdown = async () => {
    await app.close();
    await sql.end({ timeout: 5 });
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
