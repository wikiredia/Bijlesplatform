# Bijlesplatform

Website waar leerlingen (1ste – 6de middelbaar) of hun ouders bijles aanvragen bij **Yeno Roelants** (wiskunde, fysica) of **Reda Kadi** (programmeren/ICT). Voor andere vakken kan je je op een wachtlijst zetten.

Alles draait in Docker Compose, zodat je het makkelijk naar een andere server verhuist.

```
            ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
 bezoeker → │ web (nginx)  │ /api │ api (Node)   │      │ db (Postgres)│
            │ React-site   │ ───→ │ Express      │ ───→ │ volume       │
            └──────────────┘      └──────────────┘      └──────────────┘
                                  ┌──────────────┐             ↑
                                  │ worker (Node)│ ────────────┘
                                  │ mails, herinneringen, opruimen
                                  └──────────────┘ ───→ SMTP (bv. Gmail)
```

## Wat zit erin

**Publieke site (mobile-first)**
- Startpagina met vakkeuze: wiskunde en fysica → Yeno, programmeren/ICT → Reda, ander vak → wachtlijst
- Tutorpagina met beschrijving, kernpunten, projecten en twee evenwaardige wegen: formulier of WhatsApp
- Aanvraagformulier: vak, jaar en richting, *dringend / deze week / volgende week / tegen een datum / geen haast*, kalender om dagen aan te duiden waarop je wél of níet kan, voorkeursmomenten, aan huis of online, bericht, “ik ben de ouder” (+ naam kind). Voornaam en e-mail **of** telefoon zijn verplicht
- Persoonlijke statuspagina (geheime link in de mail): status, geplande lessen, berichten heen en weer, annuleren, gegevens verwijderen
- Wachtlijst voor andere vakken, met uitschrijflink
- Privacyverklaring (bewaartermijnen komen automatisch uit de configuratie), toestemmingsvinkje, “mijn gegevens verwijderen” via e-mailbevestiging
- Geen trackers of cookies voor bezoekers, lettertypes zelf gehost, spamfilter (honeypot + rate limiting)

**Beheer (`/beheer`) voor Yeno en Reda**
- Overzicht van aanvragen met filters, zoeken, dringende bovenaan
- Aanvraag openen: contactknoppen (mail, bellen, WhatsApp), wensen met aangeduide data (tik een datum → staat in het planformulier), les inplannen, wijzigen, annuleren, afronden
- Berichten sturen (komt per mail bij de leerling)
- Status: in behandeling, kan niet doorgaan (met bericht), afronden, doorsturen naar de andere bijlesgever, verwijderen
- Interne notitie per aanvraag
- **Aanvraag toevoegen** voor wie via WhatsApp of telefoon contact opnam
- Agenda met komende en voorbije lessen
- Wachtlijst: selecteren en in één keer mailen dat een vak beschikbaar is
- Eigen profiel aanpassen (tekst, projecten, WhatsApp-nummer, foto) en wachtwoord wijzigen

**E-mails** (worden in een wachtrij gezet en door de worker verstuurd, met automatische nieuwe pogingen)

| Naar de leerling/ouder | Naar Yeno/Reda |
|---|---|
| Aanvraag goed ontvangen (+ statuslink) | Nieuwe aanvraag (“⚡ DRINGEND” in onderwerp indien dringend) |
| Bijles ingepland (+ agenda-uitnodiging .ics) | Les ingepland (+ .ics) |
| Les gewijzigd / geannuleerd (+ bijgewerkte .ics) | Les gewijzigd / geannuleerd |
| Herinnering de dag voor de les | Herinnering de dag voor de les |
| Nieuw bericht van Yeno/Reda | Nieuw bericht van de leerling |
| Aanvraag kan niet doorgaan / afgerond / doorgestuurd | Aanvraag doorgestuurd naar jou |
| Annulatie bevestigd | Leerling annuleerde of verwijderde zijn gegevens |
| Wachtlijst: inschrijving + vak beschikbaar | Aanvraag al 24 u (dringend: 4 u) onbeantwoord |
| Link om gegevens te verwijderen | Nieuwe inschrijving op de wachtlijst |

## Installeren op je homeserver

Nodig: Docker met de Compose-plugin.

```bash
git clone https://github.com/wikiredia/Bijlesplatform.git
cd Bijlesplatform
cp .env.example .env
nano .env            # vul minstens PUBLIC_URL, POSTGRES_PASSWORD, SESSION_SECRET, ADMIN_INITIAL_PASSWORD en SMTP in
docker compose up -d --build
```

De site draait nu op `http://<server>:8080` (poort instelbaar met `WEB_PORT`). Inloggen op `/beheer` met het e-mailadres van Yeno of Reda en het `ADMIN_INITIAL_PASSWORD`. **Wijzig daarna meteen je wachtwoord** via Profiel.

Wachtwoord vergeten:

```bash
docker compose exec api node src/cli/set-password.js yeno           # genereert een nieuw wachtwoord
docker compose exec api node src/cli/set-password.js reda MijnNieuwWachtwoord
```

### HTTPS en domein

Zet een reverse proxy voor poort 8080 die HTTPS regelt, bijvoorbeeld:

- **Caddy** (makkelijkst): `bijles.jouwdomein.be { reverse_proxy localhost:8080 }`
- **Nginx Proxy Manager** of **Traefik**
- **Cloudflare Tunnel** als je geen poorten wilt openzetten op je router

Zet `PUBLIC_URL` op het https-adres: dat wordt gebruikt in de links in mails, en zorgt dat het inlogcookie enkel via https gaat.

### E-mail via Gmail

1. Zet tweestapsverificatie aan op het Gmail-account dat de mails verstuurt.
2. Maak een **app-wachtwoord** aan (Google-account → Beveiliging → App-wachtwoorden).
3. In `.env`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=jouwadres@gmail.com
   SMTP_PASS=<app-wachtwoord zonder spaties>
   MAIL_FROM=Bijles Yeno & Reda <jouwadres@gmail.com>
   ```
4. `docker compose up -d` om de wijziging te laden.

Gmail laat zo’n 500 mails per dag toe, ruim genoeg. Zonder SMTP-instellingen worden mails enkel gelogd (`docker compose logs worker`).

### Lokaal testen

```bash
cp .env.example .env    # zet POSTGRES_PASSWORD, ADMIN_INITIAL_PASSWORD en SMTP_HOST=mailpit, SMTP_PORT=1025
docker compose --profile dev up -d --build
```

Open de site op http://localhost:8080 en alle verstuurde mails op http://localhost:8025.

Zonder Docker ontwikkelen: start Postgres, dan `cd backend && npm i && DATABASE_URL=... npm start` (en `npm run worker`), en `cd frontend && npm i && npm run dev` (proxy naar `localhost:3000`).

## Back-up en verhuizen

```bash
./scripts/backup.sh                                  # → backups/bijles-JJJJMMDD-UUMMSS.sql.gz
./scripts/restore.sh backups/bijles-....sql.gz       # terugzetten
```

Dagelijkse back-up via cron: `0 3 * * * /pad/naar/Bijlesplatform/scripts/backup.sh`

Verhuizen naar een andere server: maak een back-up, kopieer de map met `.env` en het back-upbestand, `docker compose up -d --build`, en zet de back-up terug met `restore.sh`.

## Aanpassen

| Wat | Waar |
|---|---|
| Tekst, projecten, WhatsApp-nummer, foto van Yeno/Reda | `/beheer` → Profiel (foto’s kan je in `frontend/public/img/` zetten) |
| Bewaartermijnen, herinneringsuur | `.env` |
| Vakken en wie ze geeft | `backend/src/config.js` (`tutors`, `SUBJECTS`) en `frontend/src/pages/Home.jsx` |
| Privacyverklaring | `frontend/src/pages/Privacy.jsx` (+ `PRIVACY_VERSION` in `.env` bijwerken) |
| Teksten van de e-mails | `backend/src/mail/notify.js` |
| Kleuren en lettertypes | `frontend/src/styles.css` (bovenaan, `:root`) |

## Privacy (AVG/GDPR) in het kort

- Toestemming via een verplicht vinkje; versie van de privacyverklaring wordt per aanvraag bewaard
- Minimale gegevens: enkel voornaam + e-mail of telefoon zijn verplicht
- Automatisch verwijderen: 12 maanden na laatste activiteit, 3 maanden voor aanvragen die niet doorgingen, wachtlijst na 12 maanden, mailkopieën na 30 dagen
- Zelf verwijderen via de statuslink of via `/privacy/verwijderen` (bevestiging per mail)
- Geen analytics, geen externe lettertypes, beheer afgeschermd met wachtwoord, rate limiting en CSRF-bescherming

> De privacyverklaring is een degelijke basis, maar geen juridisch advies. Laat ze nalezen als jullie twijfelen, zeker wanneer er geld voor de lessen gevraagd wordt.

## Structuur

```
backend/
  migrations/        SQL-schema (wordt automatisch toegepast bij opstart)
  src/server.js      API
  src/worker.js      achtergrondtaken (mails, herinneringen, opruimen)
  src/routes/        publieke en beheer-routes
  src/mail/          e-mailteksten, layout en agenda-bijlagen
frontend/
  src/pages/         publieke pagina’s
  src/admin/         beheerpaneel
  nginx.conf         serveert de site en stuurt /api door
docker-compose.yml
scripts/             back-up en terugzetten
```
