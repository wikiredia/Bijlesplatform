import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Icon, WhatsAppIcon } from '../components/Icon.jsx';
import { Reveal, Initials, Spinner, Alert, useApi, useTitle } from '../components/ui.jsx';
import RequestForm from '../components/RequestForm.jsx';
import { SUBJECTS } from '../api.js';
import NotFound from './NotFound.jsx';

export default function TutorPage() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const { data: t, error, loading } = useApi(`/public/tutors/${slug}`);
  useTitle(t ? `Bijles bij ${t.first_name}` : '');

  if (loading) return <div className="wrap pad"><Spinner /></div>;
  if (error?.status === 404) return <NotFound />;
  if (error) return <div className="wrap pad"><Alert kind="error">{error.message}</Alert></div>;

  const preselect = t.subjects.includes(params.get('vak')) ? params.get('vak') : t.subjects[0];
  const paragraphs = (t.bio || '').split(/\n{2,}/).filter(Boolean);

  return (
    <>
      <section className={`profile-hero t-${t.slug}`}>
        <div className="wrap">
          <Link to="/" className="back"><Icon name="back" size={18} />Alle vakken</Link>
          <div className="profile-head">
            {t.photo_url ? <img src={t.photo_url} alt="" className="avatar avatar-lg" /> : <Initials name={t.name} className="avatar-lg" />}
            <div>
              <h1 className="h1">{t.name}</h1>
              <p className="profile-subjects">{t.subjects.map((s) => SUBJECTS[s]?.label || s).join(' · ')}</p>
            </div>
          </div>
          {t.headline && <p className="lead">{t.headline}</p>}
          {t.highlights?.length > 0 && (
            <ul className="highlights">{t.highlights.map((h) => <li key={h}>{h}</li>)}</ul>
          )}

          <div className={`paths${t.whatsapp_url ? '' : ' single'}`}>
            <a href="#aanvragen" className="path path-form">
              <Icon name="calendar" size={26} />
              <span><strong>Formulier invullen</strong><span>Duid aan wanneer je kan</span></span>
            </a>
            {t.whatsapp_url && <span className="paths-or" aria-hidden="true">of</span>}
            {t.whatsapp_url && (
              <a href={t.whatsapp_url} className="path path-wa" target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon size={26} />
                <span><strong>WhatsApp sturen</strong><span>Liever gewoon een berichtje</span></span>
              </a>
            )}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <Reveal as="h2" className="h2">Over {t.first_name}</Reveal>
          <Reveal className="prose">{paragraphs.map((p, i) => <p key={i}>{p}</p>)}</Reveal>
        </div>
      </section>

      {t.projects?.length > 0 && (
        <section className="section section-tint">
          <div className="wrap">
            <Reveal as="h2" className="h2">Projecten</Reveal>
            <div className="projects">
              {t.projects.map((p, i) => (
                <Reveal key={i} className="project" delay={(i % 3) * 80}>
                  <h3 className="h3">{p.title}</h3>
                  {p.description && <p>{p.description}</p>}
                  {(p.tags?.length > 0 || p.url) && (
                    <div className="project-foot">
                      {p.tags?.map((tag) => <span key={tag} className="tag">{tag}</span>)}
                      {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="project-link"><Icon name="link" size={16} />Bekijk</a>}
                    </div>
                  )}
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section" id="aanvragen">
        <div className="wrap">
          <h2 className="h2">Bijles aanvragen bij {t.first_name}</h2>
          <p className="muted">Velden met * zijn verplicht. Het duurt ongeveer twee minuten.</p>
          <RequestForm tutor={t} preselect={preselect} />
        </div>
      </section>
    </>
  );
}
