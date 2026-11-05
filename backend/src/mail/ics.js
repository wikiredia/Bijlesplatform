import { config } from '../config.js';

const fmt = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (m) => `\\${m}`);

// RFC 5545: regels max 75 octets, vervolgregels starten met spatie
function fold(line) {
  const out = [];
  let cur = '';
  for (const ch of line) {
    if (Buffer.byteLength(cur + ch) > 73) { out.push(cur); cur = ' ' + ch; } else cur += ch;
  }
  out.push(cur);
  return out.join('\r\n');
}

/** Maakt een .ics-bijlage voor een les. cancelled=true geeft een annulatie. */
export function lessonIcs({ lesson, summary, description, cancelled = false }) {
  const start = new Date(lesson.starts_at);
  const end = new Date(start.getTime() + lesson.duration_min * 60000);
  const host = new URL(config.publicUrl).hostname || 'bijlesplatform';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Bijlesplatform//NL',
    'CALSCALE:GREGORIAN',
    `METHOD:${cancelled ? 'CANCEL' : 'PUBLISH'}`,
    'BEGIN:VEVENT',
    `UID:${lesson.id}@${host}`,
    `SEQUENCE:${lesson.ics_sequence || 0}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${esc(summary)}`,
    lesson.location ? `LOCATION:${esc(lesson.location)}` : null,
    description ? `DESCRIPTION:${esc(description)}` : null,
    `STATUS:${cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    cancelled ? null : 'BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Bijles\r\nTRIGGER:-PT1H\r\nEND:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return {
    filename: cancelled ? 'bijles-geannuleerd.ics' : 'bijles.ics',
    content: lines.map((l) => (l.includes('\r\n') ? l : fold(l))).join('\r\n') + '\r\n',
    contentType: `text/calendar; charset=utf-8; method=${cancelled ? 'CANCEL' : 'PUBLISH'}`,
  };
}
