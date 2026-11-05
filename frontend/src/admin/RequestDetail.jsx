import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  api, SUBJECTS, URGENCY, TIME_PREFS, LOCATIONS, fmtDayLong, fmtDateTime, fmtShortDateTime, fmtTime, brusselsParts, todayIso,
} from '../api.js';
import { Alert, Field, Spinner, useApi, useTitle } from '../components/ui.jsx';
import { DateChips } from '../components/DatePicker.jsx';
import { Icon, WhatsAppIcon } from '../components/Icon.jsx';
import { StatusBadge } from './Requests.jsx';

const DURATIONS = [30, 45, 60, 75, 90, 120];
const OPEN = ['nieuw', 'in_behandeling', 'ingepland'];

function LessonForm({ initial, onSubmit, submitLabel, busy, withReason }) {
  const [f, setF] = useState({ date: '', time: '16:00', duration_min: 60, location: '', note: '', reason: '', notify: true, ...initial });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  return (
    <form className="lesson-form" onSubmit={(e) => { e.preventDefault(); onSubmit(f); }}>
      <div className="row-3">
        <Field label="Datum">{(id) => <input id={id} type="date" className="input" required min={todayIso()} value={f.date} onChange={set('date')} />}</Field>
        <Field label="Uur">{(id) => <input id={id} type="time" className="input" required step={300} value={f.time} onChange={set('time')} />}</Field>
        <Field label="Duur">{(id) => (
          <select id={id} className="input" value={f.duration_min} onChange={set('duration_min')}>
            {DURATIONS.map((d) => <option key={d} value={d}>{d} min</option>)}
          </select>)}</Field>
      </div>
      <Field label="Waar" optional>{(id) => <input id={id} className="input" value={f.location || ''} onChange={set('location')} placeholder="bv. Thuis bij leerling, Discord, bibliotheek Tienen…" />}</Field>
      <Field label="Opmerking voor de leerling" optional>{(id) => <input id={id} className="input" value={f.note || ''} onChange={set('note')} placeholder="bv. Neem je cursus en rekenmachine mee" />}</Field>
      {withReason && <Field label="Reden van wijziging" optional>{(id) => <input id={id} className="input" value={f.reason} onChange={set('reason')} />}</Field>}
      <label className="toggle small"><input type="checkbox" checked={f.notify} onChange={set('notify')} /> Leerling en mezelf mailen (met agenda-uitnodiging)</label>
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Bezig…' : submitLabel}</button>
    </form>
  );
}

function LessonItem({ l, onPatch, busy }) {
  const [editing, setEditing] = useState(false);
  const p = brusselsParts(l.starts_at);
  const past = new Date(l.starts_at) < new Date();
  return (
    <li className={`lesson st-${l.status}`}>
      <div className="lesson-top">
        <div>
          <strong>{fmtDateTime(l.starts_at)}</strong>
          <div className="muted small">{l.duration_min} min (tot {fmtTime(new Date(new Date(l.starts_at).getTime() + l.duration_min * 60000))}){l.location ? ` · ${l.location}` : ''}</div>
          {l.note && <div className="small">{l.note}</div>}
        </div>
        <span className={`badge ls-${l.status}`}>{l.status}</span>
      </div>
      {l.status === 'gepland' && (
        <div className="btn-row">
          {past && <button className="btn btn-sm" disabled={busy} onClick={() => onPatch(l.id, { status: 'afgerond' })}><Icon name="check" size={16} />Afgerond</button>}
          {!past && <button className="btn btn-sm" onClick={() => setEditing((e) => !e)}><Icon name="edit" size={16} />Wijzigen</button>}
          {!past && <button className="btn btn-sm danger" disabled={busy} onClick={() => {
            const reason = window.prompt('Les annuleren. Reden voor de leerling (optioneel):');
            if (reason !== null) onPatch(l.id, { status: 'geannuleerd', reason });
          }}>Annuleren</button>}
        </div>
      )}
      {editing && (
        <LessonForm initial={{ date: p.date, time: p.time, duration_min: l.duration_min, location: l.location, note: l.note }} withReason busy={busy}
          submitLabel="Wijziging opslaan" onSubmit={async (f) => { const ok = await onPatch(l.id, f); if (ok) setEditing(false); }} />
      )}
    </li>
  );
}

export default function RequestDetail({ me }) {
  const { id } = useParams();
  const nav = useNavigate();
  const { data: r, error, loading, reload } = useApi(`/admin/requests/${id}`);
  const [busy, setBusy] = useState('');
  const [flash, setFlash] = useState(null);
  const [body, setBody] = useState('');
  const [planDate, setPlanDate] = useState('');
  const [note, setNote] = useState(null);
  const [decline, setDecline] = useState(null);
  useTitle(r ? `${r.first_name} (${r.ref})` : 'Aanvraag');

  if (loading && !r) return <Spinner />;
  if (error) return <Alert kind="error">{error.message}</Alert>;

  const other = me.slug === 'yeno' ? { slug: 'reda', name: 'Reda' } : { slug: 'yeno', name: 'Yeno' };
  const open = OPEN.includes(r.status);

  async function act(key, fn, okText) {
    setBusy(key); setFlash(null);
    try { const res = await fn(); await reload(); if (okText) setFlash({ kind: 'success', t: typeof okText === 'function' ? okText(res) : okText }); return true; }
    catch (e) { setFlash({ kind: 'error', t: e.fields ? Object.values(e.fields).join(' ') : e.message }); return false; }
    finally { setBusy(''); }
  }
  const patch = (b, ok) => act('patch', () => api(`/admin/requests/${id}`, { method: 'PATCH', body: b }), ok);
  const patchLesson = (lid, b) => act('lesson', () => api(`/admin/lessons/${lid}`, { method: 'PATCH', body: b }), 'Les bijgewerkt.');

  return (
    <div className="detail">
      <Link to="/beheer" className="back"><Icon name="back" size={18} />Aanvragen</Link>
      <div className="detail-head">
        <div>
          <h1 className="h2">{r.first_name} {r.last_name || ''}</h1>
          <div className="req-line"><StatusBadge status={r.status} /><span className="muted small">{r.ref} · {SUBJECTS[r.subject]?.label} · ontvangen {fmtShortDateTime(r.created_at)}{r.source !== 'website' ? ' · via WhatsApp' : ''}</span></div>
        </div>
      </div>
      {flash && <Alert kind={flash.kind}>{flash.t}</Alert>}

      <div className="detail-grid">
        <div className="detail-col">
          <section className="panel">
            <h2 className="h3">Contact</h2>
            {r.is_parent && <p className="small">Ouder{r.student_name ? ` van ${r.student_name}` : ''}</p>}
            <div className="contact-btns">
              {r.email && <a className="btn btn-sm" href={`mailto:${r.email}`}><Icon name="mail" size={16} />{r.email}</a>}
              {r.phone && <a className="btn btn-sm" href={`tel:${r.phone.replace(/\s/g, '')}`}><Icon name="phone" size={16} />{r.phone}</a>}
              {r.whatsapp_url && <a className="btn btn-sm btn-wa" href={r.whatsapp_url} target="_blank" rel="noopener noreferrer"><WhatsAppIcon size={16} />WhatsApp</a>}
            </div>
            {!r.email && <p className="small warn-text">Geen e-mail: de leerling krijgt geen automatische mails. Laat zelf iets weten.</p>}
            <button className="link-btn small" onClick={() => { navigator.clipboard?.writeText(r.status_url); setFlash({ kind: 'success', t: 'Statuslink gekopieerd. Je kan hem doorsturen via WhatsApp.' }); }}>
              <Icon name="link" size={14} /> Statuslink van de leerling kopiëren
            </button>
          </section>

          <section className="panel">
            <h2 className="h3">Wensen</h2>
            <dl className="dl">
              <dt>Wanneer</dt><dd>{r.urgency === 'tegen_datum' && r.deadline ? `Tegen ${fmtDayLong(r.deadline)}` : URGENCY[r.urgency]}</dd>
              <dt>Jaar</dt><dd>{r.school_year ? `${r.school_year}de middelbaar` : '—'}{r.school_track ? ` – ${r.school_track}` : ''}</dd>
              <dt>Kan op</dt><dd><DateChips dates={r.available_dates} kind="kan" onPick={open ? (d) => { setPlanDate(d); document.getElementById('plannen')?.scrollIntoView({ behavior: 'smooth' }); } : undefined} /></dd>
              <dt>Kan niet</dt><dd><DateChips dates={r.unavailable_dates} kind="niet" /></dd>
              <dt>Momenten</dt><dd>{r.time_prefs.length ? r.time_prefs.map((t) => TIME_PREFS[t]).join(', ') : '—'}</dd>
              <dt>Waar</dt><dd>{r.location_pref ? LOCATIONS[r.location_pref] : '—'}</dd>
              {r.message && <><dt>Bericht</dt><dd className="pre">{r.message}</dd></>}
            </dl>
            {open && r.available_dates.length > 0 && <p className="muted small">Tik op een datum om ze in het planformulier te zetten.</p>}
          </section>

          <section className="panel">
            <h2 className="h3">Interne notitie</h2>
            <textarea className="input" rows={3} placeholder="Alleen zichtbaar voor jou en de andere bijlesgever (bv. prijsafspraak, niveau…)"
              value={note ?? r.internal_note ?? ''} onChange={(e) => setNote(e.target.value)} />
            {note !== null && note !== (r.internal_note ?? '') && (
              <button className="btn btn-sm" disabled={busy === 'patch'} onClick={async () => { if (await patch({ internal_note: note }, 'Notitie opgeslagen.')) setNote(null); }}>Notitie opslaan</button>
            )}
          </section>
        </div>

        <div className="detail-col">
          {open && (
            <section className="panel" id="plannen">
              <h2 className="h3">Les inplannen</h2>
              <LessonForm key={planDate} initial={{ date: planDate, location: r.location_pref === 'online' ? 'Online' : '' }} busy={busy === 'plan'} submitLabel="Les inplannen"
                onSubmit={(f) => act('plan', () => api(`/admin/requests/${id}/lessons`, { method: 'POST', body: f }),
                  f.notify ? (r.email ? 'Les ingepland. De leerling krijgt een mail.' : 'Les ingepland. Let op: geen e-mail, laat het zelf weten.') : 'Les ingepland (zonder mails).')} />
            </section>
          )}

          {r.lessons.length > 0 && (
            <section className="panel">
              <h2 className="h3">Lessen</h2>
              <ul className="lessons">{r.lessons.map((l) => <LessonItem key={l.id} l={l} onPatch={patchLesson} busy={busy === 'lesson'} />)}</ul>
            </section>
          )}

          <section className="panel">
            <h2 className="h3">Berichten</h2>
            <div className="thread">
              {r.messages.length === 0 && <p className="muted small">Nog geen berichten.</p>}
              {r.messages.map((m) => (
                <div key={m.id} className={`bubble ${m.sender === 'tutor' ? 'me' : m.sender}`}>
                  {m.sender !== 'systeem' && <span className="bubble-who">{m.sender === 'tutor' ? 'Jij' : r.first_name}</span>}
                  <p>{m.body}</p><time>{fmtShortDateTime(m.created_at)}</time>
                </div>
              ))}
            </div>
            <form className="composer" onSubmit={async (e) => {
              e.preventDefault();
              if (await act('msg', () => api(`/admin/requests/${id}/messages`, { method: 'POST', body: { body } }),
                (res) => (res.emailed ? 'Bericht verstuurd per mail.' : 'Bericht opgeslagen, maar er is geen e-mailadres. Stuur het ook via WhatsApp of sms.'))) setBody('');
            }}>
              <textarea className="input" rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder={`Bericht aan ${r.first_name}…`} aria-label="Bericht" />
              <button className="btn btn-primary" disabled={busy === 'msg' || !body.trim()}><Icon name="send" size={18} />Versturen</button>
            </form>
          </section>

          <section className="panel">
            <h2 className="h3">Status</h2>
            <div className="btn-row">
              {r.status === 'nieuw' && <button className="btn btn-sm" disabled={!!busy} onClick={() => patch({ status: 'in_behandeling' }, 'Op "in behandeling" gezet.')}>In behandeling</button>}
              {open && <button className="btn btn-sm" disabled={!!busy} onClick={() => window.confirm('Aanvraag afronden? De leerling krijgt een bedankmail.') && patch({ status: 'afgerond' }, 'Afgerond.')}><Icon name="check" size={16} />Afronden</button>}
              {open && <button className="btn btn-sm" disabled={!!busy} onClick={() => setDecline(decline === null ? '' : null)}>Kan niet doorgaan</button>}
              {open && <button className="btn btn-sm" disabled={!!busy} onClick={() => window.confirm(`Doorsturen naar ${other.name}? ${other.name} krijgt een mail.`) && patch({ tutor: other.slug }, `Doorgestuurd naar ${other.name}.`)}>Doorsturen naar {other.name}</button>}
              {!open && <button className="btn btn-sm" disabled={!!busy} onClick={() => patch({ status: 'in_behandeling' }, 'Heropend.')}>Heropenen</button>}
            </div>
            {decline !== null && (
              <div className="decline">
                <Field label={`Bericht aan ${r.first_name} (optioneel)`}>{(fid) => <textarea id={fid} className="input" rows={3} value={decline} onChange={(e) => setDecline(e.target.value)} placeholder="bv. Sorry, ik zit vol tot na de examens." />}</Field>
                <button className="btn btn-sm danger" disabled={!!busy} onClick={async () => { if (await patch({ status: 'afgewezen', status_message: decline }, 'Aanvraag afgesloten.')) setDecline(null); }}>Bevestigen</button>
              </div>
            )}
            <hr className="sep" />
            <button className="btn btn-sm btn-ghost danger" disabled={!!busy} onClick={async () => {
              if (!window.confirm('Alle gegevens van deze aanvraag definitief verwijderen? De leerling krijgt geen bericht.')) return;
              await api(`/admin/requests/${id}`, { method: 'DELETE' }); nav('/beheer');
            }}><Icon name="trash" size={16} />Aanvraag verwijderen</button>
          </section>
        </div>
      </div>
    </div>
  );
}
