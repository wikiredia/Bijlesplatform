import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon.jsx';
import { Reveal, Initials, useApi, useTitle } from '../components/ui.jsx';

// Vakken op de startpagina. Nieuw vak? Voeg hier een regel toe.
// `c` is de kleur van het icoontje (laat leeg voor de standaardkleur).
const SUBJECT_ROWS = [
  { key: 'wiskunde', label: 'Wiskunde', who: 'bij Yeno', to: '/bijles/yeno?vak=wiskunde', icon: 'math', c: 'var(--c-math)' },
  { key: 'fysica', label: 'Fysica', who: 'bij Yeno', to: '/bijles/yeno?vak=fysica', icon: 'phys', c: 'var(--c-phys)' },
  { key: 'programmeren', label: 'Programmeren', who: 'bij Reda', to: '/bijles/reda?vak=programmeren', icon: 'code', c: 'var(--c-code)' },
  { key: 'informatica', label: 'Informatica / ICT', who: 'bij Reda', to: '/bijles/reda?vak=programmeren', icon: 'monitor', c: '#0b7fa8' },
  { key: 'web', label: 'Websites & apps', who: 'bij Reda', to: '/bijles/reda?vak=programmeren', icon: 'globe', c: '#6d4cf0' },
  { key: 'games', label: 'Games maken', who: 'bij Reda', to: '/bijles/reda?vak=programmeren', icon: 'game', c: '#d6336c' },
  { key: 'elektronica', label: 'Elektronica & Arduino', who: 'bij Reda', to: '/bijles/reda?vak=programmeren', icon: 'chip', c: '#d97706' },
];

const TUTORS = [
  { slug: 'yeno', name: 'Yeno Roelants', subjects: ['Wiskunde', 'Fysica'] },
  { slug: 'reda', name: 'Reda Kadi', subjects: ['Programmeren', 'Informatica / ICT', 'Websites & apps', 'Games maken', 'Elektronica & Arduino'] },
];

const STEPS = [
  { t: 'Kies je vak', d: 'Je komt meteen bij de juiste bijlesgever terecht.' },
  { t: 'Vul info in of stuur een WhatsApp', d: 'Kies of het dringend is en wanneer je kan. Liever een berichtje? Stuur gewoon een WhatsApp.' },
  { t: 'Je krijgt een voorstel', d: 'We plannen de les in. Je krijgt een bevestiging per mail, met een herinnering.' },
];

const FAQ = [
  { q: 'Voor wie is de bijles?', a: 'Voor leerlingen van het 1ste tot en met het 6de middelbaar. Je kan zelf een aanvraag doen, of je ouder kan dat voor je doen.' },
  { q: 'Waar gaat de bijles door?', a: 'Aan huis of online. In het formulier duid je aan wat jij het liefst hebt; de precieze plek spreek je samen af.' },
  { q: 'Moet ik een e-mailadres opgeven?', a: 'Een e-mailadres of telefoonnummer is genoeg. Met een e-mailadres krijg je wel automatisch een bevestiging, updates en een herinnering voor je les.' },
  { q: 'Ik zoek bijles voor een ander vak.', a: 'Laat je e-mailadres en het vak achter. Zodra we iemand vinden die dat vak geeft, krijg je bericht.' },
  { q: 'Wat gebeurt er met mijn gegevens?', a: 'We gebruiken ze alleen om je bijles te regelen en verwijderen ze automatisch na een tijd. Je kan ze ook zelf meteen laten verwijderen.' },
];

export default function Home() {
  useTitle('');
  const yeno = useApi('/public/tutors/yeno');
  const reda = useApi('/public/tutors/reda');

  return (
    <>
      <section className="hero">
        <div className="hero-glow" aria-hidden="true" />
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <h1 className="hero-title"><span>Bijles</span> <span>wiskunde,</span> <span>fysica en</span> <span>programmeren</span></h1>
            <p className="lead">Van het 1ste tot en met het 6de middelbaar. Kies waarvoor je hulp zoekt en vraag meteen een les aan.</p>
          </div>
          <nav className="subjects-wrap" aria-label="Kies een vak">
            <div className="subjects">
            {SUBJECT_ROWS.map((s, i) => (
              <Link key={s.key} to={s.to} className="subject" style={{ '--i': i, ...(s.c && { '--c': s.c }) }}>
                <span className="subject-icon"><Icon name={s.icon} size={22} /></span>
                <span className="subject-text">
                  <span className="subject-label">{s.label}</span>
                  <span className="subject-who">{s.who}</span>
                </span>
                <Icon name="chevR" className="subject-chev" />
              </Link>
            ))}
            </div>
            <p className="subjects-other">Zoek je een ander vak? <Link to="/andere">Zet je op de wachtlijst</Link></p>
          </nav>
        </div>
      </section>

      <section className="section section-tint">
        <div className="wrap">
          <Reveal as="h2" className="h2">Je bijlesgevers</Reveal>
          <div className="tutor-cards">
            {TUTORS.map((t, i) => {
              const q = t.slug === 'yeno' ? yeno : reda;
              return (
                <Reveal key={t.slug} delay={i * 100}>
                  <Link to={`/bijles/${t.slug}`} className={`tutor-card t-${t.slug}`}>
                    {q.data?.photo_url ? <img src={q.data.photo_url} alt="" className="avatar" /> : <Initials name={t.name} />}
                    <div>
                      <h3 className="h3">{t.name}</h3>
                      {q.data?.headline && <p className="muted">{q.data.headline}</p>}
                      <ul className="tutor-card-subjects">{t.subjects.map((v) => <li key={v}>{v}</li>)}</ul>
                    </div>
                    <span className="tutor-card-cta">Bekijk profiel <Icon name="arrow" size={18} /></span>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <Reveal as="h2" className="h2">Zo werkt het</Reveal>
          <ol className="steps">
            {STEPS.map((s, i) => (
              <Reveal as="li" key={s.t} className="step" delay={i * 90}>
                <span className="step-n" aria-hidden="true">{i + 1}</span>
                <div><h3 className="h3">{s.t}</h3><p>{s.d}</p></div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <Reveal as="h2" className="h2">Vaak gevraagd</Reveal>
          <div className="faq">
            {FAQ.map((f) => (
              <details key={f.q} className="faq-item">
                <summary>{f.q}<Icon name="plus" className="faq-icon" /></summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
