import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon.jsx';
import { Reveal, Initials, useApi, useTitle } from '../components/ui.jsx';

const SUBJECT_ROWS = [
  { key: 'wiskunde', label: 'Wiskunde', who: 'bij Yeno', to: '/bijles/yeno?vak=wiskunde', icon: 'math' },
  { key: 'fysica', label: 'Fysica', who: 'bij Yeno', to: '/bijles/yeno?vak=fysica', icon: 'phys' },
  { key: 'programmeren', label: 'Programmeren / ICT', who: 'bij Reda', to: '/bijles/reda?vak=programmeren', icon: 'code' },
  { key: 'andere', label: 'Een ander vak', who: 'zet je op de wachtlijst', to: '/andere', icon: 'more' },
];

const STEPS = [
  { t: 'Kies je vak', d: 'Je komt meteen bij de juiste bijlesgever terecht.' },
  { t: 'Duid aan wanneer het past', d: 'Kies of het dringend is en tik in de kalender de dagen aan waarop je kan. Liever een berichtje? Stuur gewoon een WhatsApp.' },
  { t: 'Je krijgt een voorstel', d: 'Yeno of Reda checkt de data en plant de les in. Je krijgt een bevestiging per mail, met een herinnering de dag ervoor.' },
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
            <h1 className="hero-title">Bijles wiskunde, fysica en programmeren</h1>
            <p className="lead">Van het 1ste tot en met het 6de middelbaar. Kies waarvoor je hulp zoekt en vraag meteen een les aan.</p>
          </div>
          <nav className="subjects" aria-label="Kies een vak">
            {SUBJECT_ROWS.map((s, i) => (
              <Link key={s.key} to={s.to} className={`subject s-${s.key}`} style={{ '--i': i }}>
                <span className="subject-icon"><Icon name={s.icon} size={24} /></span>
                <span className="subject-text">
                  <span className="subject-label"><span className="hl">{s.label}</span></span>
                  <span className="subject-who">{s.who}</span>
                </span>
                <Icon name="chevR" className="subject-chev" />
              </Link>
            ))}
          </nav>
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

      <section className="section section-tint">
        <div className="wrap">
          <Reveal as="h2" className="h2">Je bijlesgevers</Reveal>
          <div className="tutor-cards">
            {[{ slug: 'yeno', name: 'Yeno Roelants', subjects: 'Wiskunde & fysica', q: yeno }, { slug: 'reda', name: 'Reda Kadi', subjects: 'Programmeren & ICT', q: reda }].map((t, i) => (
              <Reveal key={t.slug} delay={i * 100}>
                <Link to={`/bijles/${t.slug}`} className={`tutor-card t-${t.slug}`}>
                  {t.q.data?.photo_url ? <img src={t.q.data.photo_url} alt="" className="avatar" /> : <Initials name={t.name} />}
                  <div>
                    <h3 className="h3">{t.name}</h3>
                    <p className="tutor-card-sub">{t.subjects}</p>
                    {t.q.data?.headline && <p className="muted">{t.q.data.headline}</p>}
                  </div>
                  <Icon name="chevR" className="subject-chev" />
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap narrow">
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
