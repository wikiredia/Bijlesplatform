import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SUBJECTS, STATUS, URGENCY, fmtShortDateTime, fmtDay } from '../api.js';
import { Alert, Spinner, useApi, useTitle } from '../components/ui.jsx';
import { Icon, WhatsAppIcon } from '../components/Icon.jsx';

const FILTERS = { open: 'Open', nieuw: 'Nieuw', ingepland: 'Ingepland', closed: 'Afgesloten', '': 'Alles' };

export function StatusBadge({ status }) {
  return <span className={`badge st-${status}`}>{STATUS[status] || status}</span>;
}

export default function Requests({ me }) {
  useTitle('Aanvragen');
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'open';
  const scope = params.get('scope') || 'mine';
  const [q, setQ] = useState(params.get('q') || '');
  const qs = new URLSearchParams({ status, scope, q: params.get('q') || '' }).toString();
  const list = useApi(`/admin/requests?${qs}`);
  const stats = useApi('/admin/stats');
  const upd = (k, v) => { const p = new URLSearchParams(params); if (v === null) p.delete(k); else p.set(k, v); setParams(p, { replace: true }); };

  const c = stats.data?.counts || {};
  return (
    <>
      <div className="admin-head">
        <h1 className="h2">Hoi {me.first_name}</h1>
        <Link to="/beheer/aanvragen/nieuw" className="btn btn-primary"><WhatsAppIcon size={18} />Aanvraag toevoegen</Link>
      </div>

      {stats.data && (
        <div className="stat-row">
          <Link to="/beheer?status=nieuw" className="stat"><strong>{c.nieuw || 0}</strong><span>nieuw</span></Link>
          <Link to="/beheer?status=in_behandeling" className="stat"><strong>{c.in_behandeling || 0}</strong><span>in behandeling</span></Link>
          <Link to="/beheer/agenda" className="stat"><strong>{stats.data.upcoming.length}</strong><span>komende lessen</span></Link>
          <Link to="/beheer/wachtlijst" className="stat"><strong>{stats.data.waitlist}</strong><span>op wachtlijst</span></Link>
        </div>
      )}
      {stats.data?.lessonsToFinish > 0 && (
        <Alert kind="info">{stats.data.lessonsToFinish} voorbije les{stats.data.lessonsToFinish === 1 ? '' : 'sen'} nog niet afgerond. <Link to="/beheer/agenda?when=past">Bekijk in de agenda</Link></Alert>
      )}

      <div className="toolbar">
        <div className="tabs" role="tablist">
          {Object.entries(FILTERS).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={status === k} className={status === k ? 'on' : ''} onClick={() => upd('status', k)}>{label}</button>
          ))}
        </div>
        <form className="search" onSubmit={(e) => { e.preventDefault(); upd('q', q || null); }}>
          <input className="input" type="search" placeholder="Zoek naam, e-mail, referentie…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Zoeken" />
        </form>
        <label className="toggle small">
          <input type="checkbox" checked={scope === 'all'} onChange={(e) => upd('scope', e.target.checked ? 'all' : null)} /> Ook van {me.slug === 'yeno' ? 'Reda' : 'Yeno'}
        </label>
      </div>

      {list.loading ? <Spinner /> : list.error ? <Alert kind="error">{list.error.message}</Alert> : list.data.length === 0 ? (
        <div className="empty"><p>Geen aanvragen in deze lijst.</p><Link to="/beheer/aanvragen/nieuw" className="btn">WhatsApp-aanvraag toevoegen</Link></div>
      ) : (
        <ul className="req-list">
          {list.data.map((r) => (
            <li key={r.id}>
              <Link to={`/beheer/aanvragen/${r.id}`} className={`req-row${r.urgency === 'dringend' && r.status === 'nieuw' ? ' urgent' : ''}`}>
                <span className="req-subj" style={{ '--c': SUBJECTS[r.subject]?.color }} aria-hidden="true" />
                <div className="req-main">
                  <div className="req-line">
                    <strong>{r.first_name} {r.last_name || ''}</strong>
                    <StatusBadge status={r.status} />
                    {r.urgency === 'dringend' && <span className="badge urgent"><Icon name="bolt" size={12} />Dringend</span>}
                  </div>
                  <div className="req-meta">
                    {SUBJECTS[r.subject]?.label}{r.school_year ? ` · ${r.school_year}de jaar` : ''} · {r.urgency === 'tegen_datum' && r.deadline ? `tegen ${fmtDay(r.deadline)}` : URGENCY[r.urgency]}
                    {scope === 'all' && ` · ${r.tutor_first_name}`}
                    {r.source !== 'website' && ' · via WhatsApp'}
                  </div>
                  {r.next_lesson && <div className="req-next"><Icon name="calendar" size={14} />{fmtShortDateTime(r.next_lesson)}</div>}
                </div>
                <time className="req-time">{fmtShortDateTime(r.created_at)}</time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
