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

-- ── Sessions (refresh tokens) ───────────────────────────────────────────────
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
