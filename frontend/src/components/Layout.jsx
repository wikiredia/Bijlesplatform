import { Link, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Naar de startpagina">
      <span className="logo-mark" aria-hidden="true">b</span>
      <span className="logo-text">bijles<span className="logo-dot">.</span></span>
    </Link>
  );
}

export function PublicLayout() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return (
    <div className="site">
      <a href="#main" className="skip">Naar de inhoud</a>
      <header className="topbar">
        <div className="wrap topbar-inner">
          <Logo />
          <nav aria-label="Bijlesgevers" className="topnav">
            <Link to="/bijles/yeno">Yeno</Link>
            <Link to="/bijles/reda">Reda</Link>
          </nav>
        </div>
      </header>
      <main id="main"><Outlet /></main>
      <footer className="footer">
        <div className="wrap footer-inner">
          <div>
            <Logo />
            <p className="muted small">Bijles tot en met het 6de middelbaar door Yeno Roelants en Reda Kadi.</p>
          </div>
          <nav aria-label="Voettekst" className="footer-links">
            <Link to="/privacy">Privacyverklaring</Link>
            <Link to="/privacy/verwijderen">Mijn gegevens verwijderen</Link>
            <Link to="/andere">Ander vak aanvragen</Link>
            <Link to="/beheer">Inloggen voor bijlesgevers</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
