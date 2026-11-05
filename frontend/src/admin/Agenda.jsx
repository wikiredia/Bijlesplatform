import { Link, useSearchParams } from 'react-router-dom';
import { api, SUBJECTS, brusselsParts, fmtDayLong, fmtTime } from '../api.js';
import { Alert, Spinner, useApi, useTitle } from '../components/ui.jsx';
import { Icon } from '../components/Icon.jsx';

export default function Agenda() {
  useTitle('Agenda');
  const [params, setParams] = useSearchParams();
  const when = params.get('when') === 'past' ? 'past' : 'upcoming';
  const scope = params.get('scope') === 'all' ? 'all' : 'mine';
  const { data, error, loading, reload } = useApi(`/admin/lessons?when=${when}&scope=${scope}`);
  const upd = (k, v) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); setParams(p, { replace: true }); };

  const groups = {};
  for (const l of data || []) (groups[brusselsParts(l.starts_at).date] ||= []).push(l);

  async function finish(id) {
    await api(`/admin/lessons/${id}`, { method: 'PATCH', body: { status: 'afgerond' } });
    reload();
  }

  return (
    <>
      <h1 className="h2">Agenda</h1>
      <div className="toolbar">
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={when === 'upcoming'} className={when === 'upcoming' ? 'on' : ''} onClick={() => upd('when', null)}>Komend</button>
          <button role="tab" aria-selected={when === 'past'} className={when === 'past' ? 'on' : ''} onClick={() => upd('when', 'past')}>Voorbij</button>
        </div>
        <label className="toggle small"><input type="checkbox" checked={scope === 'all'} onChange={(e) => upd('scope', e.target.checked ? 'all' : null)} /> Iedereen</label>
      </div>
      {loading ? <Spinner /> : error ? <Alert kind="error">{error.message}</Alert> : data.length === 0 ? (
        <div className="empty"><p>{when === 'upcoming' ? 'Geen geplande lessen. Plan er een vanuit een aanvraag.' : 'Nog geen voorbije lessen.'}</p></div>
      ) : (
        Object.entries(groups).map(([day, ls]) => (
          <section key={day} className="agenda-day">
            <h2 className="agenda-date">{fmtDayLong(day)}</h2>
            <ul className="agenda-list">
              {ls.map((l) => (
                <li key={l.id} className={`agenda-item st-${l.status}`} style={{ '--c': SUBJECTS[l.subject]?.color }}>
                  <span className="agenda-time">{fmtTime(l.starts_at)}</span>
                  <Link to={`/beheer/aanvragen/${l.request_id}`} className="agenda-body">
                    <strong>{l.first_name} {l.last_name || ''}</strong>
                    <span className="muted small">{SUBJECTS[l.subject]?.label} · {l.duration_min} min{l.location ? ` · ${l.location}` : ''}{scope === 'all' ? ` · ${l.tutor_first_name}` : ''}</span>
                  </Link>
                  {l.status === 'gepland' && new Date(l.starts_at) < new Date()
                    ? <button className="btn btn-sm" onClick={() => finish(l.id)}><Icon name="check" size={16} />Afgerond</button>
                    : <span className={`badge ls-${l.status}`}>{l.status}</span>}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
