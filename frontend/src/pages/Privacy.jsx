import { Link } from 'react-router-dom';
import { Spinner, useApi, useTitle } from '../components/ui.jsx';
import { fmtDayLong } from '../api.js';

export default function Privacy() {
  useTitle('Privacyverklaring');
  const { data: c, loading } = useApi('/public/config');
  if (loading || !c) return <div className="wrap pad"><Spinner /></div>;
  const { privacy: p, retention: r } = c;

  return (
    <section className="section page-top">
      <article className="wrap narrow prose legal">
        <h1 className="h1">Privacyverklaring</h1>
        <p className="muted">Laatst bijgewerkt op {fmtDayLong(p.version).replace(/^./, (ch) => ch.toLowerCase())}</p>

        <p>Op deze website kan je bijles aanvragen bij {p.controllerName}. We vinden het belangrijk dat je weet wat we met je gegevens doen. Hieronder lees je dat in gewone taal.</p>

        <h2 className="h3">Wie is verantwoordelijk?</h2>
        <p>{p.controllerName} zijn verantwoordelijk voor de verwerking van je gegevens. Je bereikt ons via <a href={`mailto:${p.controllerEmail}`}>{p.controllerEmail}</a>.</p>

        <h2 className="h3">Welke gegevens verzamelen we?</h2>
        <ul>
          <li><strong>Bij een bijlesaanvraag:</strong> je voornaam (en eventueel achternaam), je e-mailadres en/of telefoonnummer, of je de ouder bent en de voornaam van je kind, het vak, je jaar en richting, wanneer je bijles wilt, de dagen en momenten die je aanduidde, je voorkeur voor de plaats en je bericht.</li>
          <li><strong>Tijdens de opvolging:</strong> de geplande lessen en de berichten die jij en je bijlesgever via de website sturen.</li>
          <li><strong>Op de wachtlijst:</strong> je e-mailadres, het vak, en als je dat invult je voornaam, jaar en opmerking.</li>
          <li><strong>Technisch:</strong> je IP-adres wordt kort gebruikt om misbruik en spam tegen te gaan en kan in serverlogs staan.</li>
        </ul>
        <p>We gebruiken geen advertentie- of analysecookies en volgen je niet over andere websites. Lettertypes worden van onze eigen server geladen. Enkel bijlesgevers die inloggen krijgen een noodzakelijk sessiecookie.</p>

        <h2 className="h3">Waarvoor gebruiken we ze?</h2>
        <p>Alleen om je bijles te regelen: je aanvraag bekijken, contact met je opnemen, lessen inplannen, je bevestigingen en herinneringen mailen, en je verwittigen als een vak van de wachtlijst beschikbaar wordt. We gebruiken je gegevens niet voor reclame en verkopen ze nooit.</p>
        <p>We doen dat op basis van je toestemming (die je geeft met het vinkje in het formulier) en omdat het nodig is om de bijles af te spreken die je zelf vraagt. Je kan je toestemming altijd intrekken door je gegevens te laten verwijderen.</p>

        <h2 className="h3">Jonger dan 13?</h2>
        <p>Dan vragen we dat een ouder of voogd het formulier invult. Een ouder kan ook altijd zelf een aanvraag doen voor zijn of haar kind.</p>

        <h2 className="h3">Wie krijgt je gegevens te zien?</h2>
        <p>Alleen Yeno en Reda. De website draait op een eigen server die wij beheren. Voor het versturen van e-mails gebruiken we een e-maildienst die de berichten aflevert. We geven je gegevens niet door aan anderen, tenzij de wet ons daartoe verplicht.</p>

        <h2 className="h3">Hoe lang bewaren we ze?</h2>
        <ul>
          <li>Aanvragen die doorgingen, met hun lessen en berichten: tot <strong>{r.activeMonths} maanden</strong> na de laatste activiteit.</li>
          <li>Aanvragen die geannuleerd werden, niet konden doorgaan of nooit ingepland werden: <strong>{r.closedMonths} maanden</strong> na de laatste activiteit.</li>
          <li>Wachtlijstinschrijvingen: <strong>{r.waitlistMonths} maanden</strong> na je inschrijving.</li>
          <li>Kopieën van verstuurde e-mails in ons systeem: <strong>{r.outboxDays} dagen</strong>.</li>
        </ul>
        <p>Daarna worden ze automatisch verwijderd. Je kan ze ook altijd eerder laten verwijderen.</p>

        <h2 className="h3">Je rechten</h2>
        <p>Je hebt het recht om je gegevens in te kijken, te laten verbeteren of verwijderen, de verwerking te laten beperken, bezwaar te maken en je gegevens op te vragen in een leesbaar formaat. Zo doe je dat:</p>
        <ul>
          <li>Via de persoonlijke link in je bevestigingsmail zie je je aanvraag en kan je ze annuleren of verwijderen.</li>
          <li>Via <Link to="/privacy/verwijderen">Mijn gegevens verwijderen</Link> wis je in één keer alles wat bij je e-mailadres hoort.</li>
          <li>Voor al de rest mail je naar <a href={`mailto:${p.controllerEmail}`}>{p.controllerEmail}</a>. We antwoorden binnen een maand.</li>
        </ul>
        <p>Ben je niet tevreden over hoe we met je gegevens omgaan? Dan kan je een klacht indienen bij de Gegevensbeschermingsautoriteit (<a href="https://www.gegevensbeschermingsautoriteit.be" target="_blank" rel="noopener noreferrer">gegevensbeschermingsautoriteit.be</a>).</p>

        <h2 className="h3">Beveiliging</h2>
        <p>De website gebruikt een versleutelde verbinding (https). Je aanvraag is enkel te bekijken via een lange, willekeurige link die alleen jij krijgt, en het beheergedeelte is afgeschermd met een wachtwoord.</p>
      </article>
    </section>
  );
}
