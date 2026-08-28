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

CREATE INDEX IF NOT EXISTS idx_sessions_token   ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

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
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shared_materials_owner ON shared_materials(owner_id, created_at DESC);

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

-- ── Подготовка к нагрузке ────────────────────────────────────────────────────
-- Размер доски хранится рядом с доской. Раньше лимит хранилища считался на
-- каждом автосохранении запросом SUM(pg_column_size(data)) по всем доскам
-- учителя: Postgres поднимал из TOAST и распаковывал КАЖДУЮ доску, чтобы
-- узнать её размер. При пятидесяти досках это десятки мегабайт чтения на
-- одно нажатие «сохранить» - незаметно на одном учителе и смертельно на ста.
ALTER TABLE boards ADD COLUMN IF NOT EXISTS data_bytes INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION set_board_data_bytes() RETURNS TRIGGER AS $$
BEGIN
  NEW.data_bytes := pg_column_size(NEW.data);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_boards_data_bytes ON boards;
CREATE TRIGGER trg_boards_data_bytes
  BEFORE INSERT OR UPDATE OF data ON boards
  FOR EACH ROW EXECUTE FUNCTION set_board_data_bytes();

-- Разовый добор для досок, созданных до появления колонки.
UPDATE boards SET data_bytes = pg_column_size(data) WHERE data_bytes = 0;

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
