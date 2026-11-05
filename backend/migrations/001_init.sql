-- Bijlesplatform – initieel schema

CREATE TABLE tutors (
  id            SERIAL PRIMARY KEY,
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  first_name    TEXT NOT NULL,
  email         TEXT NOT NULL,
  whatsapp      TEXT,
  headline      TEXT NOT NULL DEFAULT '',
  bio           TEXT NOT NULL DEFAULT '',
  subjects      TEXT[] NOT NULL DEFAULT '{}',
  highlights    JSONB NOT NULL DEFAULT '[]',
  projects      JSONB NOT NULL DEFAULT '[]',
  photo_url     TEXT,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  password_hash TEXT,
  token_version INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token             TEXT UNIQUE NOT NULL,
  ref               TEXT UNIQUE NOT NULL,
  tutor_id          INT NOT NULL REFERENCES tutors(id),
  subject           TEXT NOT NULL,
  school_year       SMALLINT CHECK (school_year BETWEEN 1 AND 6),
  school_track      TEXT,
  first_name        TEXT NOT NULL,
  last_name         TEXT,
  email             TEXT,
  phone             TEXT,
  is_parent         BOOLEAN NOT NULL DEFAULT FALSE,
  student_name      TEXT,
  urgency           TEXT NOT NULL CHECK (urgency IN ('deze_week','volgende_week','dringend','tegen_datum','flexibel')),
  deadline          DATE,
  available_dates   DATE[] NOT NULL DEFAULT '{}',
  unavailable_dates DATE[] NOT NULL DEFAULT '{}',
  time_prefs        TEXT[] NOT NULL DEFAULT '{}',
  location_pref     TEXT,
  message           TEXT,
  source            TEXT NOT NULL DEFAULT 'website' CHECK (source IN ('website','whatsapp','manueel')),
  status            TEXT NOT NULL DEFAULT 'nieuw'
                    CHECK (status IN ('nieuw','in_behandeling','ingepland','afgerond','afgewezen','geannuleerd')),
  internal_note     TEXT,
  consent_at        TIMESTAMPTZ,
  privacy_version   TEXT,
  nudge_sent_at     TIMESTAMPTZ,
  last_activity_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (email IS NOT NULL OR phone IS NOT NULL)
);
CREATE INDEX requests_tutor_status_idx ON requests (tutor_id, status);
CREATE INDEX requests_email_idx ON requests (lower(email));

CREATE TABLE lessons (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id       UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  tutor_id         INT NOT NULL REFERENCES tutors(id),
  starts_at        TIMESTAMPTZ NOT NULL,
  duration_min     INT NOT NULL DEFAULT 60 CHECK (duration_min BETWEEN 15 AND 480),
  location         TEXT,
  note             TEXT,
  status           TEXT NOT NULL DEFAULT 'gepland' CHECK (status IN ('gepland','afgerond','geannuleerd')),
  ics_sequence     INT NOT NULL DEFAULT 0,
  reminder_sent_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX lessons_starts_idx ON lessons (status, starts_at);

CREATE TABLE messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  sender     TEXT NOT NULL CHECK (sender IN ('tutor','student','systeem')),
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX messages_request_idx ON messages (request_id, created_at);

CREATE TABLE waitlist (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token           TEXT UNIQUE NOT NULL,
  email           TEXT NOT NULL,
  subject         TEXT NOT NULL,
  first_name      TEXT,
  school_year     SMALLINT CHECK (school_year BETWEEN 1 AND 6),
  note            TEXT,
  consent_at      TIMESTAMPTZ NOT NULL,
  privacy_version TEXT,
  notified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX waitlist_email_idx ON waitlist (lower(email));

CREATE TABLE email_outbox (
  id          BIGSERIAL PRIMARY KEY,
  kind        TEXT NOT NULL,
  to_address  TEXT NOT NULL,
  reply_to    TEXT,
  subject     TEXT NOT NULL,
  html        TEXT NOT NULL,
  text        TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]',
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  attempts    INT NOT NULL DEFAULT 0,
  last_error  TEXT,
  send_after  TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX email_outbox_pending_idx ON email_outbox (status, send_after);

CREATE TABLE deletion_tokens (
  token      TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
