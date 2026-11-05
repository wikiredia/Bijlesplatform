// Achtergrondproces: verstuurt mails uit de outbox, stuurt herinneringen en ruimt oude gegevens op.

import { DateTime } from 'luxon';
import { config } from './config.js';
import { pool, query, tx } from './db.js';
import { migrate } from './migrate.js';
import { getTransport } from './mail/transport.js';
import * as notify from './mail/notify.js';

const log = (...a) => console.log(new Date().toISOString(), '[worker]', ...a);
const MAX_ATTEMPTS = 6;

// ───────── 1. Outbox versturen ─────────
export async function sendPendingMail() {
  const transport = getTransport();
  let sent = 0;
  for (;;) {
    const done = await tx(async (db) => {
      const m = (await db.query(
        `SELECT * FROM email_outbox WHERE status = 'pending' AND send_after <= now()
         ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED`)).rows[0];
      if (!m) return true;
      try {
        await transport.sendMail({
          from: config.mail.from,
          to: m.to_address,
          replyTo: m.reply_to || undefined,
          subject: m.subject,
          html: m.html,
          text: m.text,
          attachments: (m.attachments || []).map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
        });
        await db.query(`UPDATE email_outbox SET status='sent', sent_at=now(), attempts=attempts+1, last_error=NULL WHERE id=$1`, [m.id]);
        sent++;
      } catch (e) {
        const attempts = m.attempts + 1;
        const failed = attempts >= MAX_ATTEMPTS;
        await db.query(
          `UPDATE email_outbox SET attempts=$2, last_error=$3, status=$4, send_after = now() + ($5 || ' minutes')::interval WHERE id=$1`,
          [m.id, attempts, String(e.message).slice(0, 500), failed ? 'failed' : 'pending', String(2 ** attempts)]);
        log(`mail ${m.id} (${m.kind}) mislukt (poging ${attempts}): ${e.message}`);
      }
      return false;
    });
    if (done) break;
  }
  if (sent) log(`${sent} mail(s) verstuurd`);
}

// ───────── 2. Herinnering de dag voor de les ─────────
export async function lessonReminders() {
  const nowLocal = DateTime.now().setZone(config.timezone);
  if (nowLocal.hour < config.worker.reminderHour) return;
  const tomorrowStart = nowLocal.plus({ days: 1 }).startOf('day');
  const tomorrowEnd = tomorrowStart.endOf('day');
  const lessons = (await query(
    `SELECT l.id FROM lessons l WHERE l.status = 'gepland' AND l.reminder_sent_at IS NULL
       AND l.starts_at BETWEEN $1 AND $2`, [tomorrowStart.toJSDate(), tomorrowEnd.toJSDate()])).rows;
  for (const { id } of lessons) {
    await tx(async (db) => {
      const l = (await db.query(`SELECT * FROM lessons WHERE id = $1 AND reminder_sent_at IS NULL FOR UPDATE SKIP LOCKED`, [id])).rows[0];
      if (!l) return;
      const r = (await db.query('SELECT * FROM requests WHERE id = $1', [l.request_id])).rows[0];
      const t = (await db.query('SELECT * FROM tutors WHERE id = $1', [l.tutor_id])).rows[0];
      await notify.lessonReminders(db, r, t, l);
      await db.query('UPDATE lessons SET reminder_sent_at = now() WHERE id = $1', [l.id]);
      log(`herinnering voor les ${l.id}`);
    });
  }
}

// ───────── 3. Onbeantwoorde aanvragen ─────────
export async function unansweredNudges() {
  const rows = (await query(
    `SELECT r.id FROM requests r WHERE r.status = 'nieuw' AND r.nudge_sent_at IS NULL
       AND r.created_at < now() - (CASE WHEN r.urgency = 'dringend' THEN $1 ELSE $2 END || ' hours')::interval`,
    [String(config.worker.nudgeUrgentHours), String(config.worker.nudgeHours)])).rows;
  for (const { id } of rows) {
    await tx(async (db) => {
      const r = (await db.query(`SELECT * FROM requests WHERE id = $1 AND nudge_sent_at IS NULL FOR UPDATE SKIP LOCKED`, [id])).rows[0];
      if (!r) return;
      const t = (await db.query('SELECT * FROM tutors WHERE id = $1', [r.tutor_id])).rows[0];
      await notify.onUnansweredNudge(db, r, t);
      await db.query('UPDATE requests SET nudge_sent_at = now() WHERE id = $1', [r.id]);
      log(`herinnering onbeantwoorde aanvraag ${r.ref}`);
    });
  }
}

// ───────── 4. Bewaartermijnen toepassen ─────────
export async function retention() {
  const { activeMonths, closedMonths, waitlistMonths, outboxDays } = config.retention;
  const a = await query(
    `DELETE FROM requests r WHERE
       (r.last_activity_at < now() - ($1 || ' months')::interval
         AND NOT EXISTS (SELECT 1 FROM lessons l WHERE l.request_id = r.id AND l.status = 'gepland' AND l.starts_at > now()))
       OR (r.status IN ('afgewezen','geannuleerd') AND r.last_activity_at < now() - ($2 || ' months')::interval)
       OR (r.status IN ('nieuw','in_behandeling') AND r.last_activity_at < now() - ($2 || ' months')::interval
           AND NOT EXISTS (SELECT 1 FROM lessons l WHERE l.request_id = r.id))`,
    [String(activeMonths), String(closedMonths)]);
  const w = await query(`DELETE FROM waitlist WHERE created_at < now() - ($1 || ' months')::interval`, [String(waitlistMonths)]);
  const o = await query(`DELETE FROM email_outbox WHERE status <> 'pending' AND created_at < now() - ($1 || ' days')::interval`, [String(outboxDays)]);
  const d = await query(`DELETE FROM deletion_tokens WHERE expires_at < now() - interval '1 day'`);
  if (a.rowCount || w.rowCount || o.rowCount || d.rowCount) {
    log(`opgeruimd: ${a.rowCount} aanvragen, ${w.rowCount} wachtlijst, ${o.rowCount} mails, ${d.rowCount} tokens`);
  }
}

// ───────── Lus ─────────
function every(ms, name, fn) {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try { await fn(); } catch (e) { log(`${name} fout:`, e.message); } finally { running = false; }
  };
  run();
  return setInterval(run, ms);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await migrate();
  log(`gestart (tijdzone ${config.timezone}, herinneringen vanaf ${config.worker.reminderHour}u)`);
  const timers = [
    every(10_000, 'mail', sendPendingMail),
    every(5 * 60_000, 'herinneringen', lessonReminders),
    every(15 * 60_000, 'nudges', unansweredNudges),
    every(60 * 60_000, 'bewaartermijn', retention),
  ];
  const stop = () => { timers.forEach(clearInterval); pool.end().finally(() => process.exit(0)); };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
