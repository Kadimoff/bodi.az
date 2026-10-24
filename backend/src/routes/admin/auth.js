import { sql } from '../../db.js';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../../lib/password.js';
import {
  createSession, setSessionCookie, clearSessionCookie, destroySession, requireAdmin, permsFor, audit, ROLES, SESSION_COOKIE,
} from '../../lib/auth.js';
import { badRequest, unauthorized } from '../../lib/errors.js';
import { str } from '../../lib/validate.js';

function presentUser(u) {
  return {
    id: u.id,
    username: u.username,
    full_name: u.full_name,
    email: u.email,
    role: u.role,
    role_label: ROLES[u.role]?.label || u.role,
    perms: permsFor(u.role),
  };
}

// A fixed hash so unknown usernames cost the same time as wrong passwords.
const DUMMY_HASH = await hashPassword('bodi-timing-equalizer');

export default async function authRoutes(app) {
  app.post('/login', {
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    schema: {
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: { username: { type: 'string', maxLength: 80 }, password: { type: 'string', maxLength: 200 } },
      },
    },
  }, async (request, reply) => {
    const username = String(request.body.username).trim().toLowerCase();
    const [user] = await sql`SELECT * FROM users WHERE lower(username) = ${username}`;
    const ok = await verifyPassword(request.body.password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok || !user.is_active) {
      request.log.warn({ username, ip: request.ip }, 'admin login failed');
      throw unauthorized('İstifadəçi adı və ya şifrə yanlışdır.');
    }
    const { token, expires } = await createSession(user.id, request);
    await sql`UPDATE users SET last_login_at = now() WHERE id = ${user.id}`;
    setSessionCookie(reply, token, expires);
    request.user = user;
    await audit(request, 'login', 'user', user.id, 'Sistemə daxil oldu');
    return { user: presentUser(user) };
  });

  app.post('/logout', async (request, reply) => {
    await destroySession(request.cookies?.[SESSION_COOKIE]);
    clearSessionCookie(reply);
    return { success: true };
  });

  app.get('/me', { onRequest: requireAdmin }, async (request) => ({ user: presentUser(request.user) }));

  app.put('/me', { onRequest: requireAdmin }, async (request) => {
    const [u] = await sql`
      UPDATE users SET full_name = ${str(request.body.full_name, 120)}, email = ${str(request.body.email, 160)}, updated_at = now()
      WHERE id = ${request.user.id} RETURNING *`;
    return { user: presentUser(u) };
  });

  app.put('/me/password', { onRequest: requireAdmin, config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const { current_password: current, new_password: next } = request.body || {};
    const [u] = await sql`SELECT * FROM users WHERE id = ${request.user.id}`;
    if (!(await verifyPassword(current, u.password_hash))) throw badRequest('Cari şifrə yanlışdır.');
    const weak = validatePasswordStrength(next);
    if (weak) throw badRequest(weak);
    await sql`UPDATE users SET password_hash = ${await hashPassword(next)}, updated_at = now() WHERE id = ${u.id}`;
    // Sign out every other session of this user.
    await sql`DELETE FROM sessions WHERE user_id = ${u.id}`;
    const { token, expires } = await createSession(u.id, request);
    setSessionCookie(reply, token, expires);
    await audit(request, 'password', 'user', u.id, 'Şifrəsini dəyişdi');
    return { success: true, message: 'Şifrə yeniləndi.' };
  });
}
