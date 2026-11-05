export class ApiError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields || {};
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'x-requested-with': 'bijles' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method, headers, credentials: 'same-origin', body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Geen verbinding met de server. Controleer je internet en probeer opnieuw.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || 'Er ging iets mis.', data.fields);
  return data;
}

// ───────── Datumhulpjes (lokale datum, geen tijdzonegedoe) ─────────
export const pad = (n) => String(n).padStart(2, '0');
export const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseIso = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const todayIso = () => isoOf(new Date());

const fmt = (opts) => new Intl.DateTimeFormat('nl-BE', opts);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const fmtDay = (iso) => fmt({ weekday: 'short', day: 'numeric', month: 'short' }).format(parseIso(iso));
export const fmtDayLong = (iso) => cap(fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(parseIso(iso)));
export const fmtDateTime = (ts) => cap(fmt({ weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' }).format(new Date(ts)));
export const fmtShortDateTime = (ts) => fmt({ day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' }).format(new Date(ts));
export const fmtTime = (ts) => fmt({ hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' }).format(new Date(ts));
export const brusselsParts = (ts) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
};

export const SUBJECTS = {
  wiskunde: { label: 'Wiskunde', tutor: 'yeno', color: 'var(--c-math)' },
  fysica: { label: 'Fysica', tutor: 'yeno', color: 'var(--c-phys)' },
  programmeren: { label: 'Programmeren / ICT', tutor: 'reda', color: 'var(--c-code)' },
};

export const URGENCY = {
  dringend: 'Dringend',
  deze_week: 'Deze week',
  volgende_week: 'Volgende week',
  tegen_datum: 'Tegen een datum',
  flexibel: 'Geen haast',
};
export const TIME_PREFS = { voormiddag: 'Voormiddag', namiddag: 'Namiddag', avond: 'Avond', weekend: 'Weekend' };
export const LOCATIONS = { aan_huis: 'Aan huis', online: 'Online', geen_voorkeur: 'Geen voorkeur' };
export const STATUS = {
  nieuw: 'Nieuw',
  in_behandeling: 'In behandeling',
  ingepland: 'Ingepland',
  afgerond: 'Afgerond',
  afgewezen: 'Kan niet doorgaan',
  geannuleerd: 'Geannuleerd',
};
