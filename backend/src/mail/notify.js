// Alle e-mailmeldingen van het platform. Elke functie zet mails in de outbox;
// de worker verstuurt ze (met retries). Zo faalt een aanvraag nooit door een mailprobleem.

import { config, subjectLabel, subjectWord, URGENCY_LABELS, TIME_PREF_LABELS, LOCATION_LABELS } from '../config.js';
import { renderMail } from './layout.js';
import { lessonIcs } from './ics.js';
import { fmtDate, fmtDateShort, fmtDateTime, fmtTime } from '../lib/util.js';

const url = (p) => `${config.publicUrl}${p}`;
const statusUrl = (r) => url(`/aanvraag/${r.token}`);
const adminUrl = (r) => url(`/beheer/aanvragen/${r.id}`);

export async function enqueue(db, { kind, to, replyTo, mail, attachments = [], sendAfter }) {
  if (!to) return;
  await db.query(
    `INSERT INTO email_outbox (kind, to_address, reply_to, subject, html, text, attachments, send_after)
     VALUES ($1,$2,$3,$4,$5,$6,$7, COALESCE($8, now()))`,
    [kind, to, replyTo || null, mail.subject, mail.html, mail.text, JSON.stringify(attachments), sendAfter || null],
  );
}

const fullName = (r) => [r.first_name, r.last_name].filter(Boolean).join(' ');
const dateList = (arr) => (arr && arr.length ? arr.map(fmtDateShort).join(', ') : '');

function urgencyText(r) {
  if (r.urgency === 'tegen_datum' && r.deadline) return `Tegen ${fmtDate(r.deadline)}`;
  return URGENCY_LABELS[r.urgency] || r.urgency;
}

function requestDetails(r, { forTutor = false } = {}) {
  const rows = [
    ['Referentie', r.ref],
    ['Vak', subjectLabel(r.subject)],
    ['Jaar', r.school_year ? `${r.school_year}de middelbaar${r.school_track ? ` – ${r.school_track}` : ''}` : ''],
    ['Wanneer', urgencyText(r)],
    ['Kan op', dateList(r.available_dates)],
    ['Kan niet op', dateList(r.unavailable_dates)],
    ['Momenten', (r.time_prefs || []).map((t) => TIME_PREF_LABELS[t] || t).join(', ')],
    ['Waar', r.location_pref ? LOCATION_LABELS[r.location_pref] : ''],
  ];
  if (forTutor) {
    rows.push(
      ['Naam', fullName(r) + (r.is_parent ? ' (ouder)' : '')],
      ['Leerling', r.is_parent ? r.student_name : ''],
      ['E-mail', r.email],
      ['Telefoon', r.phone],
      ['Via', r.source === 'website' ? '' : r.source === 'whatsapp' ? 'WhatsApp (manueel ingevoerd)' : 'Manueel ingevoerd'],
    );
  }
  rows.push(['Bericht', r.message]);
  return rows;
}

function lessonDetails(l) {
  const end = new Date(new Date(l.starts_at).getTime() + l.duration_min * 60000);
  return [
    ['Wanneer', fmtDateTime(l.starts_at)],
    ['Duur', `${l.duration_min} minuten (tot ${fmtTime(end)})`],
    ['Waar', l.location || 'Wordt nog afgesproken'],
    ['Opmerking', l.note],
  ];
}

const tutorReply = (t) => (config.mail.replyToTutor ? t.email : undefined);

// ───────────────────────── Aanvragen ─────────────────────────

export async function onRequestCreated(db, r, tutor, { notifyTutor = true } = {}) {
  if (r.email) {
    const pending = r.available_dates?.length
      ? `${tutor.first_name} kijkt eerst of de data die je aanduidde passen. Daarna krijg je een voorstel.`
      : `${tutor.first_name} neemt zo snel mogelijk contact op met een voorstel.`;
    await enqueue(db, {
      kind: 'student.request_received', to: r.email, replyTo: tutorReply(tutor),
      mail: renderMail({
        subject: `Je bijlesaanvraag ${subjectWord(r.subject)} is goed ontvangen (${r.ref})`,
        preheader: `${tutor.first_name} bekijkt je aanvraag.`,
        heading: `Bedankt ${r.first_name}, je aanvraag is ontvangen!`,
        blocks: [
          { p: pending },
          { details: requestDetails(r) },
          { cta: { label: 'Bekijk je aanvraag', url: statusUrl(r) } },
          { note: 'Via die link volg je de status, stuur je een bericht, annuleer je of verwijder je je gegevens. Hou hem dus goed bij.' },
        ],
      }),
    });
  }
  if (!notifyTutor) return;
  const urgent = r.urgency === 'dringend';
  await enqueue(db, {
    kind: 'tutor.request_new', to: tutor.email, replyTo: r.email,
    mail: renderMail({
      subject: `${urgent ? '⚡ DRINGEND – ' : ''}Nieuwe bijlesaanvraag ${subjectWord(r.subject)} van ${r.first_name} (${r.ref})`,
      preheader: `${urgencyText(r)} · ${r.school_year ? r.school_year + 'de middelbaar' : ''}`,
      heading: `Nieuwe aanvraag van ${fullName(r)}`,
      blocks: [
        urgent ? { p: 'Deze leerling heeft de aanvraag als dringend aangeduid.' } : null,
        { details: requestDetails(r, { forTutor: true }) },
        { cta: { label: 'Open in beheer', url: adminUrl(r) } },
        !r.email ? { note: 'Let op: er is geen e-mailadres opgegeven. Neem contact op via telefoon of WhatsApp.' } : null,
      ].filter(Boolean),
    }),
  });
}

export async function onRequestDeclined(db, r, tutor, message) {
  if (!r.email) return;
  await enqueue(db, {
    kind: 'student.request_declined', to: r.email, replyTo: tutorReply(tutor),
    mail: renderMail({
      subject: `Update over je bijlesaanvraag (${r.ref})`,
      heading: `Je aanvraag kan helaas niet doorgaan`,
      blocks: [
        { p: `Hoi ${r.first_name}, ${tutor.first_name} kan je aanvraag voor ${subjectWord(r.subject)} op dit moment helaas niet inplannen.` },
        message ? { quote: message, by: tutor.first_name } : null,
        { p: 'Je mag altijd later opnieuw een aanvraag doen.' },
        { cta: { label: 'Nieuwe aanvraag doen', url: url('/') } },
      ].filter(Boolean),
    }),
  });
}

export async function onRequestCompleted(db, r, tutor) {
  if (!r.email) return;
  await enqueue(db, {
    kind: 'student.request_completed', to: r.email, replyTo: tutorReply(tutor),
    mail: renderMail({
      subject: `Bedankt voor de bijles! (${r.ref})`,
      heading: `Je bijlestraject is afgerond`,
      blocks: [
        { p: `Hoi ${r.first_name}, ${tutor.first_name} heeft je aanvraag voor ${subjectWord(r.subject)} als afgerond gemarkeerd. Veel succes met je toetsen en examens!` },
        { p: 'Heb je later opnieuw hulp nodig? Je bent altijd welkom.' },
        { cta: { label: 'Opnieuw bijles aanvragen', url: url(`/bijles/${tutor.slug}`) } },
        { note: `Je gegevens worden automatisch verwijderd ${config.retention.activeMonths} maanden na de laatste activiteit. Je kan ze ook nu meteen verwijderen via ${statusUrl(r)}.` },
      ],
    }),
  });
}

export async function onRequestForwarded(db, r, fromTutor, toTutor) {
  await enqueue(db, {
    kind: 'tutor.request_forwarded', to: toTutor.email, replyTo: r.email,
    mail: renderMail({
      subject: `${fromTutor.first_name} stuurde een aanvraag naar jou door (${r.ref})`,
      heading: `Doorgestuurde aanvraag van ${fullName(r)}`,
      blocks: [{ details: requestDetails(r, { forTutor: true }) }, { cta: { label: 'Open in beheer', url: adminUrl(r) } }],
    }),
  });
  if (r.email) {
    await enqueue(db, {
      kind: 'student.request_forwarded', to: r.email, replyTo: tutorReply(toTutor),
      mail: renderMail({
        subject: `Je aanvraag is doorgegeven aan ${toTutor.first_name} (${r.ref})`,
        heading: `${toTutor.first_name} neemt je aanvraag over`,
        blocks: [
          { p: `Hoi ${r.first_name}, je aanvraag voor ${subjectWord(r.subject)} wordt voortaan opgevolgd door ${toTutor.name}.` },
          { cta: { label: 'Bekijk je aanvraag', url: statusUrl(r) } },
        ],
      }),
    });
  }
}

export async function onStudentCancelled(db, r, tutor) {
  await enqueue(db, {
    kind: 'tutor.request_cancelled', to: tutor.email,
    mail: renderMail({
      subject: `${r.first_name} heeft de aanvraag geannuleerd (${r.ref})`,
      heading: `Aanvraag geannuleerd`,
      blocks: [
        { p: `${fullName(r)} heeft de aanvraag voor ${subjectWord(r.subject)} geannuleerd. Eventueel geplande lessen zijn ook geannuleerd.` },
        { cta: { label: 'Open in beheer', url: adminUrl(r) } },
      ],
    }),
  });
  if (r.email) {
    await enqueue(db, {
      kind: 'student.request_cancelled', to: r.email,
      mail: renderMail({
        subject: `Je aanvraag is geannuleerd (${r.ref})`,
        heading: 'Je aanvraag is geannuleerd',
        blocks: [
          { p: `Hoi ${r.first_name}, we hebben je annulatie goed ontvangen. ${tutor.first_name} is op de hoogte.` },
          { note: `Wil je je gegevens meteen laten verwijderen? Dat kan via ${statusUrl(r)}. Anders gebeurt dat automatisch na ${config.retention.closedMonths} maanden.` },
        ],
      }),
    });
  }
}

export async function onStudentDeleted(db, { ref, first_name, subject, hadPlannedLessons }, tutor) {
  await enqueue(db, {
    kind: 'tutor.request_deleted', to: tutor.email,
    mail: renderMail({
      subject: `Aanvraag ${ref} is verwijderd door de aanvrager`,
      heading: 'Gegevens verwijderd',
      blocks: [
        { p: `${first_name} heeft aanvraag ${ref} (${subjectWord(subject)}) en alle bijhorende gegevens laten verwijderen.` },
        hadPlannedLessons ? { p: 'Let op: er stonden nog lessen gepland. Die gaan niet meer door.' } : null,
      ].filter(Boolean),
    }),
  });
}

export async function onUnansweredNudge(db, r, tutor) {
  await enqueue(db, {
    kind: 'tutor.nudge', to: tutor.email, replyTo: r.email,
    mail: renderMail({
      subject: `Herinnering: ${r.first_name} wacht nog op antwoord (${r.ref})`,
      heading: `${r.first_name} wacht nog op een antwoord`,
      blocks: [
        { p: `Deze aanvraag (${urgencyText(r).toLowerCase()}) staat nog op "nieuw". Plan een les, stuur een bericht of zet ze op "in behandeling".` },
        { details: requestDetails(r, { forTutor: true }) },
        { cta: { label: 'Open in beheer', url: adminUrl(r) } },
      ],
    }),
  });
}

// ───────────────────────── Berichten ─────────────────────────

export async function onTutorMessage(db, r, tutor, body) {
  if (!r.email) return;
  await enqueue(db, {
    kind: 'student.message', to: r.email, replyTo: tutorReply(tutor),
    mail: renderMail({
      subject: `Nieuw bericht van ${tutor.first_name} over je bijles (${r.ref})`,
      preheader: body.slice(0, 90),
      heading: `${tutor.first_name} stuurde je een bericht`,
      blocks: [
        { quote: body, by: tutor.first_name },
        { cta: { label: 'Antwoorden', url: `${statusUrl(r)}#berichten` } },
      ],
    }),
  });
}

export async function onStudentMessage(db, r, tutor, body) {
  await enqueue(db, {
    kind: 'tutor.message', to: tutor.email, replyTo: r.email,
    mail: renderMail({
      subject: `Nieuw bericht van ${r.first_name} (${r.ref})`,
      preheader: body.slice(0, 90),
      heading: `${fullName(r)} stuurde een bericht`,
      blocks: [{ quote: body, by: r.first_name }, { cta: { label: 'Antwoorden in beheer', url: adminUrl(r) } }],
    }),
  });
}

// ───────────────────────── Lessen ─────────────────────────

function icsFor(r, tutor, l, cancelled, forTutor) {
  return lessonIcs({
    lesson: l,
    cancelled,
    summary: forTutor ? `Bijles ${subjectLabel(r.subject)} – ${r.first_name}` : `Bijles ${subjectLabel(r.subject)} met ${tutor.first_name}`,
    description: forTutor
      ? `${fullName(r)}${r.phone ? ' · ' + r.phone : ''}${r.email ? ' · ' + r.email : ''}\n${adminUrl(r)}`
      : `Ref. ${r.ref}\n${statusUrl(r)}`,
  });
}

export async function onLessonPlanned(db, r, tutor, l) {
  if (r.email) {
    await enqueue(db, {
      kind: 'student.lesson_planned', to: r.email, replyTo: tutorReply(tutor),
      attachments: [icsFor(r, tutor, l, false, false)],
      mail: renderMail({
        subject: `Je bijles is ingepland: ${fmtDateTime(l.starts_at)}`,
        heading: 'Je bijles is ingepland 🎉',
        blocks: [
          { p: `Hoi ${r.first_name}, ${tutor.first_name} heeft je bijles ${subjectWord(r.subject)} ingepland.` },
          { details: lessonDetails(l) },
          { p: 'In de bijlage zit een agenda-uitnodiging. De dag ervoor krijg je nog een herinnering.' },
          { cta: { label: 'Bekijk je aanvraag', url: statusUrl(r) } },
          { note: 'Past dit toch niet? Stuur een bericht via de link hierboven.' },
        ],
      }),
    });
  }
  await enqueue(db, {
    kind: 'tutor.lesson_planned', to: tutor.email, replyTo: r.email,
    attachments: [icsFor(r, tutor, l, false, true)],
    mail: renderMail({
      subject: `Ingepland: ${subjectLabel(r.subject)} met ${r.first_name} – ${fmtDateTime(l.starts_at)}`,
      heading: 'Les ingepland',
      blocks: [
        { details: [...lessonDetails(l), ['Leerling', fullName(r)], ['Telefoon', r.phone], ['E-mail', r.email]] },
        !r.email ? { p: `${r.first_name} heeft geen e-mailadres opgegeven en kreeg dus geen bevestiging. Laat het zeker even weten via ${r.phone}.` } : null,
        { cta: { label: 'Open in beheer', url: adminUrl(r) } },
      ].filter(Boolean),
    }),
  });
}

export async function onLessonChanged(db, r, tutor, l, { cancelled = false, reason } = {}) {
  const what = cancelled ? 'geannuleerd' : 'gewijzigd';
  if (r.email) {
    await enqueue(db, {
      kind: `student.lesson_${cancelled ? 'cancelled' : 'changed'}`, to: r.email, replyTo: tutorReply(tutor),
      attachments: [icsFor(r, tutor, l, cancelled, false)],
      mail: renderMail({
        subject: `Je bijles is ${what}${cancelled ? '' : `: ${fmtDateTime(l.starts_at)}`}`,
        heading: `Je bijles is ${what}`,
        blocks: [
          { p: cancelled
            ? `Hoi ${r.first_name}, de bijles van ${fmtDateTime(l.starts_at)} gaat niet door.`
            : `Hoi ${r.first_name}, ${tutor.first_name} heeft je bijles aangepast. Dit zijn de nieuwe gegevens:` },
          cancelled ? null : { details: lessonDetails(l) },
          reason ? { quote: reason, by: tutor.first_name } : null,
          { cta: { label: 'Bekijk je aanvraag', url: statusUrl(r) } },
        ].filter(Boolean),
      }),
    });
  }
  await enqueue(db, {
    kind: `tutor.lesson_${cancelled ? 'cancelled' : 'changed'}`, to: tutor.email,
    attachments: [icsFor(r, tutor, l, cancelled, true)],
    mail: renderMail({
      subject: `Les ${what}: ${r.first_name} – ${fmtDateTime(l.starts_at)}`,
      heading: `Les ${what}`,
      blocks: [
        { details: [...lessonDetails(l), ['Leerling', fullName(r)]] },
        !r.email ? { p: `Let op: ${r.first_name} heeft geen e-mail en is dus niet automatisch verwittigd (${r.phone}).` } : null,
      ].filter(Boolean),
    }),
  });
}

export async function lessonReminders(db, r, tutor, l) {
  if (r.email) {
    await enqueue(db, {
      kind: 'student.lesson_reminder', to: r.email, replyTo: tutorReply(tutor),
      mail: renderMail({
        subject: `Herinnering: morgen bijles om ${fmtTime(l.starts_at)}`,
        heading: 'Morgen heb je bijles',
        blocks: [
          { p: `Hoi ${r.first_name}, een korte herinnering voor je bijles ${subjectWord(r.subject)} met ${tutor.first_name}.` },
          { details: lessonDetails(l) },
          { p: 'Tip: neem je cursus, oefeningen en eventuele vragen mee.' },
          { cta: { label: 'Bekijk details', url: statusUrl(r) } },
        ],
      }),
    });
  }
  await enqueue(db, {
    kind: 'tutor.lesson_reminder', to: tutor.email, replyTo: r.email,
    mail: renderMail({
      subject: `Morgen: ${subjectLabel(r.subject)} met ${r.first_name} om ${fmtTime(l.starts_at)}`,
      heading: `Morgen bijles met ${r.first_name}`,
      blocks: [
        { details: [...lessonDetails(l), ['Leerling', fullName(r)], ['Jaar', r.school_year ? `${r.school_year}de middelbaar` : ''], ['Telefoon', r.phone], ['E-mail', r.email]] },
        { cta: { label: 'Open in beheer', url: adminUrl(r) } },
      ],
    }),
  });
}

// ───────────────────────── Wachtlijst ─────────────────────────

export async function onWaitlistJoined(db, w, tutors) {
  await enqueue(db, {
    kind: 'student.waitlist_joined', to: w.email,
    mail: renderMail({
      subject: `Je staat op de wachtlijst voor ${w.subject}`,
      heading: 'Je staat op de wachtlijst',
      blocks: [
        { p: `${w.first_name ? `Hoi ${w.first_name}, w` : 'W'}e zoeken nog iemand die bijles geeft voor ${w.subject}. Zodra dat vak beschikbaar is, laten we het je weten via dit e-mailadres.` },
        { note: `Wil je niet meer op de wachtlijst staan? Schrijf je uit via ${url(`/wachtlijst/${w.token}`)}. Na ${config.retention.waitlistMonths} maanden verwijderen we je inschrijving automatisch.` },
      ],
    }),
  });
  for (const t of tutors) {
    await enqueue(db, {
      kind: 'tutor.waitlist_new', to: t.email, replyTo: w.email,
      mail: renderMail({
        subject: `Wachtlijst: iemand zoekt bijles ${w.subject}`,
        heading: 'Nieuwe inschrijving op de wachtlijst',
        blocks: [
          { details: [['Vak', w.subject], ['Naam', w.first_name], ['Jaar', w.school_year ? `${w.school_year}de middelbaar` : ''], ['E-mail', w.email], ['Opmerking', w.note]] },
          { cta: { label: 'Bekijk de wachtlijst', url: url('/beheer/wachtlijst') } },
        ],
      }),
    });
  }
}

export async function onWaitlistAvailable(db, w, message, link) {
  await enqueue(db, {
    kind: 'student.waitlist_available', to: w.email,
    mail: renderMail({
      subject: `Goed nieuws: bijles ${w.subject} is beschikbaar`,
      heading: `Bijles ${w.subject} is nu beschikbaar!`,
      blocks: [
        { p: `${w.first_name ? `Hoi ${w.first_name}, j` : 'J'}e schreef je in op de wachtlijst voor ${w.subject}. We hebben goed nieuws:` },
        message ? { quote: message } : null,
        { cta: { label: 'Bijles aanvragen', url: link || url('/') } },
        { note: `Je inschrijving op de wachtlijst wordt nu afgesloten. Uitschrijven of gegevens verwijderen: ${url(`/wachtlijst/${w.token}`)}` },
      ].filter(Boolean),
    }),
  });
}

// ───────────────────────── Privacy ─────────────────────────

export async function onDeletionRequested(db, email, token) {
  await enqueue(db, {
    kind: 'privacy.deletion_link', to: email,
    mail: renderMail({
      subject: 'Bevestig het verwijderen van je gegevens',
      heading: 'Gegevens verwijderen',
      blocks: [
        { p: `Iemand (hopelijk jij) vroeg om alle gegevens te verwijderen die bij ${email} horen: bijlesaanvragen, geplande lessen, berichten en wachtlijstinschrijvingen.` },
        { cta: { label: 'Ja, verwijder mijn gegevens', url: url(`/privacy/verwijderen/${token}`) } },
        { note: 'Deze link is 24 uur geldig. Heb je dit niet aangevraagd? Dan mag je deze mail negeren; er gebeurt niets.' },
      ],
    }),
  });
}

export { fullName, urgencyText, dateList, fmtDate };
