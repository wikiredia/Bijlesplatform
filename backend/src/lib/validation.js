import { z } from 'zod';
import { DateTime } from 'luxon';
import { config } from '../config.js';

const trimmed = (max) => z.string().trim().max(max);
const optText = (max) => z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), trimmed(max).optional());

export const emailSchema = z.string().trim().toLowerCase().max(254).email('Ongeldig e-mailadres');

const optEmail = z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), emailSchema.optional());
const optPhone = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().trim().max(30)
    .refine((v) => /^[+\d][\d\s./()-]*$/.test(v) && v.replace(/\D/g, '').length >= 8 && v.replace(/\D/g, '').length <= 15,
      'Ongeldig telefoonnummer')
    .optional(),
);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ongeldige datum')
  .refine((v) => DateTime.fromISO(v).isValid, 'Ongeldige datum');

const today = () => DateTime.now().setZone(config.timezone).startOf('day');
const futureDate = isoDate.refine((v) => DateTime.fromISO(v, { zone: config.timezone }) >= today(), 'Datum ligt in het verleden')
  .refine((v) => DateTime.fromISO(v, { zone: config.timezone }) <= today().plus({ days: 366 }), 'Datum ligt te ver in de toekomst');

const dateList = z.array(futureDate).max(90).default([]).transform((a) => [...new Set(a)].sort());

export const requestFields = {
  subject: z.enum(['wiskunde', 'fysica', 'programmeren', 'ict', 'elektronica']),
  school_year: z.coerce.number().int().min(1).max(6).optional().nullable(),
  school_track: optText(80),
  first_name: trimmed(60).min(1, 'Voornaam is verplicht'),
  last_name: optText(80),
  email: optEmail,
  phone: optPhone,
  is_parent: z.boolean().default(false),
  student_name: optText(80),
  urgency: z.enum(['dringend', 'deze_week', 'volgende_week', 'tegen_datum', 'flexibel']),
  deadline: z.preprocess((v) => (v === '' || v === null ? undefined : v), futureDate.optional()),
  available_dates: dateList,
  unavailable_dates: dateList,
  time_prefs: z.array(z.enum(['voormiddag', 'namiddag', 'avond', 'weekend'])).max(4).default([]),
  location_pref: z.enum(['aan_huis', 'online', 'geen_voorkeur']).optional().nullable(),
  message: optText(2000),
};

function requestRefinements(d, ctx) {
  if (!d.email && !d.phone) {
    ctx.addIssue({ code: 'custom', path: ['email'], message: 'Vul een e-mailadres of telefoonnummer in' });
  }
  if (d.urgency === 'tegen_datum' && !d.deadline) {
    ctx.addIssue({ code: 'custom', path: ['deadline'], message: 'Kies tegen welke datum je bijles wilt' });
  }
  const overlap = d.available_dates.filter((x) => d.unavailable_dates.includes(x));
  if (overlap.length) {
    ctx.addIssue({ code: 'custom', path: ['available_dates'], message: 'Een datum kan niet tegelijk "kan" en "kan niet" zijn' });
  }
}

export const publicRequestSchema = z.object({
  ...requestFields,
  school_year: z.coerce.number({ message: 'Kies in welk jaar je zit' }).int().min(1, 'Kies in welk jaar je zit').max(6),
  tutor: z.enum(['yeno', 'reda']),
  consent: z.literal(true, { message: 'Je moet akkoord gaan met de privacyverklaring' }),
  website: z.string().max(0).optional().or(z.literal('')), // honeypot
}).superRefine(requestRefinements);

export const adminRequestSchema = z.object({
  ...requestFields,
  urgency: requestFields.urgency.default('flexibel'),
  source: z.enum(['whatsapp', 'manueel']).default('whatsapp'),
  internal_note: optText(2000),
  send_confirmation: z.boolean().default(true),
}).superRefine(requestRefinements);

export const waitlistSchema = z.object({
  email: emailSchema,
  subject: trimmed(80).min(2, 'Welk vak zoek je?'),
  first_name: optText(60),
  school_year: z.coerce.number().int().min(1).max(6).optional().nullable(),
  note: optText(1000),
  consent: z.literal(true, { message: 'Je moet akkoord gaan met de privacyverklaring' }),
  website: z.string().max(0).optional().or(z.literal('')),
});

export const messageSchema = z.object({ body: trimmed(4000).min(1, 'Bericht is leeg') });

export const lessonSchema = z.object({
  date: isoDate,
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Ongeldig uur'),
  duration_min: z.coerce.number().int().min(15).max(480).default(60),
  location: optText(200),
  note: optText(1000),
});

export const lessonPatchSchema = z.object({
  date: isoDate.optional(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  duration_min: z.coerce.number().int().min(15).max(480).optional(),
  location: optText(200).nullable(),
  note: optText(1000).nullable(),
  status: z.enum(['gepland', 'afgerond', 'geannuleerd']).optional(),
  reason: optText(1000),
});

export const requestPatchSchema = z.object({
  status: z.enum(['nieuw', 'in_behandeling', 'ingepland', 'afgerond', 'afgewezen', 'geannuleerd']).optional(),
  status_message: optText(2000),
  internal_note: optText(4000).nullable(),
  tutor: z.enum(['yeno', 'reda']).optional(),
  subject: requestFields.subject.optional(),
  email: optEmail.nullable(),
  phone: optPhone.nullable(),
});

const projectSchema = z.object({
  title: trimmed(100).min(1),
  description: trimmed(600).default(''),
  url: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().url().max(300).optional()),
  tags: z.array(trimmed(30).min(1)).max(6).default([]),
});

export const profileSchema = z.object({
  headline: trimmed(140),
  bio: trimmed(4000),
  highlights: z.array(trimmed(60).min(1)).max(6),
  projects: z.array(projectSchema).max(12),
  whatsapp: optPhone.nullable(),
  email: emailSchema,
  photo_url: z.preprocess((v) => (v === '' ? null : v), z.string().trim().max(500).nullable().optional()),
});

export function parse(schema, data) {
  const r = schema.safeParse(data);
  if (!r.success) {
    const fields = {};
    for (const i of r.error.issues) {
      const k = i.path.join('.') || '_';
      if (!fields[k]) fields[k] = i.message;
    }
    const err = new Error('Validatie mislukt');
    err.status = 400;
    err.details = fields;
    throw err;
  }
  return r.data;
}
