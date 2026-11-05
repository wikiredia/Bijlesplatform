import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, fmtDateTime, fmtDayLong, fmtTime, fmtShortDateTime, SUBJECTS, URGENCY, TIME_PREFS, LOCATIONS } from '../api.js';
import { Alert, Spinner, useApi, useTitle } from '../components/ui.jsx';
import { DateChips } from '../components/DatePicker.jsx';
import { Icon, WhatsAppIcon } from '../components/Icon.jsx';

const FLOW = ['nieuw', 'in_behandeling', 'ingepland', 'afgerond'];
const FLOW_LABEL = { nieuw: 'Ontvangen', in_behandeling: 'Bekeken', ingepland: 'Ingepland', afgerond: 'Afgerond' };
const OPEN = ['nieuw', 'in_behandeling', 'ingepland'];

export default function RequestStatus() {
  const { token } = useParams();
  const { data: r, error, loading, reload } = useApi(`/public/requests/${token}`);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const [deleted, setDeleted] = useState(false);
  useTitle(r ? `Aanvraag ${r.ref}` : 'Je aanvraag');

  if (deleted) {
    return (
      <section className="section page-top"><div className="wrap narrow">
        <div className="success"><div className="success-icon"><Icon name="check" size={32} /></div>
          <h1 className="h2">Je gegevens zijn verwijderd</h1>
          <p>Je aanvraag, lessen en berichten zijn definitief gewist. {r?.tutor?.first_name} is verwittigd.</p>
          <Link to="/" className="btn">Naar de startpagina</Link></div>
      </div></section>
    );
  }
  if (loading) return <div className="wrap pad"><Spinner /></div>;
  if (error) {
    return <div className="wrap narrow pad page-top"><h1 className="h1">Aanvraag niet gevonden</h1>
      <p className="lead">{error.message}</p><Link to="/" className="btn">Naar de startpagina</Link></div>;
  }

  const open = OPEN.includes(r.status);
  const step = FLOW.indexOf(r.status);
  const upcoming = r.lessons.filter((l) => l.status === 'gepland' && new Date(l.starts_at) > new Date(Date.now() - 2 * 3600e3));

  async function send(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy('send'); setMsg(null);
    try { await api(`/public/requests/${token}/messages`, { method: 'POST', body: { body } }); setBody(''); await reload(); setMsg({ kind: 'success', t: `Verstuurd. ${r.tutor.first_name} krijgt een mail.` }); }
    catch (err) { setMsg({ kind: 'error', t: err.message }); } finally { setBusy(''); }
  }
  async function cancel() {
    if (!window.confirm('Weet je zeker dat je deze aanvraag wilt annuleren? Geplande lessen gaan dan ook niet door.')) return;
    setBusy('cancel');
    try { await api(`/public/requests/${token}/cancel`, { method: 'POST' }); await reload(); } catch (err) { setMsg({ kind: 'error', t: err.message }); } finally { setBusy(''); }
  }
  async function remove() {
    if (!window.confirm('Al je gegevens van deze aanvraag worden definitief verwijderd. Doorgaan?')) return;
    setBusy('delete');
    try { await api(`/public/requests/${token}`, { method: 'DELETE' }); setDeleted(true); } catch (err) { setMsg({ kind: 'error', t: err.message }); } finally { setBusy(''); }
  }

  return (
    <section className="section page-top">
      <div className="wrap narrow">
        <p className="muted small">Aanvraag {r.ref}</p>
        <h1 className="h1">Bijles {SUBJECTS[r.subject]?.label.toLowerCase()} bij {r.tutor.first_name}</h1>

        {['afgewezen', 'geannuleerd'].includes(r.status) ? (
          <Alert kind="warn">{r.status === 'afgewezen' ? 'Deze aanvraag kan helaas niet doorgaan.' : 'Deze aanvraag is geannuleerd.'} <Link to={`/bijles/${r.tutor.slug}`}>Nieuwe aanvraag doen</Link></Alert>
        ) : (
          <ol className="progress" aria-label="Status">
            {FLOW.map((s, i) => (
              <li key={s} className={i < step ? 'done' : i === step ? 'current' : ''} aria-current={i === step ? 'step' : undefined}>
                <span className="progress-dot">{i < step ? <Icon name="check" size={14} /> : null}</span>{FLOW_LABEL[s]}
              </li>
            ))}
          </ol>
        )}

        {upcoming.length > 0 && (
          <div className="lesson-cards">
            {upcoming.map((l) => (
              <div className="lesson-card" key={l.id}>
                <Icon name="calendar" size={22} />
                <div>
                  <strong>{fmtDateTime(l.starts_at)}</strong>
                  <p>{l.duration_min} minuten (tot {fmtTime(new Date(new Date(l.starts_at).getTime() + l.duration_min * 60000))}){l.location ? ` · ${l.location}` : ''}</p>
                  {l.note && <p className="muted">{l.note}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
        {r.status === 'nieuw' && <p className="lead">{r.tutor.first_name} bekijkt je aanvraag en laat zo snel mogelijk iets weten.</p>}

        <h2 className="h3 mt">Berichten</h2>
        <div className="thread" id="berichten">
          {r.messages.length === 0 && <p className="muted">Nog geen berichten.</p>}
          {r.messages.map((m) => (
            <div key={m.id} className={`bubble ${m.sender === 'student' ? 'me' : m.sender}`}>
              {m.sender !== 'systeem' && <span className="bubble-who">{m.sender === 'student' ? 'Jij' : r.tutor.first_name}</span>}
              <p>{m.body}</p>
              <time>{fmtShortDateTime(m.created_at)}</time>
            </div>
          ))}
        </div>
        {open && (
          <form onSubmit={send} className="composer">
            <label htmlFor="bericht" className="sr-only">Bericht aan {r.tutor.first_name}</label>
            <textarea id="bericht" className="input" rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder={`Bericht aan ${r.tutor.first_name}…`} maxLength={4000} />
            <button className="btn btn-primary" disabled={busy === 'send' || !body.trim()}><Icon name="send" size={18} />Versturen</button>
          </form>
        )}
        {msg && <Alert kind={msg.kind}>{msg.t}</Alert>}
        {r.tutor.whatsapp_url && open && (
          <a href={r.tutor.whatsapp_url} className="btn btn-wa" target="_blank" rel="noopener noreferrer"><WhatsAppIcon />Of stuur een WhatsApp</a>
        )}

        <details className="summary-box">
          <summary>Je aanvraag bekijken</summary>
          <dl className="dl">
            <dt>Wanneer</dt><dd>{r.urgency === 'tegen_datum' && r.deadline ? `Tegen ${fmtDayLong(r.deadline)}` : URGENCY[r.urgency]}</dd>
            {r.school_year && <><dt>Jaar</dt><dd>{r.school_year}de middelbaar{r.school_track ? ` – ${r.school_track}` : ''}</dd></>}
            <dt>Kan op</dt><dd><DateChips dates={r.available_dates} kind="kan" /></dd>
            <dt>Kan niet op</dt><dd><DateChips dates={r.unavailable_dates} kind="niet" /></dd>
            {r.time_prefs.length > 0 && <><dt>Momenten</dt><dd>{r.time_prefs.map((t) => TIME_PREFS[t]).join(', ')}</dd></>}
            {r.location_pref && <><dt>Waar</dt><dd>{LOCATIONS[r.location_pref]}</dd></>}
            {r.message && <><dt>Bericht</dt><dd className="pre">{r.message}</dd></>}
            <dt>Contact</dt><dd>{[r.first_name, r.last_name].filter(Boolean).join(' ')}{r.is_parent ? ` (ouder${r.student_name ? ` van ${r.student_name}` : ''})` : ''}<br />{[r.email, r.phone].filter(Boolean).join(' · ')}</dd>
          </dl>
        </details>

        <div className="danger-zone">
          {open && <button type="button" className="btn btn-ghost" onClick={cancel} disabled={!!busy}>Aanvraag annuleren</button>}
          <button type="button" className="btn btn-ghost danger" onClick={remove} disabled={!!busy}><Icon name="trash" size={18} />Mijn gegevens verwijderen</button>
        </div>
        <p className="muted small">Deze pagina is enkel bereikbaar via je persoonlijke link. Deel ze niet met anderen.</p>
      </div>
    </section>
  );
}
