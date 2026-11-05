import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import { Alert, Field, Spinner, useApi, useTitle } from '../components/ui.jsx';
import { Icon } from '../components/Icon.jsx';

export function DeletionRequest() {
  useTitle('Gegevens verwijderen');
  const [email, setEmail] = useState('');
  const [state, setState] = useState({ busy: false, done: false, err: '' });

  async function submit(e) {
    e.preventDefault();
    setState({ busy: true, done: false, err: '' });
    try { await api('/public/deletion', { method: 'POST', body: { email } }); setState({ busy: false, done: true, err: '' }); }
    catch (er) { setState({ busy: false, done: false, err: er.fields?._ || er.message }); }
  }

  return (
    <section className="section page-top"><div className="wrap narrow">
      <Link to="/privacy" className="back"><Icon name="back" size={18} />Privacyverklaring</Link>
      <h1 className="h1">Mijn gegevens verwijderen</h1>
      <p className="lead">Vul het e-mailadres in dat je gebruikte. Je krijgt een mail met een link om het verwijderen te bevestigen. Zo kan niemand anders jouw gegevens wissen.</p>
      {state.done ? (
        <Alert kind="success">Als we gegevens hebben voor <strong>{email}</strong>, staat er nu een mail in je inbox. De link is 24 uur geldig.</Alert>
      ) : (
        <form className="form card-form" onSubmit={submit}>
          <Field label="E-mail" required>
            {(id) => <input id={id} type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />}
          </Field>
          {state.err && <Alert kind="error">{state.err}</Alert>}
          <button className="btn btn-primary btn-block" disabled={state.busy}>{state.busy ? 'Bezig…' : 'Stuur de bevestigingslink'}</button>
        </form>
      )}
      <p className="muted small mt">Gaf je alleen een telefoonnummer op? Open dan de link van je aanvraag en kies daar "Mijn gegevens verwijderen", of vraag het rechtstreeks aan Yeno of Reda.</p>
    </div></section>
  );
}

export function DeletionConfirm() {
  useTitle('Gegevens verwijderen');
  const { token } = useParams();
  const { data, error, loading } = useApi(`/public/deletion/${token}`);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try { setResult(await api(`/public/deletion/${token}/confirm`, { method: 'POST' })); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <section className="section page-top"><div className="wrap narrow">
      {loading ? <Spinner /> : result ? (
        <div className="success"><div className="success-icon"><Icon name="check" size={32} /></div>
          <h1 className="h2">Je gegevens zijn verwijderd</h1>
          <p>{result.requests} aanvra{result.requests === 1 ? 'ag' : 'gen'} en {result.waitlist} wachtlijstinschrijving{result.waitlist === 1 ? '' : 'en'} zijn definitief gewist.</p>
          <Link to="/" className="btn">Naar de startpagina</Link></div>
      ) : error ? (
        <><h1 className="h1">Link ongeldig</h1><p className="lead">{error.message}</p><Link to="/privacy/verwijderen" className="btn">Nieuwe link aanvragen</Link></>
      ) : (
        <>
          <h1 className="h1">Bevestig het verwijderen</h1>
          <p className="lead">Voor <strong>{data.email}</strong> vonden we {data.requests} bijlesaanvra{data.requests === 1 ? 'ag' : 'gen'} en {data.waitlist} wachtlijstinschrijving{data.waitlist === 1 ? '' : 'en'}. Alles, ook geplande lessen en berichten, wordt definitief verwijderd.</p>
          {err && <Alert kind="error">{err}</Alert>}
          <button className="btn btn-danger btn-lg" onClick={confirm} disabled={busy}><Icon name="trash" />{busy ? 'Bezig…' : 'Definitief verwijderen'}</button>
        </>
      )}
    </div></section>
  );
}
