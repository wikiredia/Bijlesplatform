import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Field, Choice, Checkbox, Alert, useTitle } from '../components/ui.jsx';
import { Icon } from '../components/Icon.jsx';

const YEARS = { 1: '1ste', 2: '2de', 3: '3de', 4: '4de', 5: '5de', 6: '6de' };

export default function OtherSubject() {
  useTitle('Ander vak');
  const [f, setF] = useState({ email: '', subject: '', first_name: '', school_year: '', note: '', consent: false, website: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(false);
  const set = (k) => (v) => { setF((s) => ({ ...s, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };
  const ev = (k) => (e) => set(k)(e.target.value);

  async function submit(e) {
    e.preventDefault();
    const er = {};
    if (!f.subject.trim()) er.subject = 'Welk vak zoek je?';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) er.email = 'Vul een geldig e-mailadres in';
    if (!f.consent) er.consent = 'Je moet akkoord gaan om je in te schrijven';
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true); setMsg('');
    try {
      await api('/public/waitlist', { method: 'POST', body: { ...f, school_year: f.school_year || null } });
      setDone(true);
    } catch (err) {
      setErrors(err.fields || {});
      setMsg(err.message === 'Validatie mislukt' ? 'Controleer de aangeduide velden.' : err.message);
    } finally { setBusy(false); }
  }

  return (
    <section className="section page-top">
      <div className="wrap narrow">
        <Link to="/" className="back"><Icon name="back" size={18} />Alle vakken</Link>
        <h1 className="h1">Bijles voor een ander vak</h1>
        <p className="lead">We zoeken nog iemand die bijles geeft voor dit vak. Laat je e-mailadres achter, dan krijg je bericht zodra het vak beschikbaar is.</p>

        {done ? (
          <div className="success">
            <div className="success-icon"><Icon name="check" size={32} /></div>
            <h2 className="h2">Je staat op de wachtlijst</h2>
            <p>We stuurden een bevestiging naar <strong>{f.email}</strong>. Zodra we iemand vinden voor {f.subject}, laten we het je weten.</p>
            <Link to="/" className="btn">Terug naar de startpagina</Link>
          </div>
        ) : (
          <form className="form card-form" onSubmit={submit} noValidate>
            <div className="hp" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={ev('website')} /></label></div>
            <Field label="Welk vak zoek je?" required error={errors.subject}>
              {(id) => <input id={id} className="input" value={f.subject} onChange={ev('subject')} placeholder="bv. Chemie, Frans, Latijn…" maxLength={80} />}
            </Field>
            <Field label="E-mail" required error={errors.email}>
              {(id) => <input id={id} type="email" inputMode="email" className="input" value={f.email} onChange={ev('email')} autoComplete="email" />}
            </Field>
            <Field label="Voornaam" optional>
              {(id) => <input id={id} className="input" value={f.first_name} onChange={ev('first_name')} autoComplete="given-name" maxLength={60} />}
            </Field>
            <Field label="Jaar" optional>
              <Choice options={YEARS} value={String(f.school_year)} onChange={(v) => set('school_year')(f.school_year === v ? '' : v)} name="Jaar" className="choice-years" />
            </Field>
            <Field label="Opmerking" optional>
              {(id) => <textarea id={id} className="input" rows={3} value={f.note} onChange={ev('note')} maxLength={1000} placeholder="bv. Ik heb vooral hulp nodig voor de examens in juni." />}
            </Field>
            <Checkbox checked={f.consent} onChange={set('consent')} error={errors.consent}>
              Ik ga akkoord dat mijn e-mailadres bewaard wordt om me te verwittigen, zoals beschreven in de{' '}
              <Link to="/privacy" target="_blank">privacyverklaring</Link>. *
            </Checkbox>
            {msg && <Alert kind="error">{msg}</Alert>}
            <button className="btn btn-primary btn-block btn-lg" disabled={busy}>{busy ? 'Bezig…' : 'Zet me op de wachtlijst'}</button>
          </form>
        )}
      </div>
    </section>
  );
}
