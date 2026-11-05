import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Navigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { Alert, Field, Spinner, useTitle } from '../components/ui.jsx';
import { Icon } from '../components/Icon.jsx';
import Requests from './Requests.jsx';
import RequestDetail from './RequestDetail.jsx';
import NewRequest from './NewRequest.jsx';
import Agenda from './Agenda.jsx';
import Waitlist from './Waitlist.jsx';
import Profile from './Profile.jsx';
import '../admin.css';

function Login({ onLogin }) {
  useTitle('Inloggen');
  const [f, setF] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('');
    try { await api('/admin/login', { method: 'POST', body: f }); onLogin(); } catch (er) { setErr(er.message); } finally { setBusy(false); }
  }
  return (
    <div className="admin-login">
      <form className="card-form form" onSubmit={submit}>
        <Link to="/" className="logo"><span className="logo-mark">b</span><span className="logo-text">bijles<span className="logo-dot">.</span></span></Link>
        <h1 className="h2">Inloggen voor bijlesgevers</h1>
        <Field label="E-mail">{(id) => <input id={id} type="email" className="input" autoComplete="username" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />}</Field>
        <Field label="Wachtwoord">{(id) => <input id={id} type="password" className="input" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />}</Field>
        {err && <Alert kind="error">{err}</Alert>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Bezig…' : 'Inloggen'}</button>
      </form>
    </div>
  );
}

const NAV = [
  { to: '/beheer', end: true, icon: 'list', label: 'Aanvragen' },
  { to: '/beheer/agenda', icon: 'calendar', label: 'Agenda' },
  { to: '/beheer/wachtlijst', icon: 'clipboard', label: 'Wachtlijst' },
  { to: '/beheer/profiel', icon: 'user', label: 'Profiel' },
];

export default function AdminApp() {
  const [me, setMe] = useState(undefined);
  const load = () => api('/admin/me').then(setMe).catch(() => setMe(null));
  useEffect(() => { load(); }, []);

  if (me === undefined) return <div className="wrap pad"><Spinner /></div>;
  if (!me) return <Login onLogin={load} />;

  async function logout() { await api('/admin/logout', { method: 'POST' }).catch(() => {}); setMe(null); }

  return (
    <div className="admin">
      <header className="admin-top">
        <div className="wrap admin-top-inner">
          <Link to="/beheer" className="logo"><span className="logo-mark">b</span><span className="logo-text">beheer</span></Link>
          <nav className="admin-nav" aria-label="Beheer">
            {NAV.map((n) => <NavLink key={n.to} to={n.to} end={n.end}><Icon name={n.icon} size={20} /><span>{n.label}</span></NavLink>)}
          </nav>
          <div className="admin-me">
            <span className="muted small">{me.first_name}</span>
            <button className="icon-btn" onClick={logout} aria-label="Uitloggen" title="Uitloggen"><Icon name="logout" /></button>
          </div>
        </div>
      </header>
      <main className="wrap admin-main">
        <Routes>
          <Route index element={<Requests me={me} />} />
          <Route path="aanvragen/nieuw" element={<NewRequest me={me} />} />
          <Route path="aanvragen/:id" element={<RequestDetail me={me} />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="wachtlijst" element={<Waitlist />} />
          <Route path="profiel" element={<Profile me={me} />} />
          <Route path="*" element={<Navigate to="/beheer" replace />} />
        </Routes>
      </main>
    </div>
  );
}
