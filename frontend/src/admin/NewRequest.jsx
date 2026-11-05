import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, SUBJECTS, URGENCY, TIME_PREFS, LOCATIONS, todayIso } from '../api.js';
import { Alert, Checkbox, Choice, Field, useTitle } from '../components/ui.jsx';
import { DatePicker } from '../components/DatePicker.jsx';
import { Icon } from '../components/Icon.jsx';

const YEARS = { 1: '1ste', 2: '2de', 3: '3de', 4: '4de', 5: '5de', 6: '6de' };

/** Manueel een aanvraag toevoegen, bv. voor iemand die via WhatsApp contact opnam. */
export default function NewRequest({ me }) {
  useTitle('Aanvraag toevoegen');
  const nav = useNavigate();
  const [f, setF] = useState({
    source: 'whatsapp', subject: me.subjects[0], school_year: '', first_name: '', last_name: '', phone: '', email: '',
    is_parent: false, student_name: '', urgency: 'flexibel', deadline: '', dates: { available: [], unavailable: [] },
    time_prefs: [], location_pref: '', message: '', internal_note: '', send_confirmation: true,
  });
  const [errors, setErrors] = useState({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const ev = (k) => (e) => set(k)(e.target.value);

  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr(''); setErrors({});
    try {
      const { dates, ...rest } = f;
      const res = await api('/admin/requests', {
        method: 'POST',
        body: { ...rest, school_year: f.school_year || null, location_pref: f.location_pref || null, available_dates: dates.available, unavailable_dates: dates.unavailable },
      });
      nav(`/beheer/aanvragen/${res.id}`);
    } catch (er) { setErrors(er.fields || {}); setErr(er.fields ? 'Controleer de aangeduide velden.' : er.message); } finally { setBusy(false); }
  }

  return (
    <div className="narrow-admin">
      <Link to="/beheer" className="back"><Icon name="back" size={18} />Aanvragen</Link>
      <h1 className="h2">Aanvraag toevoegen</h1>
      <p className="muted">Voor wie je via WhatsApp, telefoon of persoonlijk contacteerde. Zo staat alles op één plek en werken de herinneringen ook.</p>
      <form className="form" onSubmit={submit} noValidate>
        <Field label="Hoe kwam de aanvraag binnen?"><Choice options={{ whatsapp: 'WhatsApp', manueel: 'Anders' }} value={f.source} onChange={set('source')} name="Bron" /></Field>
        {me.subjects.length > 1 && <Field label="Vak"><Choice options={Object.fromEntries(me.subjects.map((s) => [s, SUBJECTS[s].label]))} value={f.subject} onChange={set('subject')} name="Vak" /></Field>}
        <div className="row-2">
          <Field label="Voornaam" required error={errors.first_name}>{(id) => <input id={id} className="input" value={f.first_name} onChange={ev('first_name')} />}</Field>
          <Field label="Achternaam" optional>{(id) => <input id={id} className="input" value={f.last_name} onChange={ev('last_name')} />}</Field>
        </div>
        <div className="row-2">
          <Field label="Telefoon" error={errors.phone}>{(id) => <input id={id} type="tel" className="input" value={f.phone} onChange={ev('phone')} />}</Field>
          <Field label="E-mail" error={errors.email}>{(id) => <input id={id} type="email" className="input" value={f.email} onChange={ev('email')} />}</Field>
        </div>
        <Checkbox checked={f.is_parent} onChange={set('is_parent')}>Dit is een ouder</Checkbox>
        {f.is_parent && <Field label="Naam kind" optional>{(id) => <input id={id} className="input" value={f.student_name} onChange={ev('student_name')} />}</Field>}
        <Field label="Jaar" optional><Choice options={YEARS} value={String(f.school_year)} onChange={(v) => set('school_year')(f.school_year === v ? '' : v)} name="Jaar" className="choice-years" /></Field>
        <Field label="Wanneer"><Choice options={URGENCY} value={f.urgency} onChange={set('urgency')} name="Wanneer" className="choice-urgency" /></Field>
        {f.urgency === 'tegen_datum' && <Field label="Tegen" error={errors.deadline}>{(id) => <input id={id} type="date" min={todayIso()} className="input" value={f.deadline} onChange={ev('deadline')} />}</Field>}
        <Field label="Dagen" optional><DatePicker value={f.dates} onChange={set('dates')} /></Field>
        <Field label="Momenten" optional><Choice multiple options={TIME_PREFS} value={f.time_prefs} onChange={set('time_prefs')} name="Momenten" /></Field>
        <Field label="Waar" optional><Choice options={LOCATIONS} value={f.location_pref} onChange={set('location_pref')} name="Waar" /></Field>
        <Field label="Wat vroeg de leerling?" optional>{(id) => <textarea id={id} className="input" rows={3} value={f.message} onChange={ev('message')} />}</Field>
        <Field label="Interne notitie" optional>{(id) => <textarea id={id} className="input" rows={2} value={f.internal_note} onChange={ev('internal_note')} />}</Field>
        {f.email && <Checkbox checked={f.send_confirmation} onChange={set('send_confirmation')}>Stuur een bevestigingsmail met statuslink en privacyverklaring</Checkbox>}
        {err && <Alert kind="error">{err}</Alert>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Bezig…' : 'Aanvraag toevoegen'}</button>
      </form>
    </div>
  );
}
