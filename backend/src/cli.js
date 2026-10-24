// Maintenance commands:
//   node src/cli.js migrate
//   node src/cli.js seed
//   node src/cli.js export <qovluq> [--orders]   (snapshot: data.json + images/)
//   node src/cli.js import <qovluq>              (only into an empty catalog)
//   NEW_PASSWORD=... node src/cli.js reset-password <istifadəçi>
import { sql, migrate, waitForDb } from './db.js';
import { seed } from './seed.js';
import { exportSnapshot, importSnapshot } from './lib/snapshot.js';
import { hashPassword, validatePasswordStrength } from './lib/password.js';

const [cmd, arg, ...flags] = process.argv.slice(2);
const log = { info: console.log, warn: console.warn, error: console.error };

try {
  await waitForDb(log);
  if (cmd === 'migrate') {
    await migrate(log);
  } else if (cmd === 'seed') {
    await migrate(log);
    await seed(log);
  } else if (cmd === 'export') {
    if (!arg) throw new Error('İstifadə: node src/cli.js export <qovluq> [--orders]');
    const r = await exportSnapshot(arg, { orders: flags.includes('--orders') });
    console.log(`Snapshot yazıldı: ${arg} — ${r.products} məhsul, ${r.posts} yazı, ${r.images} şəkil, ${r.orders} sifariş`);
  } else if (cmd === 'import') {
    if (!arg) throw new Error('İstifadə: node src/cli.js import <qovluq>');
    await migrate(log);
    const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM products`;
    if (n) throw new Error('Kataloq boş deyil — idxal yalnız boş verilənlər bazasına edilir.');
    await importSnapshot(arg, log);
    await seed(log);
  } else if (cmd === 'reset-password') {
    // Password comes from the environment so it never lands in shell history.
    const password = process.env.NEW_PASSWORD;
    if (!arg || !password) throw new Error('İstifadə: NEW_PASSWORD=... node src/cli.js reset-password <istifadəçi>');
    const weak = validatePasswordStrength(password);
    if (weak) throw new Error(weak);
    const rows = await sql`UPDATE users SET password_hash = ${await hashPassword(password)}, is_active = true, updated_at = now() WHERE username = ${arg} RETURNING id`;
    if (!rows.length) throw new Error(`İstifadəçi tapılmadı: ${arg}`);
    await sql`DELETE FROM sessions WHERE user_id = ${rows[0].id}`;
    console.log(`Şifrə yeniləndi: ${arg}`);
  } else {
    throw new Error('Əmrlər: migrate | seed | export <qovluq> [--orders] | import <qovluq> | reset-password <istifadəçi>');
  }
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
