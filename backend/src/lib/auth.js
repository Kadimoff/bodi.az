import { sql } from '../db.js';
import { config } from '../config.js';
import { randomToken, sha256 } from './password.js';
import { forbidden, unauthorized } from './errors.js';

export const SESSION_COOKIE = 'bodi_admin';

export const ROLES = {
  root: { label: 'Root (tam səlahiyyət)', perms: ['*'] },
  admin: { label: 'Administrator', perms: ['dashboard', 'catalog', 'media', 'reviews', 'orders', 'coupons', 'inventory', 'content', 'seo', 'messages', 'settings', 'users', 'audit'] },
  editor: { label: 'Redaktor', perms: ['dashboard', 'catalog', 'media', 'reviews', 'content', 'seo', 'messages'] },
  warehouse: { label: 'Anbardar', perms: ['dashboard', 'inventory', 'orders'] },
};

export function can(user, perm) {
  if (!user) return false;
  const perms = ROLES[user.role]?.perms || [];
  return perms.includes('*') || perms.includes(perm);
}

export function permsFor(role) {
  const perms = ROLES[role]?.perms || [];
  return perms.includes('*') ? ROLES.admin.perms : perms;
}

export async function createSession(userId, request) {
  const token = randomToken(32);
  const expires = new Date(Date.now() + config.sessionDays * 86400_000);
  await sql`
    INSERT INTO sessions (id, user_id, expires_at, ip, user_agent)
    VALUES (${sha256(token)}, ${userId}, ${expires}, ${request.ip || ''}, ${String(request.headers['user-agent'] || '').slice(0, 300)})`;
  await sql`DELETE FROM sessions WHERE expires_at < now()`;
  return { token, expires };
}

export function setSessionCookie(reply, token, expires) {
  reply.setCookie(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: config.cookieSecure,
    expires,
  });
}

export function clearSessionCookie(reply) {
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
}

export async function destroySession(token) {
  if (token) await sql`DELETE FROM sessions WHERE id = ${sha256(token)}`;
}

async function userFromRequest(request) {
  const token = request.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  const [row] = await sql`
    SELECT u.id, u.username, u.full_name, u.email, u.role, u.is_active, s.expires_at, s.id AS sid
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.id = ${sha256(token)} AND s.expires_at > now()`;
  if (!row || !row.is_active) return null;
  // Sliding expiry: extend once less than half of the lifetime is left.
  const halfLife = (config.sessionDays * 86400_000) / 2;
  if (new Date(row.expires_at).getTime() - Date.now() < halfLife) {
    await sql`UPDATE sessions SET expires_at = ${new Date(Date.now() + config.sessionDays * 86400_000)} WHERE id = ${row.sid}`;
  }
  delete row.sid;
  return row;
}

/**
 * onRequest hook for /api/admin/*: requires a valid session, and for any
 * state-changing method a custom header that cross-site forms cannot send.
 */
export async function requireAdmin(request) {
  const user = await userFromRequest(request);
  if (!user) throw unauthorized('Sessiya bitib. Zəhmət olmasa yenidən daxil olun.');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.headers['x-bodi-admin'] !== '1') {
    throw forbidden('Sorğu təsdiqlənmədi (CSRF qoruması).');
  }
  request.user = user;
}

export function requirePerm(perm) {
  return async (request) => {
    if (!can(request.user, perm)) throw forbidden();
  };
}

export async function audit(request, action, entity, entityId = '', summary = '') {
  try {
    await sql`
      INSERT INTO audit_log (user_id, action, entity, entity_id, summary, ip)
      VALUES (${request.user?.id ?? null}, ${action}, ${entity}, ${String(entityId ?? '')}, ${String(summary).slice(0, 500)}, ${request.ip || ''})`;
  } catch (err) {
    request.log.warn({ err }, 'audit log failed');
  }
}
