// Gebruik: docker compose exec api node src/cli/set-password.js <yeno|reda> [wachtwoord]
// Zonder wachtwoord wordt een sterk willekeurig wachtwoord gegenereerd en getoond.
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';

const [slug, given] = process.argv.slice(2);
if (!slug) {
  console.error('Gebruik: node src/cli/set-password.js <yeno|reda> [wachtwoord]');
  process.exit(1);
}
const password = given || crypto.randomBytes(9).toString('base64url');
if (password.length < 10) {
  console.error('Wachtwoord moet minstens 10 tekens hebben.');
  process.exit(1);
}
const r = await pool.query(
  'UPDATE tutors SET password_hash = $2, token_version = token_version + 1 WHERE slug = $1 RETURNING email',
  [slug, await bcrypt.hash(password, 12)],
);
if (!r.rowCount) {
  console.error(`Geen tutor gevonden met slug "${slug}".`);
  process.exit(1);
}
console.log(`Wachtwoord ingesteld voor ${slug} (${r.rows[0].email})${given ? '' : `: ${password}`}`);
await pool.end();
