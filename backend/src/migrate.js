import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { pool, waitForDb } from './db.js';
import { config } from './config.js';
import { defaultProfiles } from './seed-profiles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const LOCK_ID = 7_310_442; // willekeurig getal voor pg_advisory_lock

export async function migrate() {
  await waitForDb();
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    const done = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
    const files = (await fs.readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
    for (const f of files) {
      if (done.has(f)) continue;
      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, f), 'utf8');
      console.log(`[migrate] ${f}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }
    await seedTutors(client);
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {});
    client.release();
  }
}

// Maakt de tutors aan bij de eerste start. Bestaande profielen (aangepast via beheer) blijven ongemoeid.
async function seedTutors(client) {
  for (const t of config.tutors) {
    const exists = await client.query('SELECT id, password_hash, whatsapp FROM tutors WHERE slug = $1', [t.slug]);
    const profile = defaultProfiles[t.slug] || {};
    if (exists.rowCount === 0) {
      const hash = config.adminInitialPassword ? await bcrypt.hash(config.adminInitialPassword, 12) : null;
      await client.query(
        `INSERT INTO tutors (slug, name, first_name, email, whatsapp, subjects, headline, bio, highlights, projects, password_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [t.slug, t.name, t.first_name, t.email, t.whatsapp || null, t.subjects, profile.headline || '', profile.bio || '',
          JSON.stringify(profile.highlights || []), JSON.stringify(profile.projects || []), hash],
      );
      console.log(`[seed] tutor ${t.slug} aangemaakt${hash ? ' (met startwachtwoord)' : ' (nog geen wachtwoord – zie README)'}`);
    } else {
      const row = exists.rows[0];
      if (!row.password_hash && config.adminInitialPassword) {
        await client.query('UPDATE tutors SET password_hash = $2 WHERE slug = $1', [t.slug, await bcrypt.hash(config.adminInitialPassword, 12)]);
        console.log(`[seed] startwachtwoord gezet voor ${t.slug}`);
      }
      if (!row.whatsapp && t.whatsapp) {
        await client.query('UPDATE tutors SET whatsapp = $2 WHERE slug = $1', [t.slug, t.whatsapp]);
      }
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrate().then(() => { console.log('[migrate] klaar'); return pool.end(); })
    .catch((e) => { console.error(e); process.exit(1); });
}
