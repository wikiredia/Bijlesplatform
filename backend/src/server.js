import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { migrate } from './migrate.js';
import { pool } from './db.js';
import { publicRouter } from './routes/public.js';
import { adminRouter } from './routes/admin.js';

const app = express();
app.set('trust proxy', config.trustProxy);
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false })); // CSP zit in nginx (frontend)
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true }); } catch { res.status(503).json({ ok: false }); }
});
app.use('/api/public', publicRouter);
app.use('/api/admin', adminRouter);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Niet gevonden' }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error('[api]', err);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Ongeldige JSON' });
  res.status(status).json({
    error: status >= 500 ? 'Er ging iets mis. Probeer het later opnieuw.' : err.message,
    ...(err.details ? { fields: err.details } : {}),
  });
});

await migrate();
const server = app.listen(config.port, () => console.log(`[api] luistert op :${config.port} (${config.publicUrl})`));

const shutdown = () => { server.close(() => pool.end().then(() => process.exit(0))); setTimeout(() => process.exit(0), 5000).unref(); };
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
