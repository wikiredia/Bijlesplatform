import express from 'express';
import rateLimit from 'express-rate-limit';
import { query, tx } from '../db.js';
import { config, SUBJECTS } from '../config.js';
import { asyncH, HttpError, newRef, newToken, waLink } from '../lib/util.js';
import { parse, publicRequestSchema, waitlistSchema, messageSchema, emailSchema } from '../lib/validation.js';
import * as notify from '../mail/notify.js';

export const publicRouter = express.Router();

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'Te veel aanvragen. Probeer het over een kwartiertje opnieuw.' },
});
const readLimiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false });
publicRouter.use(readLimiter);

// ───────── Config & tutors ─────────

publicRouter.get('/config', asyncH(async (_req, res) => {
  const tutors = (await query('SELECT slug, name, first_name, subjects FROM tutors WHERE active ORDER BY id')).rows;
  res.json({
    siteName: config.siteName,
    subjects: SUBJECTS,
    tutors,
    privacy: { ...config.privacy },
    retention: config.retention,
  });
}));

function publicTutor(t) {
  return {
    slug: t.slug,
    name: t.name,
    first_name: t.first_name,
    headline: t.headline,
    bio: t.bio,
    subjects: t.subjects,
    highlights: t.highlights,
    projects: t.projects,
    photo_url: t.photo_url,
    whatsapp_url: waLink(t.whatsapp, `Hoi ${t.first_name}! Ik zou graag bijles willen. `),
  };
}

publicRouter.get('/tutors/:slug', asyncH(async (req, res) => {
  const t = (await query('SELECT * FROM tutors WHERE slug = $1 AND active', [req.params.slug])).rows[0];
  if (!t) throw new HttpError(404, 'Niet gevonden');
  res.json(publicTutor(t));
}));

// ───────── Aanvraag indienen ─────────

async function insertRequest(db, data, extra) {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await db.query(
        `INSERT INTO requests (token, ref, tutor_id, subject, school_year, school_track, first_name, last_name, email, phone,
          is_parent, student_name, urgency, deadline, available_dates, unavailable_dates, time_prefs, location_pref, message,
          source, consent_at, privacy_version, internal_note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) RETURNING *`,
        [newToken(), newRef(), extra.tutor_id, data.subject, data.school_year ?? null, data.school_track ?? null,
          data.first_name, data.last_name ?? null, data.email ?? null, data.phone ?? null, data.is_parent,
          data.is_parent ? data.student_name ?? null : null, data.urgency,
          data.urgency === 'tegen_datum' ? data.deadline : null, data.available_dates, data.unavailable_dates,
          data.time_prefs, data.location_pref ?? null, data.message ?? null, extra.source,
          extra.consent ? new Date() : null, extra.consent ? config.privacy.version : null, extra.internal_note ?? null],
      );
      return r.rows[0];
    } catch (e) {
      if (e.code === '23505' && /ref|token/.test(e.constraint || '')) continue; // botsing referentie → opnieuw
      throw e;
    }
  }
  throw new Error('Kon geen unieke referentie maken');
}
export { insertRequest };

publicRouter.post('/requests', writeLimiter, asyncH(async (req, res) => {
  const data = parse(publicRequestSchema, req.body);
  if (data.website) return res.status(201).json({ ok: true }); // honeypot: doen alsof
  const tutor = (await query('SELECT * FROM tutors WHERE slug = $1 AND active', [data.tutor])).rows[0];
  if (!tutor) throw new HttpError(404, 'Deze bijlesgever bestaat niet');
  if (!tutor.subjects.includes(data.subject)) {
    throw new HttpError(400, 'Validatie mislukt', { subject: `${tutor.first_name} geeft dit vak niet` });
  }
  const r = await tx(async (db) => {
    const row = await insertRequest(db, data, { tutor_id: tutor.id, source: 'website', consent: true });
    await notify.onRequestCreated(db, row, tutor);
    return row;
  });
  res.status(201).json({ ok: true, ref: r.ref, token: r.token, hasEmail: !!r.email });
}));

// ───────── Statuspagina (via geheime link) ─────────

async function loadByToken(db, token) {
  if (!token || token.length < 20) throw new HttpError(404, 'Aanvraag niet gevonden');
  const r = (await db.query(
    `SELECT r.*, t.slug AS tutor_slug, t.name AS tutor_name, t.first_name AS tutor_first_name, t.email AS tutor_email, t.whatsapp AS tutor_whatsapp
     FROM requests r JOIN tutors t ON t.id = r.tutor_id WHERE r.token = $1`, [token])).rows[0];
  if (!r) throw new HttpError(404, 'Aanvraag niet gevonden of al verwijderd');
  return r;
}
const tutorOf = (r) => ({ id: r.tutor_id, slug: r.tutor_slug, name: r.tutor_name, first_name: r.tutor_first_name, email: r.tutor_email });

publicRouter.get('/requests/:token', asyncH(async (req, res) => {
  const r = await loadByToken({ query }, req.params.token);
  const lessons = (await query(
    `SELECT id, starts_at, duration_min, location, note, status FROM lessons WHERE request_id = $1 ORDER BY starts_at`, [r.id])).rows;
  const messages = (await query(
    `SELECT id, sender, body, created_at FROM messages WHERE request_id = $1 ORDER BY created_at`, [r.id])).rows;
  res.json({
    ref: r.ref, status: r.status, subject: r.subject, school_year: r.school_year, school_track: r.school_track,
    first_name: r.first_name, last_name: r.last_name, email: r.email, phone: r.phone, is_parent: r.is_parent,
    student_name: r.student_name, urgency: r.urgency, deadline: r.deadline, available_dates: r.available_dates,
    unavailable_dates: r.unavailable_dates, time_prefs: r.time_prefs, location_pref: r.location_pref,
    message: r.message, created_at: r.created_at,
    tutor: { slug: r.tutor_slug, name: r.tutor_name, first_name: r.tutor_first_name,
      whatsapp_url: waLink(r.tutor_whatsapp, `Hoi ${r.tutor_first_name}, over mijn aanvraag ${r.ref}: `) },
    lessons, messages,
  });
}));

const OPEN = ['nieuw', 'in_behandeling', 'ingepland'];

publicRouter.post('/requests/:token/messages', writeLimiter, asyncH(async (req, res) => {
  const { body } = parse(messageSchema, req.body);
  await tx(async (db) => {
    const r = await loadByToken(db, req.params.token);
    if (!OPEN.includes(r.status)) throw new HttpError(409, 'Deze aanvraag is afgesloten. Doe gerust een nieuwe aanvraag.');
    await db.query(`INSERT INTO messages (request_id, sender, body) VALUES ($1,'student',$2)`, [r.id, body]);
    await db.query('UPDATE requests SET last_activity_at = now(), updated_at = now() WHERE id = $1', [r.id]);
    await notify.onStudentMessage(db, r, tutorOf(r), body);
  });
  res.status(201).json({ ok: true });
}));

publicRouter.post('/requests/:token/cancel', writeLimiter, asyncH(async (req, res) => {
  await tx(async (db) => {
    const r = await loadByToken(db, req.params.token);
    if (!OPEN.includes(r.status)) throw new HttpError(409, 'Deze aanvraag is al afgesloten');
    await db.query(`UPDATE lessons SET status = 'geannuleerd', updated_at = now() WHERE request_id = $1 AND status = 'gepland'`, [r.id]);
    await db.query(`UPDATE requests SET status = 'geannuleerd', last_activity_at = now(), updated_at = now() WHERE id = $1`, [r.id]);
    await db.query(`INSERT INTO messages (request_id, sender, body) VALUES ($1,'systeem','Aanvraag geannuleerd door de aanvrager.')`, [r.id]);
    await notify.onStudentCancelled(db, r, tutorOf(r));
  });
  res.json({ ok: true });
}));

publicRouter.delete('/requests/:token', writeLimiter, asyncH(async (req, res) => {
  await tx(async (db) => {
    const r = await loadByToken(db, req.params.token);
    const planned = (await db.query(
      `SELECT 1 FROM lessons WHERE request_id = $1 AND status = 'gepland' AND starts_at > now() LIMIT 1`, [r.id])).rowCount > 0;
    await db.query('DELETE FROM requests WHERE id = $1', [r.id]);
    await notify.onStudentDeleted(db, { ref: r.ref, first_name: r.first_name, subject: r.subject, hadPlannedLessons: planned }, tutorOf(r));
  });
  res.json({ ok: true });
}));

// ───────── Wachtlijst (vak "andere") ─────────

publicRouter.post('/waitlist', writeLimiter, asyncH(async (req, res) => {
  const data = parse(waitlistSchema, req.body);
  if (data.website) return res.status(201).json({ ok: true });
  await tx(async (db) => {
    const w = (await db.query(
      `INSERT INTO waitlist (token, email, subject, first_name, school_year, note, consent_at, privacy_version)
       VALUES ($1,$2,$3,$4,$5,$6, now(), $7) RETURNING *`,
      [newToken(), data.email, data.subject, data.first_name ?? null, data.school_year ?? null, data.note ?? null, config.privacy.version],
    )).rows[0];
    const tutors = (await db.query('SELECT * FROM tutors WHERE active')).rows;
    await notify.onWaitlistJoined(db, w, tutors);
  });
  res.status(201).json({ ok: true });
}));

publicRouter.get('/waitlist/:token', asyncH(async (req, res) => {
  const w = (await query('SELECT subject, email, created_at, notified_at FROM waitlist WHERE token = $1', [req.params.token])).rows[0];
  if (!w) throw new HttpError(404, 'Inschrijving niet gevonden of al verwijderd');
  res.json(w);
}));

publicRouter.delete('/waitlist/:token', writeLimiter, asyncH(async (req, res) => {
  const r = await query('DELETE FROM waitlist WHERE token = $1', [req.params.token]);
  if (!r.rowCount) throw new HttpError(404, 'Inschrijving niet gevonden of al verwijderd');
  res.json({ ok: true });
}));

// ───────── Alle gegevens verwijderen (via e-mailbevestiging) ─────────

publicRouter.post('/deletion', writeLimiter, asyncH(async (req, res) => {
  const email = parse(emailSchema, req.body?.email);
  await tx(async (db) => {
    const has = (await db.query(
      `SELECT (SELECT count(*) FROM requests WHERE lower(email) = $1) + (SELECT count(*) FROM waitlist WHERE lower(email) = $1) AS n`,
      [email])).rows[0].n > 0;
    if (!has) return; // geen gegevens: niets doen, maar hetzelfde antwoord geven (geen info lekken)
    const token = newToken();
    await db.query(`INSERT INTO deletion_tokens (token, email, expires_at) VALUES ($1,$2, now() + interval '24 hours')`, [token, email]);
    await notify.onDeletionRequested(db, email, token);
  });
  res.json({ ok: true });
}));

async function validDeletionToken(db, token) {
  const t = (await db.query(`SELECT * FROM deletion_tokens WHERE token = $1`, [token])).rows[0];
  if (!t || t.used_at || new Date(t.expires_at) < new Date()) throw new HttpError(404, 'Deze link is ongeldig of verlopen. Vraag een nieuwe aan.');
  return t;
}

publicRouter.get('/deletion/:token', asyncH(async (req, res) => {
  const t = await validDeletionToken({ query }, req.params.token);
  const counts = (await query(
    `SELECT (SELECT count(*) FROM requests WHERE lower(email) = $1)::int AS requests,
            (SELECT count(*) FROM waitlist WHERE lower(email) = $1)::int AS waitlist`, [t.email])).rows[0];
  res.json({ email: t.email, ...counts });
}));

publicRouter.post('/deletion/:token/confirm', writeLimiter, asyncH(async (req, res) => {
  const result = await tx(async (db) => {
    const t = await validDeletionToken(db, req.params.token);
    const reqs = (await db.query(
      `SELECT r.*, t.slug AS tutor_slug, t.name AS tutor_name, t.first_name AS tutor_first_name, t.email AS tutor_email,
         EXISTS (SELECT 1 FROM lessons l WHERE l.request_id = r.id AND l.status = 'gepland' AND l.starts_at > now()) AS planned
       FROM requests r JOIN tutors t ON t.id = r.tutor_id WHERE lower(r.email) = $1`, [t.email])).rows;
    for (const r of reqs) {
      await db.query('DELETE FROM requests WHERE id = $1', [r.id]);
      if (OPEN.includes(r.status)) {
        await notify.onStudentDeleted(db, { ref: r.ref, first_name: r.first_name, subject: r.subject, hadPlannedLessons: r.planned }, tutorOf(r));
      }
    }
    const w = await db.query('DELETE FROM waitlist WHERE lower(email) = $1', [t.email]);
    // Ook (verzonden en nog niet verzonden) mailkopieën naar dit adres schrappen
    await db.query(`DELETE FROM email_outbox WHERE lower(to_address) = $1`, [t.email]);
    await db.query('UPDATE deletion_tokens SET used_at = now() WHERE token = $1', [t.token]);
    return { requests: reqs.length, waitlist: w.rowCount };
  });
  res.json({ ok: true, ...result });
}));
