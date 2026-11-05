import { useState } from 'react';
import { api, fmtShortDateTime } from '../api.js';
import { Alert, Field, Spinner, useApi, useTitle } from '../components/ui.jsx';
import { Icon } from '../components/Icon.jsx';

export default function Waitlist() {
  useTitle('Wachtlijst');
  const { data, error, loading, reload } = useApi('/admin/waitlist');
  const [sel, setSel] = useState([]);
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');
  const [flash, setFlash] = useState(null);
  const [busy, setBusy] = useState(false);

  const groups = {};
  for (const w of data || []) (groups[w.subject.trim().toLowerCase()] ||= { label: w.subject.trim(), items: [] }).items.push(w);
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function notify() {
    if (!window.confirm(`${sel.length} persoon/personen mailen dat het vak beschikbaar is?`)) return;
    setBusy(true);
    try {
      const r = await api('/admin/waitlist/notify', { method: 'POST', body: { ids: sel, message, link } });
      setFlash({ kind: 'success', t: `${r.notified} mail(s) verstuurd.` }); setSel([]); setMessage(''); reload();
    } catch (e) { setFlash({ kind: 'error', t: e.message }); } finally { setBusy(false); }
  }
  async function remove(id) {
    if (!window.confirm('Deze inschrijving verwijderen?')) return;
    await api(`/admin/waitlist/${id}`, { method: 'DELETE' }); reload();
  }

  return (
    <>
      <h1 className="h2">Wachtlijst</h1>
      <p className="muted">Mensen die bijles zoeken voor een vak dat nog niet beschikbaar is. Vind je iemand voor dat vak? Selecteer ze en stuur een mail.</p>
      {flash && <Alert kind={flash.kind}>{flash.t}</Alert>}
      {loading ? <Spinner /> : error ? <Alert kind="error">{error.message}</Alert> : data.length === 0 ? (
        <div className="empty"><p>De wachtlijst is leeg.</p></div>
      ) : Object.values(groups).map((g) => (
        <section key={g.label} className="panel">
          <div className="panel-head">
            <h2 className="h3">{g.label} <span className="muted">({g.items.length})</span></h2>
            <button className="link-btn small" onClick={() => setSel((s) => [...new Set([...s, ...g.items.filter((w) => !w.notified_at).map((w) => w.id)])])}>Selecteer wie nog wacht</button>
          </div>
          <ul className="wl-list">
            {g.items.map((w) => (
              <li key={w.id} className={w.notified_at ? 'done' : ''}>
                <label className="toggle">
                  <input type="checkbox" checked={sel.includes(w.id)} onChange={() => toggle(w.id)} />
                  <span><strong>{w.first_name || w.email}</strong>{w.first_name && <span className="muted"> · {w.email}</span>}
                    {w.school_year && <span className="muted"> · {w.school_year}de jaar</span>}
                    <br /><span className="muted small">{fmtShortDateTime(w.created_at)}{w.notified_at ? ` · verwittigd ${fmtShortDateTime(w.notified_at)}` : ''}</span>
                    {w.note && <><br /><span className="small">{w.note}</span></>}
                  </span>
                </label>
                <button className="icon-btn" aria-label="Verwijderen" onClick={() => remove(w.id)}><Icon name="trash" size={18} /></button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {sel.length > 0 && (
        <div className="panel sticky-bottom">
          <h2 className="h3">{sel.length} geselecteerd</h2>
          <Field label="Bericht" optional>{(id) => <textarea id={id} className="input" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="bv. Vanaf januari geeft Sarah bijles chemie. Vraag gerust een les aan!" />}</Field>
          <Field label="Link in de knop" optional hint="Laat leeg om naar de startpagina te verwijzen.">{(id) => <input id={id} type="url" className="input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" />}</Field>
          <button className="btn btn-primary" onClick={notify} disabled={busy}><Icon name="mail" size={18} />{busy ? 'Bezig…' : 'Mail versturen'}</button>
        </div>
      )}
    </>
  );
}
