import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, fmtShortDateTime } from '../api.js';
import { Alert, Spinner, useApi, useTitle } from '../components/ui.jsx';
import { Icon } from '../components/Icon.jsx';

export default function WaitlistManage() {
  useTitle('Wachtlijst');
  const { token } = useParams();
  const { data, error, loading } = useApi(`/public/waitlist/${token}`);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  async function remove() {
    try { await api(`/public/waitlist/${token}`, { method: 'DELETE' }); setDone(true); } catch (e) { setErr(e.message); }
  }

  return (
    <section className="section page-top"><div className="wrap narrow">
      {loading ? <Spinner /> : done ? (
        <div className="success"><div className="success-icon"><Icon name="check" size={32} /></div>
          <h1 className="h2">Je bent uitgeschreven</h1><p>Je e-mailadres is van de wachtlijst verwijderd.</p>
          <Link to="/" className="btn">Naar de startpagina</Link></div>
      ) : error ? (
        <><h1 className="h1">Niet gevonden</h1><p className="lead">{error.message}</p></>
      ) : (
        <>
          <h1 className="h1">Je wachtlijstinschrijving</h1>
          <p className="lead">{data.email} staat op de wachtlijst voor <strong>{data.subject}</strong> sinds {fmtShortDateTime(data.created_at)}.</p>
          {err && <Alert kind="error">{err}</Alert>}
          <button className="btn btn-ghost danger" onClick={remove}><Icon name="trash" size={18} />Uitschrijven en gegevens verwijderen</button>
        </>
      )}
    </div></section>
  );
}
