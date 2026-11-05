import pg from 'pg';
import { config } from './config.js';

// DATE-kolommen als 'YYYY-MM-DD' string teruggeven, niet als JS Date (tijdzonevalkuil)
pg.types.setTypeParser(1082, (v) => v);
pg.types.setTypeParser(1182, (v) => pg.types.arrayParser.create(v, (x) => x).parse());

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });

pool.on('error', (err) => console.error('[db] idle client error', err.message));

export const query = (text, params) => pool.query(text, params);

export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function waitForDb(retries = 30) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (e) {
      console.log(`[db] wachten op database… (${e.code || e.message})`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('Database niet bereikbaar');
}
