-- TeachedOS database schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Users ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(255) NOT NULL,
  role          VARCHAR(50)  NOT NULL DEFAULT 'teacher',
  avatar        VARCHAR(10)  NOT NULL DEFAULT '🧑‍🏫',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR(20) NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_status VARCHAR(24) NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(24) NOT NULL DEFAULT 'monthly';
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_started_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_source VARCHAR(24) NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS meeting_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS zoom_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Kyiv';
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone_mode VARCHAR(16) DEFAULT 'auto';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(20);
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;

-- ── Boards ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS boards (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL DEFAULT 'My Board',
  data        JSONB        NOT NULL DEFAULT '{"cards":[],"arrows":[],"pan":{"x":100,"y":60},"scale":1,"nextId":1}',
  thumbnail   TEXT,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boards_user_id  ON boards(user_id);
CREATE INDEX IF NOT EXISTS idx_boards_updated  ON boards(updated_at DESC);

-- ── Sessions (JWT fingerprints, never raw browser tokens) ───────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT        NOT NULL UNIQUE,
  user_agent TEXT,
  ip         VARCHAR(64),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- ── Authentication audit and one-time email tokens ────────────────────────
CREATE TABLE IF NOT EXISTS auth_events (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  email      TEXT,
  event      TEXT NOT NULL,
  ip         TEXT,
  user_agent TEXT,
  detail     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auth_events_user ON auth_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_events_created ON auth_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_events_email ON auth_events(email, created_at DESC);

CREATE TABLE IF NOT EXISTS email_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  token      TEXT NOT NULL UNIQUE,
  type       TEXT NOT NULL DEFAULT 'reset',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Invites ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invites (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email            VARCHAR(255) NOT NULL,
  role             VARCHAR(50)  NOT NULL DEFAULT 'teacher',
  token            TEXT         NOT NULL UNIQUE,
  note             TEXT         NOT NULL DEFAULT '',
  created_by       UUID         REFERENCES users(id) ON DELETE SET NULL,
  accepted_user_id UUID         REFERENCES users(id) ON DELETE SET NULL,
  expires_at       TIMESTAMPTZ  NOT NULL,
  accepted_at      TIMESTAMPTZ,
  revoked_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email);

-- ── Board collaborators (future) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS board_collaborators (
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  role     VARCHAR(20) NOT NULL DEFAULT 'viewer',
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (board_id, user_id)
);

-- ── Auto-update updated_at ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_boards_updated ON boards;
CREATE TRIGGER trg_boards_updated
  BEFORE UPDATE ON boards
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Schedule ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schedule (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day        SMALLINT    NOT NULL CHECK (day BETWEEN 0 AND 6),
  start_time TIME        NOT NULL,
  end_time   TIME        NOT NULL,
  title      VARCHAR(255) NOT NULL DEFAULT 'Class',
  group_name VARCHAR(100),
  level      VARCHAR(20),
  room       VARCHAR(100),
  color      VARCHAR(20) DEFAULT '#FF4B8B',
  recurring  BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_schedule_user ON schedule(user_id);
ALTER TABLE schedule ADD COLUMN IF NOT EXISTS meeting_url TEXT;
ALTER TABLE schedule ADD COLUMN IF NOT EXISTS is_live BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE schedule ADD COLUMN IF NOT EXISTS specific_date DATE;
ALTER TABLE schedule ADD COLUMN IF NOT EXISTS board_id TEXT;

-- ── Notes and notifications ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      VARCHAR(255) NOT NULL DEFAULT 'Untitled',
  body       TEXT NOT NULL DEFAULT '',
  color      VARCHAR(20) DEFAULT '#FFFFFF',
  pinned     BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(50) NOT NULL DEFAULT 'info',
  title      VARCHAR(255) NOT NULL,
  body       TEXT,
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  link       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read);

-- ── Student Progress ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_progress (
  board_id   UUID        NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  card_id    TEXT        NOT NULL,
  status     VARCHAR(20) NOT NULL DEFAULT 'available',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (board_id, user_id, card_id)
);
CREATE INDEX IF NOT EXISTS idx_sp_board ON student_progress(board_id);
CREATE INDEX IF NOT EXISTS idx_sp_user  ON student_progress(user_id);

-- ── Teacher journal, attendance and vocabulary ─────────────────────────────
CREATE TABLE IF NOT EXISTS student_journal (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  name         VARCHAR(255) NOT NULL,
  email        VARCHAR(255),
  level        VARCHAR(20) DEFAULT 'A2',
  lessons_left INTEGER NOT NULL DEFAULT 0,
  notes        TEXT DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_student_journal_teacher ON student_journal(teacher_id, created_at DESC);

CREATE TABLE IF NOT EXISTS attendance (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  journal_id UUID NOT NULL REFERENCES student_journal(id) ON DELETE CASCADE,
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  status     VARCHAR(20) DEFAULT 'present',
  note       TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attendance_journal ON attendance(journal_id, date DESC);

CREATE TABLE IF NOT EXISTS vocabulary (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  word        VARCHAR(255) NOT NULL,
  translation VARCHAR(255) DEFAULT '',
  example     TEXT DEFAULT '',
  learned     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vocabulary_user ON vocabulary(user_id, created_at DESC);

-- ── Quiz results, card comments and web-push subscriptions ──────────────────
-- Some early builds created these lazily with INTEGER user ids. Preserve such
-- tables for forensic recovery and create the canonical UUID-backed versions.
DO $$
DECLARE
  legacy_table RECORD;
  schema_object RECORD;
  renamed_to TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='quiz_results'
       AND column_name='user_id' AND data_type='integer'
  ) AND to_regclass('public.quiz_results_legacy_integer') IS NULL THEN
    ALTER TABLE quiz_results RENAME TO quiz_results_legacy_integer;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='card_comments'
       AND column_name='user_id' AND data_type='integer'
  ) AND to_regclass('public.card_comments_legacy_integer') IS NULL THEN
    ALTER TABLE card_comments RENAME TO card_comments_legacy_integer;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='push_subscriptions'
       AND column_name='user_id' AND data_type='integer'
  ) AND to_regclass('public.push_subscriptions_legacy_integer') IS NULL THEN
    ALTER TABLE push_subscriptions RENAME TO push_subscriptions_legacy_integer;
  END IF;

  -- Table renames do not rename their constraints or standalone indexes.
  -- Move those names out of the way before the canonical tables are created.
  FOR legacy_table IN
    SELECT * FROM (VALUES
      ('quiz_results_legacy_integer'),
      ('card_comments_legacy_integer'),
      ('push_subscriptions_legacy_integer')
    ) AS legacy(name)
  LOOP
    IF to_regclass('public.' || legacy_table.name) IS NULL THEN CONTINUE; END IF;

    FOR schema_object IN
      SELECT conname AS name
        FROM pg_constraint
       WHERE conrelid=to_regclass('public.' || legacy_table.name)
         AND conname NOT LIKE legacy_table.name || '%'
    LOOP
      renamed_to := left(legacy_table.name || '_' || schema_object.name, 63);
      EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I',
        legacy_table.name, schema_object.name, renamed_to);
    END LOOP;

    FOR schema_object IN
      SELECT index_class.relname AS name
        FROM pg_index index_meta
        JOIN pg_class index_class ON index_class.oid=index_meta.indexrelid
       WHERE index_meta.indrelid=to_regclass('public.' || legacy_table.name)
         AND NOT EXISTS (
           SELECT 1 FROM pg_constraint constraint_meta
            WHERE constraint_meta.conindid=index_meta.indexrelid
         )
         AND index_class.relname NOT LIKE legacy_table.name || '%'
    LOOP
      renamed_to := left(legacy_table.name || '_' || schema_object.name, 63);
      EXECUTE format('ALTER INDEX %I RENAME TO %I', schema_object.name, renamed_to);
    END LOOP;
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS quiz_results (
  id           BIGSERIAL PRIMARY KEY,
  board_id     UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  card_id      TEXT NOT NULL,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score        INTEGER NOT NULL DEFAULT 0,
  max_score    INTEGER NOT NULL DEFAULT 0,
  pct          INTEGER NOT NULL DEFAULT 0 CHECK (pct BETWEEN 0 AND 100),
  answers      JSONB NOT NULL DEFAULT '[]'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (board_id, card_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_quiz_results_board_submitted ON quiz_results(board_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_results_user_submitted ON quiz_results(user_id, submitted_at DESC);

CREATE TABLE IF NOT EXISTS card_comments (
  id         BIGSERIAL PRIMARY KEY,
  board_id   UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  card_id    TEXT NOT NULL,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_card_comments_card ON card_comments(board_id, card_id, created_at);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, subscription)
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

-- ── Courses ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL DEFAULT 'New Course',
  description TEXT         NOT NULL DEFAULT '',
  level       VARCHAR(20)  NOT NULL DEFAULT '',
  color       VARCHAR(20)  NOT NULL DEFAULT '#FF4B8B',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_courses_user ON courses(user_id);

-- ── Course Modules ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS course_modules (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id  UUID         NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name       VARCHAR(255) NOT NULL DEFAULT 'New Module',
  ord        INTEGER      NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_modules_course ON course_modules(course_id);

-- ── Add course columns to boards (idempotent) ────────────────────────────────
ALTER TABLE boards ADD COLUMN IF NOT EXISTS course_id    UUID    REFERENCES courses(id)        ON DELETE SET NULL;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS module_id    UUID    REFERENCES course_modules(id) ON DELETE SET NULL;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS board_order  INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_boards_course ON boards(course_id);

-- ── Homework ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS homework (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,        -- teacher (owner)
  board_id        UUID         NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  course_id       UUID                  REFERENCES courses(id) ON DELETE SET NULL,
  title           VARCHAR(255) NOT NULL DEFAULT 'New homework',
  instructions    TEXT         NOT NULL DEFAULT '',
  required_cards  JSONB        NOT NULL DEFAULT '[]',                                  -- array of card IDs (strings) the student must complete
  pass_threshold  INTEGER      NOT NULL DEFAULT 60,                                    -- % score required to auto-grade as "passed"
  due_at          TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_homework_user   ON homework(user_id);
CREATE INDEX IF NOT EXISTS idx_homework_board  ON homework(board_id);
CREATE INDEX IF NOT EXISTS idx_homework_course ON homework(course_id);

DROP TRIGGER IF EXISTS trg_homework_updated ON homework;
CREATE TRIGGER trg_homework_updated
  BEFORE UPDATE ON homework
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Manual Billing / Bank Transfer Requests ────────────────────────────────
CREATE TABLE IF NOT EXISTS iban_payments (
  id           SERIAL       PRIMARY KEY,
  user_id      UUID         REFERENCES users(id) ON DELETE SET NULL,
  plan         TEXT         NOT NULL,
  payer_name   TEXT         NOT NULL,
  tx_date      DATE         NOT NULL,
  tx_note      TEXT,
  amount       NUMERIC(10,2),
  currency     TEXT         NOT NULL DEFAULT 'usd',
  invoice_no   TEXT,
  status       TEXT         NOT NULL DEFAULT 'pending',
  admin_note   TEXT,
  reviewed_by  UUID         REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at  TIMESTAMPTZ,
  billing_cycle TEXT        NOT NULL DEFAULT 'monthly',
  months       INTEGER      NOT NULL DEFAULT 1,
  company_name TEXT,
  contact_email TEXT,
  package_snapshot JSONB    NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_iban_payments_invoice_no ON iban_payments(invoice_no) WHERE invoice_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_iban_payments_status ON iban_payments(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_iban_payments_user_status ON iban_payments(user_id, status, created_at DESC);

-- ── Homework assignment (one row per student per homework) ──────────────────
CREATE TABLE IF NOT EXISTS homework_assignment (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id  UUID         NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  student_id   UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  -- status: assigned | in_progress | submitted | graded
  status       VARCHAR(20)  NOT NULL DEFAULT 'assigned',
  submitted_at TIMESTAMPTZ,
  graded_at    TIMESTAMPTZ,
  final_score  INTEGER,                  -- 0..100 (% over required_cards average)
  teacher_note TEXT         NOT NULL DEFAULT '',
  UNIQUE(homework_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_hwa_homework ON homework_assignment(homework_id);
CREATE INDEX IF NOT EXISTS idx_hwa_student  ON homework_assignment(student_id);

-- ── Homework attempt (one row per student per card per homework) ────────────
CREATE TABLE IF NOT EXISTS homework_attempt (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id  UUID         NOT NULL REFERENCES homework_assignment(id) ON DELETE CASCADE,
  card_id        VARCHAR(40)  NOT NULL,
  score          INTEGER,
  max_score      INTEGER,
  time_seconds   INTEGER,
  mistakes       INTEGER,
  -- status: pending | in_progress | done
  status         VARCHAR(20)  NOT NULL DEFAULT 'pending',
  data           JSONB        NOT NULL DEFAULT '{}',
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(assignment_id, card_id)
);
CREATE INDEX IF NOT EXISTS idx_hwt_assignment ON homework_attempt(assignment_id);

DROP TRIGGER IF EXISTS trg_hwt_updated ON homework_attempt;
CREATE TRIGGER trg_hwt_updated
  BEFORE UPDATE ON homework_attempt
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Assignments / Teacher Library ───────────────────────────────────────────
-- A single entity for every teacher-made resource (lesson, quiz, game, board
-- flow, …). Lives in the owner's "My Library"; can be published to the
-- Community library, where other teachers can clone a copy into their own.
CREATE TABLE IF NOT EXISTS assignments (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind          VARCHAR(24)  NOT NULL DEFAULT 'lesson',     -- lesson | quiz | game | board | other
  title         VARCHAR(255) NOT NULL DEFAULT 'Untitled',
  description   TEXT         NOT NULL DEFAULT '',
  level         VARCHAR(20)  NOT NULL DEFAULT '',
  skill         VARCHAR(40)  NOT NULL DEFAULT '',
  tags          JSONB        NOT NULL DEFAULT '[]',
  data          JSONB        NOT NULL DEFAULT '{}',          -- full payload (lesson plan, quiz config, etc.)
  image         TEXT,                                        -- optional cover (data URL or URL)
  visibility    VARCHAR(16)  NOT NULL DEFAULT 'private',     -- private | community | unlisted
  cloned_from   UUID         REFERENCES assignments(id) ON DELETE SET NULL,
  clone_count   INTEGER      NOT NULL DEFAULT 0,
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assignments_user       ON assignments(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignments_community   ON assignments(visibility, published_at DESC) WHERE visibility = 'community';
CREATE INDEX IF NOT EXISTS idx_assignments_kind        ON assignments(kind);

DROP TRIGGER IF EXISTS trg_assignments_updated ON assignments;
CREATE TRIGGER trg_assignments_updated
  BEFORE UPDATE ON assignments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Shared materials (public interactive links from Teacher Tools) ───────────
CREATE TABLE IF NOT EXISTS shared_materials (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  token         TEXT         UNIQUE NOT NULL,
  owner_id      UUID         REFERENCES users(id) ON DELETE SET NULL,
  title         VARCHAR(255) NOT NULL DEFAULT 'TeachEd Material',
  level         VARCHAR(20),
  text          TEXT,
  game_type     VARCHAR(40),
  game_content  JSONB,
  tags          JSONB        NOT NULL DEFAULT '[]',
  views         INTEGER      NOT NULL DEFAULT 0,
  expires_at    TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
ALTER TABLE shared_materials ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE shared_materials ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_shared_materials_owner ON shared_materials(owner_id, created_at DESC);

-- ── AI quota and quality aggregates ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_usage_monthly (
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month        DATE NOT NULL,
  reserved_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
  actual_usd   NUMERIC(10,6) NOT NULL DEFAULT 0,
  requests     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, month)
);
-- Student hub XP: one row per thing done; (user, kind, ref) is unique so nothing pays twice
CREATE TABLE IF NOT EXISTS xp_events (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       VARCHAR(24) NOT NULL,
  ref        VARCHAR(80) NOT NULL,
  xp         INTEGER NOT NULL DEFAULT 0,
  label      VARCHAR(120) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, kind, ref)
);
CREATE INDEX IF NOT EXISTS idx_xp_events_user ON xp_events(user_id, created_at DESC);

-- Student hub, challenges: the teacher's challenge of the day, duels between classmates, badges
CREATE TABLE IF NOT EXISTS teacher_challenges (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      VARCHAR(160) NOT NULL,
  brief      TEXT NOT NULL DEFAULT '',
  words      TEXT[] NOT NULL DEFAULT '{}',
  xp         INTEGER NOT NULL DEFAULT 50,
  active_on  DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (teacher_id, active_on)
);
CREATE TABLE IF NOT EXISTS challenge_done (
  challenge_id UUID NOT NULL REFERENCES teacher_challenges(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answer       TEXT NOT NULL DEFAULT '',
  xp           INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (challenge_id, user_id)
);
CREATE TABLE IF NOT EXISTS duels (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opponent_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game             VARCHAR(16) NOT NULL,
  status           VARCHAR(12) NOT NULL DEFAULT 'pending',   -- pending | active | finished | declined | expired
  questions        JSONB NOT NULL DEFAULT '[]'::jsonb,        -- with the right answers; the client never gets them
  shared_words     INTEGER NOT NULL DEFAULT 0,
  challenger_score INTEGER,
  challenger_ms    INTEGER,
  opponent_score   INTEGER,
  opponent_ms      INTEGER,
  winner_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  rematch_of       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
  finished_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_duels_challenger ON duels(challenger_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_duels_opponent ON duels(opponent_id, created_at DESC);
CREATE TABLE IF NOT EXISTS user_badges (
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge     VARCHAR(24) NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, badge)
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS duel_invites BOOLEAN NOT NULL DEFAULT TRUE;

-- Student hub, Today: the Lucky Task (one pull a day) and when the student last caught up
CREATE TABLE IF NOT EXISTS lucky_pulls (
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day          DATE NOT NULL,
  kind         VARCHAR(16) NOT NULL,
  need         INTEGER NOT NULL DEFAULT 1,
  label        VARCHAR(160) NOT NULL,
  ref          TEXT,
  pulled_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, day)
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS hub_seen_at TIMESTAMPTZ;

-- Student hub, Watch & Read: what a teacher picked for the class, how far each student got, and the level gate
CREATE TABLE IF NOT EXISTS hub_materials (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       VARCHAR(8) NOT NULL,                      -- watch | read
  title      VARCHAR(160) NOT NULL,
  topic      VARCHAR(40) NOT NULL DEFAULT '',
  kicker     VARCHAR(60) NOT NULL DEFAULT '',
  level      VARCHAR(2) NOT NULL DEFAULT 'B1',
  minutes    INTEGER NOT NULL DEFAULT 5,
  body       TEXT NOT NULL DEFAULT '',                  -- the article, or a note under the video
  video_id   VARCHAR(20),
  words      JSONB NOT NULL DEFAULT '[]'::jsonb,        -- [{ word, translation, example }]
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hub_materials_teacher ON hub_materials(teacher_id, created_at DESC);
CREATE TABLE IF NOT EXISTS hub_progress (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES hub_materials(id) ON DELETE CASCADE,
  pct         INTEGER NOT NULL DEFAULT 0,
  quiz_score  INTEGER,
  finished_at TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, material_id)
);
CREATE TABLE IF NOT EXISTS level_gates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  teacher_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  level_from  VARCHAR(2) NOT NULL,
  level_to    VARCHAR(2) NOT NULL,
  pitch       TEXT NOT NULL,
  readiness   INTEGER NOT NULL DEFAULT 0,
  status      VARCHAR(10) NOT NULL DEFAULT 'pending',   -- pending | confirmed | not_yet
  plan        TEXT NOT NULL DEFAULT '',                  -- a "not yet" always comes with a plan
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_level_gates_teacher ON level_gates(teacher_id, status);
CREATE INDEX IF NOT EXISTS idx_level_gates_user ON level_gates(user_id, created_at DESC);
-- Where the climb to the next level began, so the level path starts again from its Base Camp
CREATE TABLE IF NOT EXISTS level_moments (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  level_to     VARCHAR(2) NOT NULL,
  xp_at        INTEGER NOT NULL DEFAULT 0,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_level_moments_user ON level_moments(user_id, confirmed_at DESC);

-- Launch in waves: a cap on teacher sign-ups, and who is waiting behind it
CREATE TABLE IF NOT EXISTS app_flags (
  key   VARCHAR(60) PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS signup_waitlist (
  email      VARCHAR(254) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Free plan: a pool of credits (30 once + 10 per month a lesson was taught), not a daily limit
CREATE TABLE IF NOT EXISTS ai_credit_pool (
  user_id          UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance          INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  granted          INTEGER NOT NULL DEFAULT 0,
  last_topup_month DATE NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::date
);
-- The fuse: what every free account together has spent on AI this month
CREATE TABLE IF NOT EXISTS ai_free_budget (
  month     DATE PRIMARY KEY,
  spent_usd NUMERIC(12,6) NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS ai_usage_daily (
  day DATE PRIMARY KEY,
  total INTEGER NOT NULL DEFAULT 0,
  llm_ok INTEGER NOT NULL DEFAULT 0,
  fallback INTEGER NOT NULL DEFAULT 0,
  cache_hits INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS ai_quality_daily (
  day DATE NOT NULL,
  tool_id TEXT NOT NULL,
  engine TEXT NOT NULL,
  quality_level TEXT NOT NULL,
  total INTEGER NOT NULL DEFAULT 0,
  flagged INTEGER NOT NULL DEFAULT 0,
  source_anchor_notes INTEGER NOT NULL DEFAULT 0,
  dropped_items INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, tool_id, engine, quality_level)
);

-- ── Privileged admin action audit ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_audit (
  id BIGSERIAL PRIMARY KEY,
  admin_id UUID,
  admin_email TEXT,
  action TEXT NOT NULL,
  target_id TEXT,
  target_label TEXT,
  detail TEXT,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit(created_at DESC);

-- ── Monitoring telemetry (no board content or visitor fingerprints) ─────────
CREATE TABLE IF NOT EXISTS telemetry_events (
  id          BIGSERIAL PRIMARY KEY,
  category    VARCHAR(24) NOT NULL,
  event_type  VARCHAR(80) NOT NULL,
  outcome     VARCHAR(24) NOT NULL DEFAULT 'ok',
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  board_id    UUID REFERENCES boards(id) ON DELETE SET NULL,
  duration_ms INTEGER,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_created ON telemetry_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_category_created ON telemetry_events(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_type_created ON telemetry_events(event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS telemetry_hourly (
  hour_start        TIMESTAMPTZ NOT NULL,
  category          VARCHAR(24) NOT NULL,
  event_type        VARCHAR(80) NOT NULL,
  outcome           VARCHAR(24) NOT NULL,
  event_count       INTEGER NOT NULL DEFAULT 0,
  total_duration_ms BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (hour_start, category, event_type, outcome)
);
CREATE INDEX IF NOT EXISTS idx_telemetry_hourly_category_hour ON telemetry_hourly(category, hour_start DESC);

-- ── Operational incidents (human response, separate from telemetry) ─────────
CREATE TABLE IF NOT EXISTS incidents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           VARCHAR(160) NOT NULL,
  severity        VARCHAR(8) NOT NULL DEFAULT 's3',
  status          VARCHAR(16) NOT NULL DEFAULT 'open',
  affected_scope  VARCHAR(160) NOT NULL DEFAULT '',
  summary         TEXT NOT NULL DEFAULT '',
  source          VARCHAR(32) NOT NULL DEFAULT 'manual',
  owner_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (severity IN ('s1', 's2', 's3', 's4')),
  CHECK (status IN ('open', 'acknowledged', 'mitigating', 'resolved'))
);
CREATE INDEX IF NOT EXISTS idx_incidents_status_updated ON incidents(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_owner_status ON incidents(owner_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS incident_updates (
  id          BIGSERIAL PRIMARY KEY,
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  author_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  kind        VARCHAR(24) NOT NULL DEFAULT 'note',
  body        TEXT NOT NULL DEFAULT '',
  from_status VARCHAR(16),
  to_status   VARCHAR(16),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (kind IN ('created', 'note', 'status', 'assignment', 'metadata'))
);
CREATE INDEX IF NOT EXISTS idx_incident_updates_incident_created ON incident_updates(incident_id, created_at ASC);

-- ── Подготовка к нагрузке ────────────────────────────────────────────────────
-- Размер доски хранится рядом с доской. Раньше лимит хранилища считался на
-- каждом автосохранении запросом SUM(pg_column_size(data)) по всем доскам
-- учителя: Postgres поднимал из TOAST и распаковывал КАЖДУЮ доску, чтобы
-- узнать её размер. При пятидесяти досках это десятки мегабайт чтения на
-- одно нажатие «сохранить» - незаметно на одном учителе и смертельно на ста.
ALTER TABLE boards ADD COLUMN IF NOT EXISTS data_bytes INTEGER NOT NULL DEFAULT 0;

-- card_count рядом с размером: список досок читал jsonb_array_length(data->'cards')
-- и ради одного числа распаковывал из TOAST каждую доску целиком.
ALTER TABLE boards ADD COLUMN IF NOT EXISTS card_count INTEGER NOT NULL DEFAULT 0;
CREATE OR REPLACE FUNCTION set_board_data_bytes() RETURNS TRIGGER AS $$
BEGIN
  NEW.data_bytes := pg_column_size(NEW.data);
  NEW.card_count := CASE WHEN jsonb_typeof(NEW.data->'cards') = 'array'
                         THEN jsonb_array_length(NEW.data->'cards') ELSE 0 END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_boards_data_bytes ON boards;
CREATE TRIGGER trg_boards_data_bytes
  BEFORE INSERT OR UPDATE OF data ON boards
  FOR EACH ROW EXECUTE FUNCTION set_board_data_bytes();

-- Разовый добор для досок, созданных до появления колонки.
UPDATE boards SET data_bytes = pg_column_size(data) WHERE data_bytes = 0;
-- Разовый добор card_count (второй запуск ничего не меняет: пустые доски дают 0).
UPDATE boards SET card_count = jsonb_array_length(data->'cards')
 WHERE card_count = 0 AND jsonb_typeof(data->'cards') = 'array' AND jsonb_array_length(data->'cards') > 0;

CREATE INDEX IF NOT EXISTS idx_boards_user_bytes ON boards(user_id) INCLUDE (data_bytes);

-- Просроченные сессии никто не убирал: таблица растёт линейно по числу входов
-- и остаётся в ней навсегда. Индекс нужен уборщику, который ходит по ней раз в час.
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Дубли индексов: те же колонки уже покрыты UNIQUE-ограничениями. Каждый лишний
-- индекс - это ещё одна запись при каждом входе и лишние страницы в памяти.
DROP INDEX IF EXISTS idx_sessions_token;
-- У quiz_results два одинаковых UNIQUE по (board_id, card_id, user_id): один
-- достался от прежнего имени ограничения. Снимаем именно ограничение - индекс
-- под ним отдельно не удаляется.
ALTER TABLE quiz_results DROP CONSTRAINT IF EXISTS quiz_results_board_card_user_key;

-- Ближайший дедлайн доски вычисляется при сохранении, а не ежечасным перебором
-- всех досок. Часовая задача напоминаний читала каждую доску целиком, чтобы
-- почти всегда ничего не найти; теперь она берёт по индексу узкое окно и в
-- обычный час не трогает ни одной строки.
ALTER TABLE boards ADD COLUMN IF NOT EXISTS next_deadline TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION set_board_next_deadline() RETURNS TRIGGER AS $$
BEGIN
  SELECT MIN(d) INTO NEW.next_deadline
    FROM (
      SELECT (c->'data'->>'deadline')::timestamptz AS d
        FROM jsonb_array_elements(COALESCE(NEW.data->'cards', '[]'::jsonb)) c
       WHERE c->>'type' = 'assignment'
         AND COALESCE(c->'data'->>'deadline', '') <> ''
    ) x
   WHERE d > NOW();
  RETURN NEW;
EXCEPTION WHEN others THEN
  -- Кривая дата в карточке не должна ронять сохранение доски: учитель потеряет
  -- работу из-за опечатки в поле срока. Напоминание для такой доски пропадёт,
  -- сама доска сохранится.
  NEW.next_deadline := NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_boards_next_deadline ON boards;
CREATE TRIGGER trg_boards_next_deadline
  BEFORE INSERT OR UPDATE OF data ON boards
  FOR EACH ROW EXECUTE FUNCTION set_board_next_deadline();

CREATE INDEX IF NOT EXISTS idx_boards_next_deadline ON boards(next_deadline)
  WHERE next_deadline IS NOT NULL;

-- Разовый добор для досок, сохранённых до появления колонки. schema.sql
-- применяется при КАЖДОМ старте, поэтому добор помечается в schema_meta:
-- иначе каждый перезапуск переписывал бы все доски целиком.
CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, done_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM schema_meta WHERE key = 'boards_next_deadline_backfill') THEN
    UPDATE boards b SET next_deadline = (
      SELECT MIN((c->'data'->>'deadline')::timestamptz)
        FROM jsonb_array_elements(COALESCE(b.data->'cards', '[]'::jsonb)) c
       WHERE c->>'type' = 'assignment'
         AND (c->'data'->>'deadline') ~ '^\d{4}-\d{2}-\d{2}'
    );
    INSERT INTO schema_meta(key) VALUES ('boards_next_deadline_backfill');
  END IF;
END $$;

-- attendance had no uniqueness guard on (journal_id, date): the app's
-- "ON CONFLICT DO NOTHING" insert had no constraint to trigger on, so a
-- double-submit (double-click, retry, two tabs) inserted the same day
-- twice and double-deducted a lesson from lessons_left. Add the missing
-- index so that insert becomes a real no-op on a duplicate. If duplicate
-- rows already exist from before this fix, skip creating the index rather
-- than fail startup - run a manual cleanup pass, then this will apply on
-- the next restart.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_attendance_journal_date_unique') THEN
    CREATE UNIQUE INDEX idx_attendance_journal_date_unique ON attendance(journal_id, date);
  END IF;
EXCEPTION WHEN unique_violation THEN
  RAISE WARNING 'idx_attendance_journal_date_unique not created: attendance has pre-existing duplicate (journal_id, date) rows - clean those up, then restart to apply the constraint';
END $$;

-- ── Desktop personalisation + Student Pulse (23.09.2026) ────────────────────
-- desktop_wallpaper: 'preset:<key>' or 'custom:<file>' (file lives in
-- data/wallpapers, outside backend/, so deploys do not wipe it).
ALTER TABLE users ADD COLUMN IF NOT EXISTS desktop_wallpaper TEXT;
-- payment_due: when the student's next payment is due; overdue = before today.
-- pulse_hidden: alerts the teacher archived, keyed by the exact state
-- ("pkg:2", "pay:2026-09-20"), so an alert comes back when the state changes.
ALTER TABLE student_journal ADD COLUMN IF NOT EXISTS payment_due DATE;
ALTER TABLE student_journal ADD COLUMN IF NOT EXISTS pulse_hidden JSONB NOT NULL DEFAULT '{}';

-- A teacher can invite a student who has no account yet: the invite keeps
-- the board they are joining, and sign-up seats them on it.
ALTER TABLE invites ADD COLUMN IF NOT EXISTS board_id UUID REFERENCES boards(id) ON DELETE CASCADE;
ALTER TABLE invites ADD COLUMN IF NOT EXISTS board_role VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_invites_board_pending ON invites (LOWER(email)) WHERE board_id IS NOT NULL AND accepted_at IS NULL;

-- One reusable join link per board: the teacher sends it anywhere, and
-- whoever opens it and signs in lands on the board as a student.
ALTER TABLE boards ADD COLUMN IF NOT EXISTS join_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_boards_join_token ON boards (join_token) WHERE join_token IS NOT NULL;

-- ── Student setup + booking (24.09.2026) ────────────────────────────────────
-- Students window: the "+" form keeps the teacher's own record of the student
-- (format, contacts) next to level and lesson package in the journal.
ALTER TABLE student_journal ADD COLUMN IF NOT EXISTS format VARCHAR(12);
ALTER TABLE student_journal ADD COLUMN IF NOT EXISTS telegram VARCHAR(64);
ALTER TABLE student_journal ADD COLUMN IF NOT EXISTS phone VARCHAR(32);

-- Weekly availability: 'open' = students may book it through the teacher's
-- booking link, 'busy' = personal time, never offered. Days are 0=Mon like
-- the schedule table; times are in the teacher's own time zone.
CREATE TABLE IF NOT EXISTS schedule_blocks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day        SMALLINT NOT NULL CHECK (day BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time   TIME NOT NULL,
  kind       VARCHAR(8) NOT NULL CHECK (kind IN ('open','busy')),
  label      VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_user ON schedule_blocks(user_id, day);
-- One public booking link per teacher (rotating it kills the old one).
ALTER TABLE users ADD COLUMN IF NOT EXISTS booking_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_booking_token ON users(booking_token) WHERE booking_token IS NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS booking_minutes SMALLINT NOT NULL DEFAULT 60;
-- A class a student booked themselves: who, so the teacher can reach them.
ALTER TABLE schedule ADD COLUMN IF NOT EXISTS booked_by_email VARCHAR(255);
-- One-off classes saved from the week grid were stored a day early for
-- teachers east of UTC (the page built the date with toISOString, which
-- turns local midnight into the previous UTC day). Their `day` column was
-- right, so a date whose weekday is exactly one day before `day` is that bug:
-- move it forward. Idempotent - fixed rows no longer match.
UPDATE schedule SET specific_date = specific_date + 1
 WHERE specific_date IS NOT NULL
   AND (EXTRACT(ISODOW FROM specific_date)::int - 1) = ((day + 6) % 7);

-- ── Нагрузка (24.09.2026) ───────────────────────────────────────────────────
-- «Доски ученика», расписание ученика, ростер, назначение домашки ищут
-- board_collaborators по user_id; первичный ключ (board_id, user_id) для этого
-- не годится - был полный проход таблицы.
CREATE INDEX IF NOT EXISTS idx_board_collab_user ON board_collaborators(user_id);

-- Суточные расходы на AI в долларах: светофор бюджета держал их только в
-- памяти процесса - каждый выкат обнулял счётчик, а при нескольких процессах
-- каждый видел бы лишь свою долю.
ALTER TABLE ai_usage_daily ADD COLUMN IF NOT EXISTS usd NUMERIC(12,6) NOT NULL DEFAULT 0;

-- A teacher's own boards get the same designed cover as Community lessons
-- (backend/lib/cover.js whitelists it); an uploaded photo sits beside it.
ALTER TABLE boards ADD COLUMN IF NOT EXISTS cover JSONB;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS cover_image TEXT;

-- Speaking Studio: a student's spoken answer to one prompt of a card. Audio
-- stays in the database (a minute of Opus is ~300 KB) so backups carry it.
CREATE TABLE IF NOT EXISTS speaking_recordings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  card_id     TEXT NOT NULL,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prompt_idx  INTEGER NOT NULL DEFAULT 0,
  prompt      TEXT NOT NULL DEFAULT '',
  mime        VARCHAR(60) NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  audio       BYTEA NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_speaking_rec_board ON speaking_recordings (board_id, card_id, created_at DESC);
-- The teacher's "Speaking to review" queue (Homework): a recording waits there until it is marked reviewed.
ALTER TABLE speaking_recordings ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_speaking_rec_pending ON speaking_recordings (board_id, created_at DESC) WHERE reviewed_at IS NULL;

-- Studio work: each student's own copy of a lesson path (its step, done
-- marks and every step's answers). The path card on the board holds the
-- lesson itself; with several students on one board each of them works in
-- their own studio, and the teacher opens any of them from the card.
CREATE TABLE IF NOT EXISTS studio_work (
  board_id   UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  card_id    TEXT NOT NULL,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work       JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (board_id, card_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_studio_work_card ON studio_work (board_id, card_id);

-- Student layer: what a student draws, writes and sticks on top of a board
-- they cannot edit (pen strokes, text notes, emoji). One row per student.
CREATE TABLE IF NOT EXISTS student_layer (
  board_id   UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  layer      JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (board_id, user_id)
);

-- ── Writing hand-ins ───────────────────────────────────────────────────────
-- A student hands in a Writing Studio draft; the AI pre-checks it against the
-- lesson's criteria; the board owner reviews, writes feedback, grades and
-- returns it. One row per student per studio card; earlier versions (after a
-- rewrite) are kept in `history` so the class can compare drafts.
CREATE TABLE IF NOT EXISTS writing_submissions (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id      UUID         NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  card_id       TEXT         NOT NULL,
  student_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  teacher_id    UUID                  REFERENCES users(id) ON DELETE SET NULL,
  title         TEXT         NOT NULL DEFAULT '',
  prompt        TEXT         NOT NULL DEFAULT '',
  genre         TEXT         NOT NULL DEFAULT '',
  level         TEXT         NOT NULL DEFAULT '',
  criteria      JSONB        NOT NULL DEFAULT '[]',
  text          TEXT         NOT NULL DEFAULT '',
  html          TEXT         NOT NULL DEFAULT '',
  words         INTEGER      NOT NULL DEFAULT 0,
  target_words  INTEGER      NOT NULL DEFAULT 0,
  -- submitted | returned
  status        VARCHAR(20)  NOT NULL DEFAULT 'submitted',
  -- pending | done | failed
  ai_status     VARCHAR(20)  NOT NULL DEFAULT 'pending',
  ai_check      JSONB,
  feedback      TEXT         NOT NULL DEFAULT '',
  grade         INTEGER,
  scores        JSONB        NOT NULL DEFAULT '[]',
  history       JSONB        NOT NULL DEFAULT '[]',
  submitted_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  returned_at   TIMESTAMPTZ,
  seen_at       TIMESTAMPTZ,
  UNIQUE (board_id, card_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_writing_sub_teacher ON writing_submissions(teacher_id, status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_writing_sub_student ON writing_submissions(student_id, submitted_at DESC);

-- The corrections the teacher kept (and edited, and added) when returning a
-- hand-in. NULL = the teacher has not curated yet: the student never sees the
-- AI's raw list for a hand-in that is still with the teacher.
ALTER TABLE writing_submissions ADD COLUMN IF NOT EXISTS teacher_corrections JSONB;

-- ── The Vault: the student's own words and quotes on a spaced-repetition
-- schedule (backend/lib/srs.js). Existing rows become due at once.
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS kind            VARCHAR(12) NOT NULL DEFAULT 'word';   -- word | quote
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS source_board_id UUID REFERENCES boards(id) ON DELETE SET NULL;
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS source_title    TEXT NOT NULL DEFAULT '';
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS due_at          TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS interval_days   REAL NOT NULL DEFAULT 0;
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS ease            REAL NOT NULL DEFAULT 2.5;
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS reps            INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS lapses          INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ;
ALTER TABLE vocabulary ALTER COLUMN word TYPE VARCHAR(400);
CREATE INDEX IF NOT EXISTS idx_vocabulary_due ON vocabulary(user_id, due_at) WHERE kind = 'word';

-- Vault reminders: once a day at the student's local hour, when words are due.
ALTER TABLE users ADD COLUMN IF NOT EXISTS vault_remind_push  BOOLEAN  NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS vault_remind_email BOOLEAN  NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS vault_remind_hour  SMALLINT NOT NULL DEFAULT 18;
ALTER TABLE users ADD COLUMN IF NOT EXISTS vault_reminded_on  DATE;

-- Email verification, terms consent (2026-09-26). Accounts older than this
-- change are treated as verified: they signed up before it was asked.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at  TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at  TIMESTAMPTZ;
UPDATE users SET email_verified_at = created_at
 WHERE email_verified_at IS NULL AND created_at < '2026-09-26T12:00:00Z';
UPDATE users SET email_verified_at = NOW()
 WHERE email_verified_at IS NULL AND google_id IS NOT NULL;

-- Two-step verification (TOTP), 2026-09-26. totp_secret is set during setup
-- and only counts once totp_enabled_at is set; backup codes are SHA-256.
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret        TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled_at    TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_backup_hashes JSONB NOT NULL DEFAULT '[]';

-- ── Lesson balance driven by the schedule (30.09.2026) ─────────────────────
-- A schedule slot can belong to one journal student; the lesson's outcome is
-- stored per date in attendance (present = completed, cancelled, no_show) and
-- moves lessons_left: present and no_show cost one lesson, cancelled does not.
-- attendance.charged records whether a lesson was really taken off the balance
-- (NULL = rows written before this column existed, which always charged), so
-- changing a status later refunds exactly what was taken.
ALTER TABLE schedule ADD COLUMN IF NOT EXISTS journal_id UUID REFERENCES student_journal(id) ON DELETE SET NULL;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS slot_id UUID;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS charged BOOLEAN;
-- The student says "I paid" (paid_claim_at); the teacher confirms with +pack.
ALTER TABLE student_journal ADD COLUMN IF NOT EXISTS pack_size INTEGER NOT NULL DEFAULT 8;
ALTER TABLE student_journal ADD COLUMN IF NOT EXISTS paid_claim_at TIMESTAMPTZ;
-- Where students send the money (card, IBAN, PayPal...). Free text, shown only
-- to the teacher's own students; the platform never touches the payment.
ALTER TABLE users ADD COLUMN IF NOT EXISTS pay_details TEXT;

-- Progress snapshot: when the current lesson package began (last top-up).
-- NULL = since the student was added.
ALTER TABLE student_journal ADD COLUMN IF NOT EXISTS pack_started_at TIMESTAMPTZ;

-- Student "DNA profile": filled by the student at first sign-in (goal, interests,
-- self-assessed level). Interests drive the news feed for the student and the
-- suggestions the teacher sees.
CREATE TABLE IF NOT EXISTS student_dna (
  user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  goal       VARCHAR(20),
  interests  TEXT[] NOT NULL DEFAULT '{}',
  level      VARCHAR(4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Minutes a day the student plans between lessons (onboarding: 1 / 5 / 15).
ALTER TABLE student_dna ADD COLUMN IF NOT EXISTS daily_minutes SMALLINT;

-- Word Bank, teacher's side and active recall.
-- sent_by: the teacher who put the word there (Lesson pad, homework), so the
-- Homework page can show what was sent and how it is going.
-- collocations / gap: what the review card shows (a sentence with the word
-- taken out on the front, word partnerships on the back).
-- wrong_count / last_wrong: the student types the word in the review; what
-- they typed when it was wrong is what the teacher wants to see.
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS sent_by      UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS collocations TEXT NOT NULL DEFAULT '';
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS gap          TEXT NOT NULL DEFAULT '';
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS wrong_count  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS last_wrong   VARCHAR(200);
CREATE INDEX IF NOT EXISTS idx_vocabulary_sent_by ON vocabulary(sent_by) WHERE sent_by IS NOT NULL;

-- ── Homework review (09.10.2026) ───────────────────────────────────────────
-- The homework card in the student's cabinet follows the assignment: not
-- started → in progress (draft saved, % done) → handed in (waiting for the
-- teacher) → reviewed. feedback_seen_at stays NULL while a published review is
-- still new to the student ("Feedback available"); opening it sets the time.
ALTER TABLE homework_assignment ADD COLUMN IF NOT EXISTS feedback_seen_at TIMESTAMPTZ;
-- Reviews published before the column existed are not news any more.
UPDATE homework_assignment SET feedback_seen_at = graded_at
 WHERE status = 'graded' AND feedback_seen_at IS NULL AND graded_at < '2026-10-09T12:00:00Z';
-- The teacher's spoken feedback: one clip per assignment, kept in the database
-- like speaking_recordings (a minute of Opus is ~300 KB).
CREATE TABLE IF NOT EXISTS homework_feedback_audio (
  assignment_id UUID PRIMARY KEY REFERENCES homework_assignment(id) ON DELETE CASCADE,
  mime          VARCHAR(60) NOT NULL,
  duration_ms   INTEGER NOT NULL DEFAULT 0,
  audio         BYTEA NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Where a word came from (09.10.2026) ────────────────────────────────────
-- source_type: LESSON_BOARD (saved on a board, sent from the Lesson pad),
-- HOMEWORK (saved while doing homework, or the words of an assigned set),
-- PHRASE_OF_THE_DAY, READING (the cabinet's news feed), MANUAL (+ Add word).
-- source_ref_id: the board for LESSON_BOARD, the homework for HOMEWORK.
-- source_board_id stays: the studios look words up by the board they are on.
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS source_type   VARCHAR(20);
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS source_ref_id UUID;
-- Words an assigned homework put into the bank carry the homework's title and
-- board and the teacher who set it.
UPDATE vocabulary v SET source_type = 'HOMEWORK', source_ref_id = h.id
  FROM homework h
 WHERE v.source_type IS NULL AND v.sent_by = h.user_id AND v.source_board_id = h.board_id AND v.source_title = h.title;
UPDATE vocabulary SET source_type = CASE WHEN source_board_id IS NOT NULL OR sent_by IS NOT NULL THEN 'LESSON_BOARD' ELSE 'MANUAL' END,
       source_ref_id = source_board_id
 WHERE source_type IS NULL;
ALTER TABLE vocabulary ALTER COLUMN source_type SET DEFAULT 'MANUAL';
CREATE INDEX IF NOT EXISTS idx_vocabulary_source ON vocabulary(user_id, source_type, created_at DESC) WHERE kind = 'word';

-- ── Lesson balance: who changed it and why (09.10.2026) ────────────────────
-- attendance.charged already said whether a lesson came off the balance; the
-- teacher now chooses it (a trial or make-up lesson held for free, a late
-- cancellation that still costs one). Every change of lessons_left lands in
-- balance_ledger, so the teacher and the student see why the number is what
-- it is. reason: lesson | refund | pack | manual.
CREATE TABLE IF NOT EXISTS balance_ledger (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id    UUID NOT NULL REFERENCES student_journal(id) ON DELETE CASCADE,
  teacher_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  delta         INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reason        VARCHAR(12) NOT NULL,
  lesson_date   DATE,
  note          VARCHAR(200),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_balance_ledger_journal ON balance_ledger(journal_id, created_at DESC);

-- ── The student's own board (09.10.2026) ───────────────────────────────────
-- "Open my board" and "Join lesson" open one board per student and teacher,
-- the one the teacher keeps the lessons on. Before, the cabinet took whichever
-- shared board was saved last, so the link moved every time a board changed.
-- One per teacher is kept by the route that sets it (PUT /api/members/home-board).
ALTER TABLE board_collaborators ADD COLUMN IF NOT EXISTS is_home BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_board_collab_home ON board_collaborators(user_id) WHERE is_home;

-- ── Trial students (09.10.2026) ────────────────────────────────────────────
-- A newcomer on a free first lesson has 0 lessons and no package. While
-- is_trial is on, the cabinet shows "Free trial session" instead of a red
-- "0 left / Renew", a held lesson is free unless the teacher says otherwise,
-- and the Pulse does not nag about the balance. The first package turns it off.
ALTER TABLE student_journal ADD COLUMN IF NOT EXISTS is_trial BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Teacher onboarding (10.10.2026) ─────────────────────────────────────────
-- What the teacher teaches (onboarding step 2), the reschedule rule (step 4)
-- and when the setup was finished (NULL = never shown or skipped mid-way).
ALTER TABLE users ADD COLUMN IF NOT EXISTS teach_levels JSONB NOT NULL DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS teach_focus  JSONB NOT NULL DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS reschedule_notice_hours SMALLINT NOT NULL DEFAULT 24;
ALTER TABLE users ADD COLUMN IF NOT EXISTS late_cancel_deduct BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;
-- A board made for one journal student (onboarding step 5): whoever joins it
-- through its link becomes that journal entry's account (student_id), so the
-- level, package and balance the teacher typed follow the real student.
ALTER TABLE boards ADD COLUMN IF NOT EXISTS journal_id UUID REFERENCES student_journal(id) ON DELETE SET NULL;

-- ── Lesson reminders (10.10.2026) ───────────────────────────────────────────
-- "Lesson in an hour": one row per schedule slot and start time, so the job
-- (jobs/lessonReminders.js, every 5 minutes) never sends the same one twice,
-- whatever the process restarts.
CREATE TABLE IF NOT EXISTS lesson_reminders (
  schedule_id UUID        NOT NULL REFERENCES schedule(id) ON DELETE CASCADE,
  starts_at   TIMESTAMPTZ NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (schedule_id, starts_at)
);

-- Student pulse, 15.10.2026: a reminder no longer hides the signal. The card
-- waits ("Reminder sent 2 days ago") until the student pays or the teacher
-- archives it, and lights up again when the next lesson is close.
--   pulse_reminded: { "<signal key>": "<when the reminder went out>" }
--   pulse_snooze:   { "<signal key>": "<hidden until>" }  (Archive for today)
ALTER TABLE student_journal ADD COLUMN IF NOT EXISTS pulse_reminded JSONB NOT NULL DEFAULT '{}';
ALTER TABLE student_journal ADD COLUMN IF NOT EXISTS pulse_snooze JSONB NOT NULL DEFAULT '{}';
-- This week widget: { goal: lessons a day, price: per lesson, currency }
ALTER TABLE users ADD COLUMN IF NOT EXISTS week_prefs JSONB NOT NULL DEFAULT '{}';

-- ── Group lessons (15.10.2026) ─────────────────────────────────────────────
-- A schedule slot used to know at most one student (schedule.journal_id); a
-- group lesson was only a name (group_name), so the desktop could not say who
-- is in it. schedule_members lists the Journal students of a slot. The
-- teacher picks them on the desktop (Schedule → the group's name); until then
-- the students already seated on the lesson's board are suggested.
CREATE TABLE IF NOT EXISTS schedule_members (
  schedule_id UUID        NOT NULL REFERENCES schedule(id) ON DELETE CASCADE,
  journal_id  UUID        NOT NULL REFERENCES student_journal(id) ON DELETE CASCADE,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (schedule_id, journal_id)
);
CREATE INDEX IF NOT EXISTS idx_schedule_members_journal ON schedule_members(journal_id);

-- ── Breaks between lessons (16.10.2026) ────────────────────────────────────
-- buffer_minutes: the teacher's rest after every lesson (0, 5, 10 or 15). The
-- week grid draws it as "10m Rest"; booking never offers a start inside it
-- (a lesson 11:00-12:00 with 10 min → the next bookable start is 12:10).
ALTER TABLE users ADD COLUMN IF NOT EXISTS buffer_minutes SMALLINT NOT NULL DEFAULT 0;

-- Who cancelled (16.10.2026): a lesson the student cancelled from the cabinet
-- puts them at the top of the teacher's student list ("find a new time")
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS student_cancelled_at TIMESTAMPTZ;

-- ── Community: likes, bookmarks, copies, reports, versions (16.10.2026) ─────
-- A copy is the copier's own: a new board or a frame on a student's board.
-- The author deleting or changing the original never touches it; when the
-- author publishes an update (content_updated_at), copies made before it see
-- "Updated version available".
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS content_updated_at TIMESTAMPTZ;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS library_likes (
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (assignment_id, user_id)
);
CREATE TABLE IF NOT EXISTS library_saves (
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (assignment_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_library_saves_user ON library_saves(user_id, created_at DESC);
-- the source may be deleted; the copy (board) stays, so no cascade on it
CREATE TABLE IF NOT EXISTS library_copies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES assignments(id) ON DELETE SET NULL,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  board_id      UUID REFERENCES boards(id) ON DELETE SET NULL,
  frame_id      TEXT,
  target        VARCHAR(12) NOT NULL DEFAULT 'board',   -- board | student
  title         VARCHAR(255) NOT NULL DEFAULT '',
  author_name   VARCHAR(255) NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_library_copies_user ON library_copies(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS library_reports (
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason        VARCHAR(24) NOT NULL DEFAULT 'other',
  note          VARCHAR(500) NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (assignment_id, user_id)
);

-- ── Teacher onboarding v2 (16.10.2026) ──────────────────────────────────────
-- Server-side state of the managed first run (lib/teacherOnboarding.js): one
-- row per teacher, resumed on any device. Created lazily, only for accounts the
-- feature flag covers; accounts without a row are never shown a forced modal.
-- A practice board is a sandbox: it never counts toward the plan's board limit
-- and the board list does not show it.
ALTER TABLE boards ADD COLUMN IF NOT EXISTS is_practice BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE IF NOT EXISTS teacher_onboarding (
  user_id            UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  version            SMALLINT    NOT NULL DEFAULT 1,
  status             VARCHAR(16) NOT NULL DEFAULT 'not_started'
                     CHECK (status IN ('not_started','in_progress','core_completed','dismissed')),
  current_step       VARCHAR(16) CHECK (current_step IN ('welcome','practice','board','preview','plan')),
  completed_steps    TEXT[]      NOT NULL DEFAULT '{}',
  checklist          JSONB       NOT NULL DEFAULT '{}',
  -- no FK: deleting either board must not touch the onboarding row (spec: it
  -- only clears the link), and the service treats a missing board as "none"
  practice_board_id  UUID,
  first_board_id     UUID,
  entry_point        VARCHAR(16),
  started_at         TIMESTAMPTZ,
  core_completed_at  TIMESTAMPTZ,
  welcome_viewed_at  TIMESTAMPTZ,
  closed_at          TIMESTAMPTZ,
  checklist_collapsed BOOLEAN    NOT NULL DEFAULT FALSE,
  checklist_hidden    BOOLEAN    NOT NULL DEFAULT FALSE,
  emitted            TEXT[]      NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE teacher_onboarding ALTER COLUMN current_step SET DEFAULT 'welcome';
-- one-time contextual tips already shown (Phase 3); server-side, so a second device does not repeat them
ALTER TABLE teacher_onboarding ADD COLUMN IF NOT EXISTS tips_seen TEXT[] NOT NULL DEFAULT '{}';

-- ── Community: trust, honest signals, verified use, remixes, requests (16.10.2026) ──
-- See "Community: involvement, trust and growth" (ТЗ v1.0). A copy is the copier's
-- own; counters are unique accounts; "Used in class" is a server-side fact
-- (a launched lesson), never a click.
ALTER TABLE users ADD COLUMN IF NOT EXISTS community_team BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS community_bio  VARCHAR(400) NOT NULL DEFAULT '';

ALTER TABLE assignments ADD COLUMN IF NOT EXISTS moderation_state VARCHAR(16) NOT NULL DEFAULT 'published';
  -- published | review_pending (3 reports) | hidden (5 / critical, until a moderator decides)
  -- | needs_changes | removed
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS allow_remix BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS editorial BOOLEAN NOT NULL DEFAULT FALSE;   -- Editor's pick: a human choice
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS first_public_at TIMESTAMPTZ;                -- "New" counts 14 days from here
UPDATE assignments SET first_public_at = published_at WHERE first_public_at IS NULL AND published_at IS NOT NULL;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS version_no INTEGER NOT NULL DEFAULT 1;
-- paid-ready fields (no checkout yet): the preview is configured, not hard-coded
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS access_type  VARCHAR(8)  NOT NULL DEFAULT 'free';    -- free | paid
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS preview_mode VARCHAR(8)  NOT NULL DEFAULT 'full';    -- full | sample | timed
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS preview_item_ids JSONB   NOT NULL DEFAULT '[]';
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS license_type VARCHAR(24) NOT NULL DEFAULT 'free_use';
-- a remix keeps where it came from: text attribution survives the original
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS remix_of UUID REFERENCES assignments(id) ON DELETE SET NULL;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS remix_of_title  VARCHAR(255);
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS remix_of_author VARCHAR(255);
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS remix_of_author_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS remix_of_version_id UUID;
CREATE INDEX IF NOT EXISTS idx_assignments_remix_of ON assignments(remix_of) WHERE remix_of IS NOT NULL;

CREATE TABLE IF NOT EXISTS publication_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  version_no    INTEGER NOT NULL,
  title         VARCHAR(255) NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assignment_id, version_no)
);
INSERT INTO publication_versions (assignment_id, version_no, title, created_at)
  SELECT id, 1, title, COALESCE(published_at, created_at) FROM assignments WHERE visibility IN ('community','unlisted')
  ON CONFLICT DO NOTHING;

-- later: who may open a paid resource in full (purchase and checkout are not built yet)
CREATE TABLE IF NOT EXISTS entitlements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  version_scope VARCHAR(12) NOT NULL DEFAULT 'all',
  license_type  VARCHAR(24) NOT NULL DEFAULT 'single_teacher',
  status        VARCHAR(12) NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_entitlements_user ON entitlements(user_id, assignment_id);

-- copies: where it came from, which version, which cards are the copy's own
ALTER TABLE library_copies ADD COLUMN IF NOT EXISTS source_version_id UUID;
ALTER TABLE library_copies ADD COLUMN IF NOT EXISTS card_ids JSONB NOT NULL DEFAULT '[]';
ALTER TABLE library_copies ADD COLUMN IF NOT EXISTS undone_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_library_copies_board ON library_copies(board_id) WHERE board_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_library_copies_assignment ON library_copies(assignment_id, user_id);

-- reports: category, severity, which case, what came of it
ALTER TABLE library_reports ADD COLUMN IF NOT EXISTS severity VARCHAR(8) NOT NULL DEFAULT 'normal';  -- normal | critical
ALTER TABLE library_reports ADD COLUMN IF NOT EXISTS case_id UUID;
ALTER TABLE library_reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE library_reports ADD COLUMN IF NOT EXISTS counts BOOLEAN NOT NULL DEFAULT TRUE;           -- false: a new or low-trust account does not move the thresholds
ALTER TABLE library_reports ADD COLUMN IF NOT EXISTS outcome VARCHAR(12);                            -- null | upheld | rejected
ALTER TABLE library_reports ALTER COLUMN reason TYPE VARCHAR(32);
CREATE INDEX IF NOT EXISTS idx_library_reports_user ON library_reports(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS moderation_cases (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES assignments(id) ON DELETE SET NULL,
  author_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  version_no    INTEGER,
  status        VARCHAR(12) NOT NULL DEFAULT 'open',      -- open | in_review | resolved
  risk_level    VARCHAR(8)  NOT NULL DEFAULT 'normal',    -- normal | critical
  decision      VARCHAR(16),                               -- no_violation | needs_changes | remove
  decision_note TEXT NOT NULL DEFAULT '',
  required_changes TEXT NOT NULL DEFAULT '',
  -- the publication as it was when it was reported: the author editing the
  -- original must not change what is being reviewed
  snapshot      JSONB NOT NULL DEFAULT '{}',
  opened_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at    TIMESTAMPTZ,
  decided_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  appeal_until  TIMESTAMPTZ,
  resubmitted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_open ON moderation_cases(status, opened_at) WHERE status <> 'resolved';
CREATE INDEX IF NOT EXISTS idx_moderation_cases_assignment ON moderation_cases(assignment_id, opened_at DESC);
CREATE TABLE IF NOT EXISTS moderation_appeals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id       UUID NOT NULL UNIQUE REFERENCES moderation_cases(id) ON DELETE CASCADE,   -- one appeal per decision
  author_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message       TEXT NOT NULL,
  evidence      TEXT NOT NULL DEFAULT '',
  status        VARCHAR(12) NOT NULL DEFAULT 'pending',   -- pending | upheld | overturned
  resolution_note TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at   TIMESTAMPTZ,
  resolved_by   UUID REFERENCES users(id) ON DELETE SET NULL
);

-- lessons that really ran: the teacher and at least one student on the board together
CREATE TABLE IF NOT EXISTS lesson_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id      UUID REFERENCES boards(id) ON DELETE SET NULL,
  teacher_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at      TIMESTAMPTZ,
  student_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_lesson_sessions_teacher ON lesson_sessions(teacher_id, started_at DESC);
CREATE TABLE IF NOT EXISTS verified_uses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  source_version_id UUID,
  teacher_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_session_id UUID NOT NULL REFERENCES lesson_sessions(id) ON DELETE CASCADE,
  board_id      UUID,
  used_on       DATE NOT NULL DEFAULT CURRENT_DATE,
  evidence_type VARCHAR(16) NOT NULL DEFAULT 'shown',     -- shown (time on screen) | student_action
  content_type  VARCHAR(16) NOT NULL DEFAULT 'board',
  student_count INTEGER NOT NULL DEFAULT 0,
  rating        VARCHAR(16),                               -- worked_well | needs_adjustment; skip stays null
  feedback_at   TIMESTAMPTZ,
  feedback_skipped_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- one publication counts once per lesson, and a teacher cannot add the same
  -- material to the same board more than once a day
  UNIQUE (assignment_id, lesson_session_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_verified_uses_day ON verified_uses(assignment_id, teacher_id, board_id, used_on);
CREATE INDEX IF NOT EXISTS idx_verified_uses_assignment ON verified_uses(assignment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verified_uses_teacher ON verified_uses(teacher_id, created_at DESC);

-- requests born from a weak search
CREATE TABLE IF NOT EXISTS resource_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query         VARCHAR(200) NOT NULL,
  filters       JSONB NOT NULL DEFAULT '{}',              -- language, level, age, skill
  format        VARCHAR(8) NOT NULL DEFAULT 'any',        -- space | studio | game | any
  details       VARCHAR(1000) NOT NULL DEFAULT '',
  needed_by     DATE,
  status        VARCHAR(12) NOT NULL DEFAULT 'open',      -- open | fulfilled | closed | expired
  closed_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_resource_requests_open ON resource_requests(status, created_at DESC);
CREATE TABLE IF NOT EXISTS request_votes (
  request_id UUID NOT NULL REFERENCES resource_requests(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (request_id, user_id)
);
CREATE TABLE IF NOT EXISTS request_answers (       -- an answer always carries a resource
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    UUID NOT NULL REFERENCES resource_requests(id) ON DELETE CASCADE,
  author_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  helpful       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (request_id, assignment_id)
);

-- collections and curators
CREATE TABLE IF NOT EXISTS collections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(120) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  is_public   BOOLEAN NOT NULL DEFAULT TRUE,
  editorial   BOOLEAN NOT NULL DEFAULT FALSE,           -- chosen by the TeachEd Team
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_collections_owner ON collections(owner_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS collection_items (
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  position      INTEGER NOT NULL DEFAULT 0,
  added_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (collection_id, assignment_id)
);
CREATE TABLE IF NOT EXISTS curator_follows (
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  curator_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, curator_id),
  CHECK (follower_id <> curator_id)
);

-- the teacher's own steering of recommendations: "Not relevant", "Show fewer like this"
CREATE TABLE IF NOT EXISTS community_signals (
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  kind          VARCHAR(16) NOT NULL,                    -- not_relevant | fewer_like_this
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, assignment_id, kind)
);

-- the author's notification choices; the digest is in-app, once a week, by default
CREATE TABLE IF NOT EXISTS community_prefs (
  user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  digest        VARCHAR(8) NOT NULL DEFAULT 'weekly',    -- weekly | off
  email_digest  BOOLEAN NOT NULL DEFAULT FALSE,
  email_requests BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- what was already said, so a milestone or a week's digest is never repeated
CREATE TABLE IF NOT EXISTS community_notices (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       VARCHAR(24) NOT NULL,
  key        VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, kind, key)
);

-- product analytics (an allow-list of names; never student names or board titles)
CREATE TABLE IF NOT EXISTS community_events (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  event       VARCHAR(32) NOT NULL,
  assignment_id UUID,
  props       JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_community_events_event ON community_events(event, created_at DESC);
ALTER TABLE library_copies ADD COLUMN IF NOT EXISTS arrow_ids JSONB NOT NULL DEFAULT '[]';
ALTER TABLE library_reports ADD COLUMN IF NOT EXISTS version_no INTEGER;
ALTER TABLE lesson_sessions ADD COLUMN IF NOT EXISTS students UUID[] NOT NULL DEFAULT '{}';          -- who was there (counted, never shown)
ALTER TABLE users ADD COLUMN IF NOT EXISTS community_publish_blocked BOOLEAN NOT NULL DEFAULT FALSE;  -- after repeated violations

-- Guardrails (Lesson Builder 2.0, E1): how often the generate -> check -> draft contour stepped in.
-- Counts only, per skill and tool, against the descriptor bank version it ran with.
CREATE TABLE IF NOT EXISTS guardrail_daily (
  day               DATE         NOT NULL,
  skill             VARCHAR(24)  NOT NULL,
  tool_id           VARCHAR(80)  NOT NULL,
  bank_version      VARCHAR(40)  NOT NULL DEFAULT 'none',
  generations       INTEGER      NOT NULL DEFAULT 0,
  first_pass_failed INTEGER      NOT NULL DEFAULT 0,   -- the first draft did not pass its own checks
  regenerated       INTEGER      NOT NULL DEFAULT 0,   -- and a later one did
  check_me          INTEGER      NOT NULL DEFAULT 0,   -- none did: the teacher got a "check me"
  unverified        INTEGER      NOT NULL DEFAULT 0,   -- the second reading could not run
  PRIMARY KEY (day, skill, tool_id, bank_version)
);

-- Parental consent (Lesson Builder 2.0 E5 T-PR1). A student the teacher marks as a minor
-- is not sent to the outside language model until the teacher records that a parent or
-- guardian agreed. The record is the teacher's: who agreed and when, nothing more.
ALTER TABLE student_journal ADD COLUMN IF NOT EXISTS minor            BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE student_journal ADD COLUMN IF NOT EXISTS guardian_name    VARCHAR(120);
ALTER TABLE student_journal ADD COLUMN IF NOT EXISTS guardian_contact VARCHAR(160);
ALTER TABLE student_journal ADD COLUMN IF NOT EXISTS consent_at       TIMESTAMPTZ;

-- Student cabinet bugfix (17.10.2026, BUG-02). A lesson with a used-up package is not
-- "on" until the teacher says so: one row per journal student and lesson date (the
-- teacher's local date, as in attendance). The student's "Ask to renew" is rate-limited
-- by renew_asked_at.
CREATE TABLE IF NOT EXISTS lesson_confirmations (
  journal_id  UUID        NOT NULL REFERENCES student_journal(id) ON DELETE CASCADE,
  date        DATE        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (journal_id, date)
);
ALTER TABLE student_journal ADD COLUMN IF NOT EXISTS renew_asked_at TIMESTAMPTZ;
-- BUG-27: the student's own weekly goal for new words (5 / 10 / 20 / 30), shown on the Word Bank card
ALTER TABLE users ADD COLUMN IF NOT EXISTS word_goal SMALLINT NOT NULL DEFAULT 20;
-- BUG-24: review reminders are opt-in. Off by default; they go out only after the
-- student chose (vault_remind_chosen_at), never because a default said so.
ALTER TABLE users ALTER COLUMN vault_remind_push SET DEFAULT FALSE;
ALTER TABLE users ALTER COLUMN vault_remind_email SET DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS vault_remind_chosen_at TIMESTAMPTZ;

-- ── Public SEO pages of Community (17.10.2026) ──────────────────────────────
-- /community/resources/{slug}/: the slug is made once, at the first public
-- moment, and never follows a renamed title.
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS slug VARCHAR(90);
CREATE UNIQUE INDEX IF NOT EXISTS uq_assignments_slug ON assignments(slug) WHERE slug IS NOT NULL;
-- a deleted resource answers 410 (not 404) at its old address; a successor, when the
-- author names one, answers 301
CREATE TABLE IF NOT EXISTS public_tombstones (
  slug           VARCHAR(90) PRIMARY KEY,
  successor_slug VARCHAR(90),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- a guest's "Report this resource": into the same moderation queue, but it never
-- moves the automatic thresholds (those count signed-in teachers only)
CREATE TABLE IF NOT EXISTS public_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  case_id       UUID REFERENCES moderation_cases(id) ON DELETE SET NULL,
  reason        VARCHAR(32) NOT NULL DEFAULT 'other',
  note          VARCHAR(500) NOT NULL DEFAULT '',
  who           VARCHAR(64) NOT NULL DEFAULT '',     -- a salted hash of the address, for the rate limit only
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_public_reports_who ON public_reports(who, created_at DESC);

-- ── TeachEd memory (17.10.2026, "Память TeachEd" ТЗ, part 1) ────────────────
-- The server is the source of truth; the browser keeps a cache and an offline
-- queue. Every field carries its own time, so edits from two devices merge field
-- by field instead of "whoever saved last wins".
CREATE TABLE IF NOT EXISTS teacher_memory (
  teacher_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  style            JSONB NOT NULL DEFAULT '{}',
  style_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version          BIGINT NOT NULL DEFAULT 1,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- One dossier per student of the teacher, keyed by the journal row: a student
-- added by email who has no account yet has a dossier too. No foreign key to the
-- journal on purpose - deleting a student will archive the dossier (part 3), not
-- drop it; until then a dossier whose journal row is gone is never served and is
-- reported as revoked by /api/memory/sync.
CREATE TABLE IF NOT EXISTS student_dossier (
  journal_id            UUID PRIMARY KEY,
  teacher_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interests             TEXT NOT NULL DEFAULT '',
  interests_updated_at  TIMESTAMPTZ NOT NULL DEFAULT 'epoch',
  weak_spots            TEXT NOT NULL DEFAULT '',
  weak_spots_updated_at TIMESTAMPTZ NOT NULL DEFAULT 'epoch',
  common_mistakes       JSONB NOT NULL DEFAULT '[]',
  mistakes_updated_at   TIMESTAMPTZ NOT NULL DEFAULT 'epoch',
  goals                 TEXT NOT NULL DEFAULT '',
  goals_updated_at      TIMESTAMPTZ NOT NULL DEFAULT 'epoch',
  notes                 TEXT NOT NULL DEFAULT '',
  notes_updated_at      TIMESTAMPTZ NOT NULL DEFAULT 'epoch',
  weak_spot_tags        JSONB NOT NULL DEFAULT '[]',
  deleted_tag_keys      JSONB NOT NULL DEFAULT '[]',
  tags_updated_at       TIMESTAMPTZ NOT NULL DEFAULT 'epoch',
  archived_at           TIMESTAMPTZ,
  version               BIGINT NOT NULL DEFAULT 1,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dossier_teacher_updated ON student_dossier(teacher_id, updated_at);

-- ── TeachEd memory, part 3: the 12-month archive (ТЗ §8.3, 18.10.2026) ───────
-- Deleting a student archives their dossier: gone from every screen and every
-- read, kept for 12 months so that re-adding the same student (same account) can
-- bring it back. Erasing a student's data, or the student deleting their own
-- account, removes it at once. The snapshot columns name the student in the
-- archive list, since their journal row is gone.
ALTER TABLE student_dossier ADD COLUMN IF NOT EXISTS archived_name       VARCHAR(255);
ALTER TABLE student_dossier ADD COLUMN IF NOT EXISTS archived_email      VARCHAR(255);
ALTER TABLE student_dossier ADD COLUMN IF NOT EXISTS student_user_id     UUID;
ALTER TABLE student_dossier ADD COLUMN IF NOT EXISTS restore_declined_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_dossier_archived ON student_dossier(archived_at) WHERE archived_at IS NOT NULL;
-- dossiers that left the teacher for good (deleted from the archive, erased):
-- every device of the teacher drops its copy at the next sync
CREATE TABLE IF NOT EXISTS memory_revocations (
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  journal_id UUID NOT NULL,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (teacher_id, journal_id)
);
CREATE OR REPLACE FUNCTION archive_student_dossier() RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('teached.dossier_erase', true) = 'on' THEN
    DELETE FROM student_dossier WHERE journal_id = OLD.id;
    INSERT INTO memory_revocations (teacher_id, journal_id)
      SELECT OLD.teacher_id, OLD.id WHERE EXISTS (SELECT 1 FROM users WHERE id = OLD.teacher_id)
      ON CONFLICT (teacher_id, journal_id) DO UPDATE SET revoked_at = NOW();
  ELSE
    UPDATE student_dossier
       SET archived_at = COALESCE(archived_at, NOW()), archived_name = OLD.name, archived_email = OLD.email,
           student_user_id = OLD.student_id, version = version + 1, updated_at = NOW()
     WHERE journal_id = OLD.id AND teacher_id = OLD.teacher_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_journal_dossier_archive ON student_journal;
CREATE TRIGGER trg_journal_dossier_archive
  BEFORE DELETE ON student_journal
  FOR EACH ROW EXECUTE FUNCTION archive_student_dossier();
-- dossiers whose student was deleted before this trigger existed: archived now
UPDATE student_dossier d SET archived_at = NOW(), version = version + 1, updated_at = NOW()
 WHERE d.archived_at IS NULL AND NOT EXISTS (SELECT 1 FROM student_journal j WHERE j.id = d.journal_id);

-- ── TeachEd memory, part 4: handing a dossier over (ТЗ §8.1, 18.10.2026) ─────
-- A dossier always has one owner. Handing it over moves it whole to another
-- teacher (by email for now - there is no school model yet); the previous owner
-- loses it at once. No shared access, ever. The student is not told.
ALTER TABLE student_dossier ADD COLUMN IF NOT EXISTS handed_from UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE student_dossier ADD COLUMN IF NOT EXISTS handed_at   TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS dossier_handover_log (
  id              BIGSERIAL PRIMARY KEY,
  journal_id      UUID NOT NULL,           -- the dossier's key at the sender
  student_user_id UUID,                    -- the student's account, when they have one
  from_teacher    UUID NOT NULL,
  to_teacher      UUID NOT NULL,
  initiated_by    TEXT NOT NULL DEFAULT 'teacher' CHECK (initiated_by IN ('teacher', 'school_admin')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_handover_from ON dossier_handover_log(from_teacher, created_at DESC);

-- ── TeachEd memory: hand-over cards (ТЗ §8.1, 18.10.2026) ─────────────────────
-- A summary the teacher writes for a colleague: the level, goals, weak spots and
-- only the notes they chose. It is not the dossier and opens nothing else; only
-- the receiver reads it.
CREATE TABLE IF NOT EXISTS transfer_cards (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_teacher UUID REFERENCES users(id) ON DELETE SET NULL,
  to_teacher   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_name VARCHAR(255) NOT NULL DEFAULT '',
  payload      JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_transfer_cards_to ON transfer_cards(to_teacher, created_at DESC);

-- ── Schools (18.10.2026): the organisation behind hand-over (ТЗ «Память» §8.1) ─
-- A teacher creates a school and is its admin; other teachers join by the admin's
-- invitation by email, which they accept. A teacher is in one school at most.
CREATE TABLE IF NOT EXISTS schools (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(120) NOT NULL,
  owner_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS school_members (
  user_id   UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,   -- one school per teacher
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  role      VARCHAR(10) NOT NULL DEFAULT 'teacher' CHECK (role IN ('admin', 'teacher')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_school_members_school ON school_members(school_id);
CREATE TABLE IF NOT EXISTS school_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  email       VARCHAR(255) NOT NULL,
  invited_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answered_at TIMESTAMPTZ,
  accepted    BOOLEAN
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_school_invite_open ON school_invites(school_id, LOWER(email)) WHERE answered_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_school_invites_email ON school_invites(LOWER(email)) WHERE answered_at IS NULL;

-- Boards window (ТЗ «Навигация и расписание» §2, 17.10.2026): a teacher stars boards, archives them
-- instead of deleting (students keep their access) and deletes into a Trash that keeps a board for
-- 30 days (jobs/housekeeping.js) before it is gone for good.
ALTER TABLE boards ADD COLUMN IF NOT EXISTS starred     BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS trashed_at  TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_boards_trashed ON boards(trashed_at) WHERE trashed_at IS NOT NULL;

-- Where the student lives (the Journal card): the World map background puts a pin there.
ALTER TABLE student_journal ADD COLUMN IF NOT EXISTS country VARCHAR(48);
ALTER TABLE student_journal ADD COLUMN IF NOT EXISTS city VARCHAR(80);
-- The World map background: the countries the teacher has marked as visited.
ALTER TABLE users ADD COLUMN IF NOT EXISTS world_visited JSONB NOT NULL DEFAULT '[]';

-- Boards list: when the teacher last opened a board and where its lesson stands
-- ("5 of 9 steps done"), kept beside the board so the list never unpacks the canvas.
ALTER TABLE boards ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMPTZ;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS progress JSONB;

-- Watch & Read fills itself (island TZ §1): pieces the platform builds for a level and an interest
-- (source = 'auto', no teacher), what a student dismissed, and how each interest is scoring for them.
ALTER TABLE hub_materials ALTER COLUMN teacher_id DROP NOT NULL;
ALTER TABLE hub_materials ADD COLUMN IF NOT EXISTS source VARCHAR(8) NOT NULL DEFAULT 'teacher';
ALTER TABLE hub_materials ADD COLUMN IF NOT EXISTS interest VARCHAR(20);
ALTER TABLE hub_materials ADD COLUMN IF NOT EXISTS origin_url TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_hub_materials_origin ON hub_materials(origin_url) WHERE origin_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hub_materials_auto ON hub_materials(level, interest, created_at DESC) WHERE source = 'auto';
CREATE TABLE IF NOT EXISTS hub_dismissed (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES hub_materials(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, material_id)
);
CREATE TABLE IF NOT EXISTS hub_feed_scores (
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interest VARCHAR(20) NOT NULL,
  score    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, interest)
);

-- Student hub island §3: friends by invitation only (no open catalogue), shared links for sets and progress.
CREATE TABLE IF NOT EXISTS friend_invites (
  code       VARCHAR(12) PRIMARY KEY,
  inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uses       INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_friend_invites_inviter ON friend_invites(inviter_id);
CREATE TABLE IF NOT EXISTS friendships (
  a_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  b_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,   -- a_id < b_id, always
  via_code   VARCHAR(12),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (a_id, b_id),
  CHECK (a_id < b_id)
);
CREATE INDEX IF NOT EXISTS idx_friendships_b ON friendships(b_id);
CREATE TABLE IF NOT EXISTS hub_shares (
  token      VARCHAR(16) PRIMARY KEY,
  owner_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       VARCHAR(10) NOT NULL,                     -- set | progress
  payload    JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hub_shares_owner ON hub_shares(owner_id, created_at DESC);
-- A duel invite closed with one tap is closed for good.
ALTER TABLE duels ADD COLUMN IF NOT EXISTS hidden_for UUID[] NOT NULL DEFAULT '{}';

-- Board assistant gap log (ТЗ «Board Assistant как агент» §8): a request the assistant had no tool for. Developers read it to decide the next tool.
CREATE TABLE IF NOT EXISTS board_agent_gaps (
  id         BIGSERIAL PRIMARY KEY,
  teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  tool       VARCHAR(60) NOT NULL,
  closest    TEXT NOT NULL DEFAULT '',
  command    TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_board_agent_gaps_tool ON board_agent_gaps(tool, created_at DESC);

-- Share cards (ТЗ «Шеринг-карточки» FINAL 1.0): one row per card someone shared. The snapshot is what the
-- recipient's page shows - built on the server from the type's white list only, frozen at creation.
CREATE TABLE IF NOT EXISTS share_cards (
  code        VARCHAR(16) PRIMARY KEY,
  owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        VARCHAR(20) NOT NULL,
  mode        VARCHAR(8)  NOT NULL DEFAULT 'brag',      -- invite | brag
  ref         TEXT,                                      -- the duel, the lesson ... the card is about
  snapshot    JSONB NOT NULL DEFAULT '{}'::jsonb,
  frame       VARCHAR(24),                               -- seasonalFrame (decor), null = none
  views       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_share_cards_owner ON share_cards(owner_id, created_at DESC);
