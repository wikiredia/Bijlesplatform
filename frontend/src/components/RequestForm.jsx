import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, SUBJECTS, URGENCY, TIME_PREFS, LOCATIONS, todayIso } from '../api.js';
import { Field, Choice, Checkbox, Alert } from './ui.jsx';
import { DatePicker } from './DatePicker.jsx';
import { Icon } from './Icon.jsx';

const YEARS = { 1: '1ste', 2: '2de', 3: '3de', 4: '4de', 5: '5de', 6: '6de' };

export default function RequestForm({ tutor, preselect }) {
  const [f, setF] = useState({
    subject: preselect, school_year: '', school_track: '', urgency: '', deadline: '',
    dates: { available: [], unavailable: [] }, time_prefs: [], location_pref: '', message: '',
    is_parent: false, student_name: '', first_name: '', last_name: '', email: '', phone: '', consent: false, website: '',
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [done, setDone] = useState(null);
  const top = useRef(null);
  const set = (k) => (v) => { setF((s) => ({ ...s, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };
  const ev = (k) => (e) => set(k)(e.target.value);

  function validate() {
    const e = {};
    if (!f.first_name.trim()) e.first_name = 'Vul je voornaam in';
    if (!f.email.trim() && !f.phone.trim()) e.email = 'Vul een e-mailadres of telefoonnummer in';
    if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Dit e-mailadres klopt niet';
    if (!f.school_year) e.school_year = 'Kies in welk jaar je zit';
    if (!f.urgency) e.urgency = 'Kies wanneer je bijles wilt';
    if (f.urgency === 'tegen_datum' && !f.deadline) e.deadline = 'Kies een datum';
    if (!f.consent) e.consent = 'Je moet akkoord gaan om je aanvraag te versturen';
    return e;
  }

  function focusFirstError(e) {
    requestAnimationFrame(() => {
      const el = top.current?.querySelector('.has-error');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.querySelector('input,textarea,button')?.focus({ preventScroll: true });
    });
    return e;
  }

  async function submit(ev) {
    ev.preventDefault();
    setFormError('');
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); focusFirstError(e); return; }
    setBusy(true);
    try {
      const res = await api('/public/requests', {
        method: 'POST',
        body: {
          tutor: tutor.slug, subject: f.subject, school_year: f.school_year, school_track: f.school_track,
          urgency: f.urgency, deadline: f.urgency === 'tegen_datum' ? f.deadline : '',
          available_dates: f.dates.available, unavailable_dates: f.dates.unavailable,
          time_prefs: f.time_prefs, location_pref: f.location_pref || null, message: f.message,
          is_parent: f.is_parent, student_name: f.student_name, first_name: f.first_name, last_name: f.last_name,
          email: f.email, phone: f.phone, consent: f.consent, website: f.website,
        },
      });
      setDone(res);
      top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      if (err.fields && Object.keys(err.fields).length) {
        const mapped = { ...err.fields };
        if (mapped.available_dates) mapped.dates = mapped.available_dates;
        setErrors(mapped);
        focusFirstError(mapped);
      }
      setFormError(err.message === 'Validatie mislukt' ? 'Controleer de aangeduide velden.' : err.message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const link = done.token ? `${window.location.origin}/aanvraag/${done.token}` : null;
    return (
      <div className="success" ref={top}>
        <div className="success-icon"><Icon name="check" size={32} /></div>
        <h3 className="h2">Je aanvraag is verstuurd</h3>
        <p>Referentie <strong>{done.ref}</strong>. {tutor.first_name} bekijkt je aanvraag en laat zo snel mogelijk iets weten.</p>
        {done.hasEmail
          ? <p>Je krijgt zo meteen een bevestiging per mail, met een link om je aanvraag te volgen.</p>
          : <p>Je gaf geen e-mailadres op, dus {tutor.first_name} neemt contact op via je telefoon. Bewaar de link hieronder om je aanvraag te volgen.</p>}
        {link && <Link to={`/aanvraag/${done.token}`} className="btn btn-primary">Mijn aanvraag bekijken</Link>}
      </div>
    );
  }

  const minDate = todayIso();

  return (
    <form className="form" onSubmit={submit} noValidate ref={top}>
      {/* honeypot tegen spambots: onzichtbaar voor mensen */}
      <div className="hp" aria-hidden="true">
        <label>Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={ev('website')} /></label>
      </div>

      <fieldset className="form-step">
        <legend><span className="step-n">1</span>Vak en jaar</legend>
        {tutor.subjects.length > 1 && (
          <Field label="Vak" required error={errors.subject}>
            <Choice options={Object.fromEntries(tutor.subjects.map((s) => [s, SUBJECTS[s]?.label || s]))} value={f.subject} onChange={set('subject')} name="Vak" />
          </Field>
        )}
        <Field label="In welk jaar zit je?" required error={errors.school_year}>
          <Choice options={YEARS} value={String(f.school_year)} onChange={(v) => set('school_year')(f.school_year === v ? '' : v)} name="Jaar" className="choice-years" />
        </Field>
        <Field label="Richting" optional error={errors.school_track}>
          {(id) => <input id={id} className="input" value={f.school_track} onChange={ev('school_track')} placeholder="bv. Wetenschappen-wiskunde" maxLength={80} />}
        </Field>
      </fieldset>

      <fieldset className="form-step">
        <legend><span className="step-n">2</span>Wanneer</legend>
        <Field label="Wanneer wil je bijles?" required error={errors.urgency}>
          <Choice options={URGENCY} value={f.urgency} onChange={set('urgency')} name="Wanneer" className="choice-urgency" />
        </Field>
        {f.urgency === 'tegen_datum' && (
          <Field label="Tegen welke datum?" required error={errors.deadline} hint="Bijvoorbeeld de dag van je toets of examen.">
            {(id) => <input id={id} type="date" className="input" min={minDate} value={f.deadline} onChange={ev('deadline')} />}
          </Field>
        )}
        <Field label="Op welke dagen kan je wel of niet?" optional error={errors.dates || errors.unavailable_dates}>
          <p className="callout">
            Er wordt eerst gevraagd of {tutor.first_name} deze datum wel kan. Hoe meer je aanduidt, hoe beter.
          </p>
          <DatePicker value={f.dates} onChange={set('dates')} />
        </Field>
        <Field label="Welke momenten passen meestal?" optional>
          <Choice multiple options={TIME_PREFS} value={f.time_prefs} onChange={set('time_prefs')} name="Momenten" />
        </Field>
        <Field label="Waar?" optional>
          <Choice options={LOCATIONS} value={f.location_pref} onChange={(v) => set('location_pref')(f.location_pref === v ? '' : v)} name="Waar" />
        </Field>
        <Field label="Waar wil je vooral hulp bij?" optional error={errors.message}>
          {(id) => <textarea id={id} className="input" rows={4} maxLength={2000} value={f.message} onChange={ev('message')}
            placeholder="bv. Toets over vectoren volgende vrijdag, ik snap het hoofdstuk over krachten niet goed…" />}
        </Field>
      </fieldset>

      <fieldset className="form-step">
        <legend><span className="step-n">3</span>Je gegevens</legend>
        <Checkbox checked={f.is_parent} onChange={set('is_parent')}>Ik ben de ouder en vraag bijles aan voor mijn kind</Checkbox>
        {f.is_parent && (
          <Field label="Voornaam van je kind" optional>
            {(id) => <input id={id} className="input" value={f.student_name} onChange={ev('student_name')} maxLength={80} autoComplete="off" />}
          </Field>
        )}
        <div className="row-2">
          <Field label={f.is_parent ? 'Jouw voornaam' : 'Voornaam'} required error={errors.first_name}>
            {(id) => <input id={id} className="input" value={f.first_name} onChange={ev('first_name')} autoComplete="given-name" maxLength={60} />}
          </Field>
          <Field label="Achternaam" optional>
            {(id) => <input id={id} className="input" value={f.last_name} onChange={ev('last_name')} autoComplete="family-name" maxLength={80} />}
          </Field>
        </div>
        <p className="field-hint strong">Vul minstens een e-mailadres of telefoonnummer in. Met een e-mailadres krijg je een bevestiging en een herinnering voor je les.</p>
        <div className="row-2">
          <Field label="E-mail" error={errors.email}>
            {(id) => <input id={id} type="email" inputMode="email" className="input" value={f.email} onChange={ev('email')} autoComplete="email" maxLength={254} />}
          </Field>
          <Field label="Telefoon" error={errors.phone}>
            {(id) => <input id={id} type="tel" inputMode="tel" className="input" value={f.phone} onChange={ev('phone')} autoComplete="tel" placeholder="04xx xx xx xx" maxLength={30} />}
          </Field>
        </div>
        <Checkbox checked={f.consent} onChange={set('consent')} error={errors.consent}>
          Ik ga akkoord dat mijn gegevens gebruikt worden om de bijles te regelen, zoals beschreven in de{' '}
          <Link to="/privacy" target="_blank">privacyverklaring</Link>. *
        </Checkbox>
        <p className="field-hint">Ben je jonger dan 13? Vraag dan een ouder om het formulier in te vullen.</p>
      </fieldset>

      {formError && <Alert kind="error">{formError}</Alert>}
      <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
        {busy ? 'Bezig met versturen…' : 'Bijles aanvragen'}
      </button>
    </form>
  );
}
