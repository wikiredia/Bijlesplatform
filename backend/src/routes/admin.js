import express from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { DateTime } from 'luxon';
import { z } from 'zod';
import { query, tx } from '../db.js';
import { config } from '../config.js';
import { asyncH, HttpError, waLink } from '../lib/util.js';
import { requireAuth, setSession, clearSession } from '../lib/auth.js';
import {
  parse, adminRequestSchema, requestPatchSchema, messageSchema, lessonSchema, lessonPatchSchema, profileSchema, emailSchema,
} from '../lib/validation.js';
import * as notify from '../mail/notify.js';
import { insertRequest } from './public.js';

export const adminRouter = express.Router();

// ───────── Login ─────────

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'Te veel inlogpogingen. Probeer later opnieuw.' },
});

adminRouter.post('/login', loginLimiter, asyncH(async (req, res) => {
  const email = parse(emailSchema, req.body?.email);
  const password = String(req.body?.password || '');
  const t = (await query('SELECT * FROM tutors WHERE lower(email) = $1 AND active', [email])).rows[0];
  const ok = t?.password_hash && (await bcrypt.compare(password, t.password_hash));
  if (!ok) throw new HttpError(401, 'E-mailadres of wachtwoord klopt niet');
  setSession(res, t);
  res.json({ ok: true });
}));

adminRouter.post('/logout', (_req, res) => { clearSession(res); res.json({ ok: true }); });

adminRouter.use(requireAuth);

const me = (t) => ({ id: t.id, slug: t.slug, name: t.name, first_name: t.first_name, email: t.email, subjects: t.subjects });

adminRouter.get('/me', (req, res) => res.json(me(req.tutor)));

adminRouter.post('/password', asyncH(async (req, res) => {
  const { current, next } = parse(z.object({
    current: z.string().min(1), next: z.string().min(10, 'Minstens 10 tekens').max(200),
  }), req.body);
  if (!(await bcrypt.compare(current, req.tutor.password_hash || ''))) {
    throw new HttpError(400, 'Validatie mislukt', { current: 'Huidig wachtwoord klopt niet' });
  }
  const t = (await query(
    'UPDATE tutors SET password_hash = $2, token_version = token_version + 1, updated_at = now() WHERE id = $1 RETURNING *',
    [req.tutor.id, await bcrypt.hash(next, 12)])).rows[0];
  setSession(res, t); // andere sessies worden ongeldig, deze blijft actief
  res.json({ ok: true });
}));

// ───────── Profiel ─────────

const adminProfile = (t) => ({
  slug: t.slug, name: t.name, first_name: t.first_name, email: t.email, whatsapp: t.whatsapp, headline: t.headline,
  bio: t.bio, highlights: t.highlights, projects: t.projects, photo_url: t.photo_url, subjects: t.subjects,
  whatsapp_url: waLink(t.whatsapp),
});

adminRouter.get('/profile', (req, res) => res.json(adminProfile(req.tutor)));

adminRouter.put('/profile', asyncH(async (req, res) => {
  const p = parse(profileSchema, req.body);
  const t = (await query(
    `UPDATE tutors SET headline=$2, bio=$3, highlights=$4, projects=$5, whatsapp=$6, email=$7, photo_url=$8, updated_at=now()
     WHERE id=$1 RETURNING *`,
    [req.tutor.id, p.headline, p.bio, JSON.stringify(p.highlights), JSON.stringify(p.projects), p.whatsapp ?? null, p.email, p.photo_url ?? null],
  )).rows[0];
  res.json(adminProfile(t));
}));

// ───────── Overzicht ─────────

adminRouter.get('/stats', asyncH(async (req, res) => {
  const tid = req.tutor.id;
  const counts = (await query(
    `SELECT status, count(*)::int AS n FROM requests WHERE tutor_id = $1 GROUP BY status`, [tid])).rows;
  const upcoming = (await query(
    `SELECT l.id, l.starts_at, l.duration_min, l.location, r.id AS request_id, r.first_name, r.last_name, r.subject, r.ref
     FROM lessons l JOIN requests r ON r.id = l.request_id
     WHERE l.tutor_id = $1 AND l.status = 'gepland' AND l.starts_at > now() - interval '2 hours'
     ORDER BY l.starts_at LIMIT 10`, [tid])).rows;
  const waitlist = (await query(`SELECT count(*)::int AS n FROM waitlist WHERE notified_at IS NULL`)).rows[0].n;
  const toFinish = (await query(
    `SELECT count(*)::int AS n FROM lessons WHERE tutor_id = $1 AND status = 'gepland' AND starts_at < now() - interval '2 hours'`, [tid])).rows[0].n;
  res.json({ counts: Object.fromEntries(counts.map((c) => [c.status, c.n])), upcoming, waitlist, lessonsToFinish: toFinish });
}));

// ───────── Aanvragen ─────────

const REQ_SELECT = `
  SELECT r.*, t.slug AS tutor_slug, t.name AS tutor_name, t.first_name AS tutor_first_name, t.email AS tutor_email,
    (SELECT min(starts_at) FROM lessons l WHERE l.request_id = r.id AND l.status = 'gepland' AND l.starts_at > now()) AS next_lesson,
    (SELECT count(*)::int FROM messages m WHERE m.request_id = r.id AND m.sender = 'student') AS student_messages
  FROM requests r JOIN tutors t ON t.id = r.tutor_id`;

adminRouter.get('/requests', asyncH(async (req, res) => {
  const where = [];
  const params = [];
  if (req.query.scope !== 'all') { params.push(req.tutor.id); where.push(`r.tutor_id = $${params.length}`); }
  const status = String(req.query.status || '');
  if (status === 'open') where.push(`r.status IN ('nieuw','in_behandeling','ingepland')`);
  else if (status === 'closed') where.push(`r.status IN ('afgerond','afgewezen','geannuleerd')`);
  else if (status) { params.push(status); where.push(`r.status = $${params.length}`); }
  const q = String(req.query.q || '').trim();
  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    where.push(`(lower(r.first_name || ' ' || coalesce(r.last_name,'')) LIKE $${params.length} OR lower(coalesce(r.email,'')) LIKE $${params.length}
      OR lower(r.ref) LIKE $${params.length} OR coalesce(r.phone,'') LIKE $${params.length})`);
  }
  const rows = (await query(
    `${REQ_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY (r.status = 'nieuw') DESC, (r.urgency = 'dringend') DESC, r.created_at DESC LIMIT 300`, params)).rows;
  res.json(rows.map(slim));
}));

const slim = (r) => ({
  id: r.id, ref: r.ref, status: r.status, subject: r.subject, school_year: r.school_year, first_name: r.first_name,
  last_name: r.last_name, urgency: r.urgency, deadline: r.deadline, source: r.source, created_at: r.created_at,
  tutor_slug: r.tutor_slug, tutor_first_name: r.tutor_first_name, next_lesson: r.next_lesson,
  has_email: !!r.email, has_phone: !!r.phone, is_parent: r.is_parent, available_dates: r.available_dates,
});

async function loadRequest(db, id) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, 'Aanvraag niet gevonden');
  const r = (await db.query(`${REQ_SELECT} WHERE r.id = $1`, [id])).rows[0];
  if (!r) throw new HttpError(404, 'Aanvraag niet gevonden');
  return r;
}
const tutorOf = (r) => ({ id: r.tutor_id, slug: r.tutor_slug, name: r.tutor_name, first_name: r.tutor_first_name, email: r.tutor_email });

adminRouter.get('/requests/:id', asyncH(async (req, res) => {
  const r = await loadRequest({ query }, req.params.id);
  const lessons = (await query('SELECT * FROM lessons WHERE request_id = $1 ORDER BY starts_at', [r.id])).rows;
  const messages = (await query('SELECT * FROM messages WHERE request_id = $1 ORDER BY created_at', [r.id])).rows;
  const { token, ...rest } = r;
  res.json({
    ...rest,
    status_url: `${config.publicUrl}/aanvraag/${token}`,
    whatsapp_url: waLink(r.phone, `Hoi ${r.first_name}, ${r.tutor_first_name} hier over je bijlesaanvraag ${subjectWord(r.subject)}. `),
    lessons, messages,
  });
}));
const subjectWord = (s) => ({ wiskunde: 'wiskunde', fysica: 'fysica', programmeren: 'programmeren' }[s] || s);

adminRouter.post('/requests', asyncH(async (req, res) => {
  const data = parse(adminRequestSchema, req.body);
  if (!req.tutor.subjects.includes(data.subject)) {
    throw new HttpError(400, 'Validatie mislukt', { subject: 'Dit vak hoort niet bij jouw profiel' });
  }
  const r = await tx(async (db) => {
    const row = await insertRequest(db, data, {
      tutor_id: req.tutor.id, source: data.source, consent: false, internal_note: data.internal_note,
    });
    if (data.send_confirmation && row.email) {
      // Bevestiging + statuslink naar de leerling; geen "nieuwe aanvraag"-mail naar jezelf
      await notify.onRequestCreated(db, row, me(req.tutor), { notifyTutor: false });
    }
    return row;
  });
  res.status(201).json({ id: r.id });
}));

adminRouter.patch('/requests/:id', asyncH(async (req, res) => {
  const p = parse(requestPatchSchema, req.body);
  await tx(async (db) => {
    const r = await loadRequest(db, req.params.id);
    const tutor = tutorOf(r);

    if (p.tutor && p.tutor !== r.tutor_slug) {
      const to = (await db.query('SELECT * FROM tutors WHERE slug = $1 AND active', [p.tutor])).rows[0];
      if (!to) throw new HttpError(400, 'Onbekende bijlesgever');
      const subject = p.subject || (to.subjects.includes(r.subject) ? r.subject : to.subjects[0]);
      await db.query(`UPDATE lessons SET status='geannuleerd', updated_at=now() WHERE request_id=$1 AND status='gepland'`, [r.id]);
      await db.query(
        `UPDATE requests SET tutor_id=$2, subject=$3, status='nieuw', nudge_sent_at=NULL, last_activity_at=now(), updated_at=now() WHERE id=$1`,
        [r.id, to.id, subject]);
      await db.query(`INSERT INTO messages (request_id, sender, body) VALUES ($1,'systeem',$2)`,
        [r.id, `Doorgestuurd van ${tutor.first_name} naar ${to.first_name}.`]);
      await notify.onRequestForwarded(db, { ...r, subject }, tutor, to);
      return;
    }

    const sets = [];
    const vals = [r.id];
    const set = (col, v) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
    if (p.internal_note !== undefined) set('internal_note', p.internal_note ?? null);
    if (p.email !== undefined) set('email', p.email ?? null);
    if (p.phone !== undefined) set('phone', p.phone ?? null);
    if (p.subject && p.subject !== r.subject) {
      if (!req.tutor.subjects.includes(p.subject) && r.tutor_id === req.tutor.id) throw new HttpError(400, 'Vak hoort niet bij deze bijlesgever');
      set('subject', p.subject);
    }
    const newEmail = p.email !== undefined ? p.email : r.email;
    const newPhone = p.phone !== undefined ? p.phone : r.phone;
    if (!newEmail && !newPhone) throw new HttpError(400, 'Validatie mislukt', { email: 'E-mail of telefoon is nodig' });

    if (p.status && p.status !== r.status) {
      set('status', p.status);
      set('last_activity_at', new Date());
      if (['afgewezen', 'geannuleerd'].includes(p.status)) {
        await db.query(`UPDATE lessons SET status='geannuleerd', updated_at=now() WHERE request_id=$1 AND status='gepland' AND starts_at > now()`, [r.id]);
      }
      if (p.status === 'afgerond') {
        await db.query(`UPDATE lessons SET status='afgerond', updated_at=now() WHERE request_id=$1 AND status='gepland' AND starts_at <= now()`, [r.id]);
      }
      await db.query(`INSERT INTO messages (request_id, sender, body) VALUES ($1,'systeem',$2)`,
        [r.id, `Status gewijzigd naar "${p.status.replace('_', ' ')}" door ${req.tutor.first_name}.`]);
      const updated = { ...r, email: newEmail };
      if (p.status === 'afgewezen') await notify.onRequestDeclined(db, updated, tutor, p.status_message);
      if (p.status === 'afgerond') await notify.onRequestCompleted(db, updated, tutor);
      if (p.status === 'geannuleerd' && p.status_message) await notify.onRequestDeclined(db, updated, tutor, p.status_message);
    }
    if (sets.length) await db.query(`UPDATE requests SET ${sets.join(', ')}, updated_at = now() WHERE id = $1`, vals);
  });
  res.json({ ok: true });
}));

adminRouter.delete('/requests/:id', asyncH(async (req, res) => {
  const r = await loadRequest({ query }, req.params.id);
  await query('DELETE FROM requests WHERE id = $1', [r.id]);
  res.json({ ok: true });
}));

adminRouter.post('/requests/:id/messages', asyncH(async (req, res) => {
  const { body } = parse(messageSchema, req.body);
  const emailed = await tx(async (db) => {
    const r = await loadRequest(db, req.params.id);
    await db.query(`INSERT INTO messages (request_id, sender, body) VALUES ($1,'tutor',$2)`, [r.id, body]);
    await db.query(
      `UPDATE requests SET status = CASE WHEN status = 'nieuw' THEN 'in_behandeling' ELSE status END,
         last_activity_at = now(), updated_at = now() WHERE id = $1`, [r.id]);
    await notify.onTutorMessage(db, r, me(req.tutor), body);
    return !!r.email;
  });
  res.status(201).json({ ok: true, emailed });
}));

// ───────── Lessen ─────────

function toStart(date, time) {
  const dt = DateTime.fromISO(`${date}T${time}`, { zone: config.timezone });
  if (!dt.isValid) throw new HttpError(400, 'Validatie mislukt', { date: 'Ongeldige datum/uur' });
  return dt.toJSDate();
}

adminRouter.post('/requests/:id/lessons', asyncH(async (req, res) => {
  const p = parse(lessonSchema, req.body);
  const notifyFlag = req.body?.notify !== false;
  const lesson = await tx(async (db) => {
    const r = await loadRequest(db, req.params.id);
    const start = toStart(p.date, p.time);
    if (start < new Date(Date.now() - 60 * 60 * 1000)) throw new HttpError(400, 'Validatie mislukt', { date: 'Dit moment ligt in het verleden' });
    const l = (await db.query(
      `INSERT INTO lessons (request_id, tutor_id, starts_at, duration_min, location, note, reminder_sent_at)
       VALUES ($1,$2,$3,$4,$5,$6, $7) RETURNING *`,
      [r.id, r.tutor_id, start, p.duration_min, p.location ?? null, p.note ?? null,
        // les binnen 20u: de inplanmail is meteen ook de herinnering
        start.getTime() - Date.now() < 20 * 3600 * 1000 ? new Date() : null],
    )).rows[0];
    await db.query(`UPDATE requests SET status='ingepland', last_activity_at=now(), updated_at=now() WHERE id=$1`, [r.id]);
    if (notifyFlag) await notify.onLessonPlanned(db, r, tutorOf(r), l);
    return l;
  });
  res.status(201).json(lesson);
}));

adminRouter.get('/lessons', asyncH(async (req, res) => {
  const params = [];
  const where = [];
  if (req.query.scope !== 'all') { params.push(req.tutor.id); where.push(`l.tutor_id = $${params.length}`); }
  if (req.query.when === 'past') where.push(`l.starts_at < now()`);
  else where.push(`l.starts_at >= now() - interval '1 day'`);
  const rows = (await query(
    `SELECT l.*, r.first_name, r.last_name, r.subject, r.ref, r.phone, r.email, t.first_name AS tutor_first_name
     FROM lessons l JOIN requests r ON r.id = l.request_id JOIN tutors t ON t.id = l.tutor_id
     WHERE ${where.join(' AND ')} ORDER BY l.starts_at ${req.query.when === 'past' ? 'DESC' : 'ASC'} LIMIT 200`, params)).rows;
  res.json(rows);
}));

adminRouter.patch('/lessons/:id', asyncH(async (req, res) => {
  const p = parse(lessonPatchSchema, req.body);
  const notifyFlag = req.body?.notify !== false;
  const lesson = await tx(async (db) => {
    const l = (await db.query('SELECT * FROM lessons WHERE id = $1', [req.params.id])).rows[0];
    if (!l) throw new HttpError(404, 'Les niet gevonden');
    const r = await loadRequest(db, l.request_id);
    const cur = DateTime.fromJSDate(l.starts_at).setZone(config.timezone);
    const date = p.date ?? cur.toISODate();
    const time = p.time ?? cur.toFormat('HH:mm');
    const start = toStart(date, time);
    const timeChanged = start.getTime() !== new Date(l.starts_at).getTime() || (p.duration_min && p.duration_min !== l.duration_min);
    const placeChanged = p.location !== undefined && (p.location ?? null) !== l.location;
    const status = p.status ?? l.status;
    const cancelled = status === 'geannuleerd' && l.status !== 'geannuleerd';
    const changed = status === 'gepland' && (timeChanged || placeChanged);
    const u = (await db.query(
      `UPDATE lessons SET starts_at=$2, duration_min=$3, location=$4, note=$5, status=$6,
         ics_sequence = ics_sequence + $7, reminder_sent_at = CASE WHEN $8 THEN NULL ELSE reminder_sent_at END, updated_at=now()
       WHERE id=$1 RETURNING *`,
      [l.id, start, p.duration_min ?? l.duration_min, p.location !== undefined ? p.location : l.location,
        p.note !== undefined ? p.note : l.note, status, cancelled || changed ? 1 : 0, !!timeChanged],
    )).rows[0];
    await db.query('UPDATE requests SET last_activity_at = now(), updated_at = now() WHERE id = $1', [r.id]);
    const upcoming = new Date(u.starts_at) > new Date();
    if (notifyFlag && upcoming && (cancelled || changed)) {
      await notify.onLessonChanged(db, r, tutorOf(r), u, { cancelled, reason: p.reason });
    }
    return u;
  });
  res.json(lesson);
}));

// ───────── Wachtlijst ─────────

adminRouter.get('/waitlist', asyncH(async (_req, res) => {
  res.json((await query('SELECT id, email, subject, first_name, school_year, note, notified_at, created_at FROM waitlist ORDER BY created_at DESC')).rows);
}));

adminRouter.delete('/waitlist/:id', asyncH(async (req, res) => {
  await query('DELETE FROM waitlist WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

adminRouter.post('/waitlist/notify', asyncH(async (req, res) => {
  const p = parse(z.object({
    ids: z.array(z.string().uuid()).min(1).max(500),
    message: z.string().trim().max(2000).optional(),
    link: z.preprocess((v) => (v === '' ? undefined : v), z.string().url().optional()),
  }), req.body);
  const n = await tx(async (db) => {
    const rows = (await db.query('SELECT * FROM waitlist WHERE id = ANY($1::uuid[])', [p.ids])).rows;
    for (const w of rows) await notify.onWaitlistAvailable(db, w, p.message, p.link);
    await db.query('UPDATE waitlist SET notified_at = now() WHERE id = ANY($1::uuid[])', [p.ids]);
    return rows.length;
  });
  res.json({ ok: true, notified: n });
}));
