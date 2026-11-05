import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db.js';
import { HttpError } from './util.js';

export const COOKIE = 'bijles_sess';
const MAX_AGE = 1000 * 60 * 60 * 24 * 14; // 14 dagen

export function setSession(res, tutor) {
  const token = jwt.sign({ tid: tutor.id, v: tutor.token_version }, config.sessionSecret, { expiresIn: '14d' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.publicUrl.startsWith('https://'),
    maxAge: MAX_AGE,
    path: '/api',
  });
}

export function clearSession(res) {
  res.clearCookie(COOKIE, { path: '/api' });
}

export async function requireAuth(req, _res, next) {
  try {
    const raw = req.cookies?.[COOKIE];
    if (!raw) throw new HttpError(401, 'Niet ingelogd');
    let payload;
    try { payload = jwt.verify(raw, config.sessionSecret); } catch { throw new HttpError(401, 'Sessie verlopen'); }
    const t = (await query('SELECT * FROM tutors WHERE id = $1 AND active', [payload.tid])).rows[0];
    if (!t || t.token_version !== payload.v) throw new HttpError(401, 'Sessie verlopen');
    // CSRF-bescherming: wijzigende verzoeken moeten van onze eigen frontend komen
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('x-requested-with') !== 'bijles') {
      throw new HttpError(403, 'Ongeldig verzoek');
    }
    req.tutor = t;
    next();
  } catch (e) {
    next(e);
  }
}
