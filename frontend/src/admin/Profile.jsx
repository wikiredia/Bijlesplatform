import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Alert, Field, Spinner, useApi, useTitle } from '../components/ui.jsx';
import { Icon } from '../components/Icon.jsx';

function PasswordForm() {
  const [f, setF] = useState({ current: '', next: '' });
  const [msg, setMsg] = useState(null);
  async function submit(e) {
    e.preventDefault();
    try { await api('/admin/password', { method: 'POST', body: f }); setF({ current: '', next: '' }); setMsg({ kind: 'success', t: 'Wachtwoord gewijzigd. Andere apparaten zijn uitgelogd.' }); }
    catch (er) { setMsg({ kind: 'error', t: er.fields ? Object.values(er.fields).join(' ') : er.message }); }
  }
  return (
    <form className="panel form" onSubmit={submit}>
      <h2 className="h3">Wachtwoord wijzigen</h2>
      <Field label="Huidig wachtwoord">{(id) => <input id={id} type="password" className="input" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />}</Field>
      <Field label="Nieuw wachtwoord" hint="Minstens 10 tekens.">{(id) => <input id={id} type="password" className="input" autoComplete="new-password" minLength={10} value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />}</Field>
      {msg && <Alert kind={msg.kind}>{msg.t}</Alert>}
      <button className="btn">Wachtwoord wijzigen</button>
    </form>
  );
}

export default function Profile({ me }) {
  useTitle('Mijn profiel');
  const { data, loading, error } = useApi('/admin/profile');
  const [p, setP] = useState(null);
  const [msg, setMsg] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setP({ ...data, whatsapp: data.whatsapp || '', photo_url: data.photo_url || '', highlightsText: data.highlights.join('\n') }); }, [data]);

  if (loading || (!p && !error)) return <Spinner />;
  if (error) return <Alert kind="error">{error.message}</Alert>;

  const ev = (k) => (e) => setP({ ...p, [k]: e.target.value });
  const setProject = (i, k, v) => setP({ ...p, projects: p.projects.map((x, j) => (j === i ? { ...x, [k]: v } : x)) });
  const moveProject = (i, d) => { const arr = [...p.projects]; const [x] = arr.splice(i, 1); arr.splice(i + d, 0, x); setP({ ...p, projects: arr }); };

  async function save(e) {
    e.preventDefault(); setBusy(true); setMsg(null); setErrors({});
    try {
      const body = {
        headline: p.headline, bio: p.bio, email: p.email, whatsapp: p.whatsapp, photo_url: p.photo_url,
        highlights: p.highlightsText.split('\n').map((s) => s.trim()).filter(Boolean),
        projects: p.projects.filter((x) => x.title.trim()).map((x) => ({ ...x, tags: (typeof x.tags === 'string' ? x.tags.split(',') : x.tags).map((t) => t.trim()).filter(Boolean) })),
      };
      const res = await api('/admin/profile', { method: 'PUT', body });
      setP({ ...res, whatsapp: res.whatsapp || '', photo_url: res.photo_url || '', highlightsText: res.highlights.join('\n') });
      setMsg({ kind: 'success', t: 'Profiel opgeslagen. Je pagina is meteen bijgewerkt.' });
    } catch (er) { setErrors(er.fields || {}); setMsg({ kind: 'error', t: er.fields ? 'Controleer de aangeduide velden.' : er.message }); } finally { setBusy(false); }
  }

  return (
    <div className="narrow-admin">
      <div className="admin-head">
        <h1 className="h2">Mijn profiel</h1>
        <Link to={`/bijles/${me.slug}`} target="_blank" className="btn btn-sm"><Icon name="link" size={16} />Bekijk mijn pagina</Link>
      </div>
      <form className="form panel" onSubmit={save}>
        <Field label="Korte titel" hint="Staat bovenaan je pagina." error={errors.headline}>{(id) => <input id={id} className="input" maxLength={140} value={p.headline} onChange={ev('headline')} />}</Field>
        <Field label="Over mij" hint="Laat een lege regel tussen alinea's." error={errors.bio}>{(id) => <textarea id={id} className="input" rows={8} maxLength={4000} value={p.bio} onChange={ev('bio')} />}</Field>
        <Field label="Kernpunten" hint="Eén per regel, max. 6 (bv. '1ste – 6de middelbaar')." error={errors.highlights}>{(id) => <textarea id={id} className="input" rows={4} value={p.highlightsText} onChange={ev('highlightsText')} />}</Field>
        <div className="row-2">
          <Field label="E-mail voor meldingen en inloggen" error={errors.email}>{(id) => <input id={id} type="email" className="input" value={p.email} onChange={ev('email')} />}</Field>
          <Field label="WhatsApp-nummer" hint="Leeg = geen WhatsApp-knop op je pagina." error={errors.whatsapp}>{(id) => <input id={id} type="tel" className="input" value={p.whatsapp} onChange={ev('whatsapp')} placeholder="+32 4xx xx xx xx" />}</Field>
        </div>
        <Field label="Foto (URL)" optional hint="Bv. /img/yeno.jpg als je een foto in frontend/public/img zet. Leeg = initialen." error={errors.photo_url}>{(id) => <input id={id} className="input" value={p.photo_url} onChange={ev('photo_url')} />}</Field>

        <h2 className="h3 mt">Projecten</h2>
        {p.projects.map((x, i) => (
          <div className="project-edit" key={i}>
            <div className="row-2">
              <Field label="Titel" error={errors[`projects.${i}.title`]}>{(id) => <input id={id} className="input" value={x.title} onChange={(e) => setProject(i, 'title', e.target.value)} />}</Field>
              <Field label="Link" optional error={errors[`projects.${i}.url`]}>{(id) => <input id={id} type="url" className="input" value={x.url || ''} onChange={(e) => setProject(i, 'url', e.target.value)} placeholder="https://…" />}</Field>
            </div>
            <Field label="Beschrijving">{(id) => <textarea id={id} className="input" rows={2} value={x.description} onChange={(e) => setProject(i, 'description', e.target.value)} />}</Field>
            <Field label="Tags" hint="Gescheiden door komma's.">{(id) => <input id={id} className="input" value={Array.isArray(x.tags) ? x.tags.join(', ') : x.tags} onChange={(e) => setProject(i, 'tags', e.target.value)} />}</Field>
            <div className="btn-row">
              <button type="button" className="btn btn-sm" disabled={i === 0} onClick={() => moveProject(i, -1)}>Omhoog</button>
              <button type="button" className="btn btn-sm" disabled={i === p.projects.length - 1} onClick={() => moveProject(i, 1)}>Omlaag</button>
              <button type="button" className="btn btn-sm danger" onClick={() => setP({ ...p, projects: p.projects.filter((_, j) => j !== i) })}><Icon name="trash" size={16} />Verwijderen</button>
            </div>
          </div>
        ))}
        <button type="button" className="btn btn-sm" onClick={() => setP({ ...p, projects: [...p.projects, { title: '', description: '', url: '', tags: [] }] })}><Icon name="plus" size={16} />Project toevoegen</button>

        {msg && <Alert kind={msg.kind}>{msg.t}</Alert>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Bezig…' : 'Profiel opslaan'}</button>
      </form>
      <PasswordForm />
    </div>
  );
}
