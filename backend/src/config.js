// Centrale configuratie, alles via omgevingsvariabelen (zie .env.example)

const env = process.env;

function int(name, def) {
  const v = parseInt(env[name] ?? '', 10);
  return Number.isFinite(v) ? v : def;
}
function bool(name, def) {
  const v = env[name];
  if (v === undefined || v === '') return def;
  return ['1', 'true', 'yes', 'ja'].includes(v.toLowerCase());
}

export const config = {
  port: int('PORT', 3000),
  publicUrl: (env.PUBLIC_URL || 'http://localhost:8080').replace(/\/$/, ''),
  databaseUrl: env.DATABASE_URL || 'postgres://bijles:bijles@localhost:5432/bijles',
  sessionSecret: env.SESSION_SECRET || '',
  trustProxy: env.TRUST_PROXY || 'loopback, linklocal, uniquelocal',
  timezone: env.TZ_APP || 'Europe/Brussels',
  siteName: env.SITE_NAME || 'Bijlesplatform',

  mail: {
    host: env.SMTP_HOST || '',
    port: int('SMTP_PORT', 587),
    secure: bool('SMTP_SECURE', int('SMTP_PORT', 587) === 465),
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    from: env.MAIL_FROM || 'Bijlesplatform <no-reply@localhost>',
    replyToTutor: bool('MAIL_REPLY_TO_TUTOR', true),
  },

  privacy: {
    controllerName: env.PRIVACY_CONTROLLER_NAME || 'Yeno Roelants en Reda Kadi',
    controllerEmail: env.PRIVACY_CONTACT_EMAIL || 'roelantsyeno@gmail.com',
    version: env.PRIVACY_VERSION || '2026-11-05',
  },

  retention: {
    // Volledige aanvraag (incl. lessen en berichten) na laatste activiteit
    activeMonths: int('RETENTION_MONTHS', 12),
    // Aanvragen die nooit doorgingen (afgewezen / geannuleerd / nooit ingepland)
    closedMonths: int('RETENTION_CLOSED_MONTHS', 3),
    waitlistMonths: int('RETENTION_WAITLIST_MONTHS', 12),
    // Verzonden e-mails (kopie in de outbox) worden snel opgeruimd
    outboxDays: int('RETENTION_OUTBOX_DAYS', 30),
  },

  worker: {
    reminderHour: int('REMINDER_HOUR', 17), // vanaf dit uur (lokale tijd) de dag voor de les
    nudgeHours: int('NUDGE_AFTER_HOURS', 24),
    nudgeUrgentHours: int('NUDGE_URGENT_AFTER_HOURS', 4),
  },

  tutors: [
    {
      slug: 'yeno',
      name: 'Yeno Roelants',
      first_name: 'Yeno',
      email: env.TUTOR_YENO_EMAIL || 'roelantsyeno@gmail.com',
      whatsapp: env.TUTOR_YENO_WHATSAPP || '',
      subjects: ['wiskunde', 'fysica'],
    },
    {
      slug: 'reda',
      name: 'Reda Kadi',
      first_name: 'Reda',
      email: env.TUTOR_REDA_EMAIL || 'reda.kadi07@gmail.com',
      whatsapp: env.TUTOR_REDA_WHATSAPP || '',
      subjects: ['programmeren'],
    },
  ],
  adminInitialPassword: env.ADMIN_INITIAL_PASSWORD || '',
  isProduction: env.NODE_ENV === 'production',
};

export const SUBJECTS = {
  wiskunde: 'Wiskunde',
  fysica: 'Fysica',
  programmeren: 'Programmeren / ICT',
};

export const URGENCY_LABELS = {
  dringend: 'Dringend',
  deze_week: 'Deze week',
  volgende_week: 'Volgende week',
  tegen_datum: 'Tegen een bepaalde datum',
  flexibel: 'Geen haast',
};

export const TIME_PREF_LABELS = {
  voormiddag: 'Voormiddag',
  namiddag: 'Namiddag',
  avond: 'Avond',
  weekend: 'Weekend',
};

export const LOCATION_LABELS = {
  aan_huis: 'Aan huis',
  online: 'Online',
  geen_voorkeur: 'Geen voorkeur',
};

export const STATUS_LABELS = {
  nieuw: 'Nieuw',
  in_behandeling: 'In behandeling',
  ingepland: 'Ingepland',
  afgerond: 'Afgerond',
  afgewezen: 'Kan niet doorgaan',
  geannuleerd: 'Geannuleerd',
};

// Voor in een zin: "bijles programmeren/ICT"
export function subjectWord(s) {
  return { wiskunde: 'wiskunde', fysica: 'fysica', programmeren: 'programmeren/ICT' }[s] || s;
}

export function subjectLabel(s) {
  return SUBJECTS[s] || s;
}

if (!config.sessionSecret || config.sessionSecret.length < 32) {
  if (config.isProduction) {
    console.error('SESSION_SECRET ontbreekt of is te kort (min. 32 tekens). Zie .env.example.');
    process.exit(1);
  }
  config.sessionSecret = 'dev-secret-dev-secret-dev-secret-dev-secret';
}
