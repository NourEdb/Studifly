CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT        NOT NULL UNIQUE,
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS courses (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  color      TEXT        NOT NULL DEFAULT '#6C4DC4',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id     INTEGER     REFERENCES courses(id) ON DELETE SET NULL,
  name          TEXT        NOT NULL,
  activity_type TEXT        NOT NULL CHECK (activity_type IN ('reading','practice','watching','other')),
  planned_time  INTEGER     NOT NULL DEFAULT 0,
  due_date      TEXT,
  status        TEXT        NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','in_progress','completed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS study_sessions (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id    INTEGER     REFERENCES tasks(id) ON DELETE SET NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time   TIMESTAMPTZ,
  duration   INTEGER,
  is_manual  SMALLINT    NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_courses_user   ON courses(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user     ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_course   ON tasks(course_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due      ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_sessions_user  ON study_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_task  ON study_sessions(task_id);
CREATE INDEX IF NOT EXISTS idx_sessions_start ON study_sessions(start_time);
