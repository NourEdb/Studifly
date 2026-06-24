CREATE TABLE IF NOT EXISTS study_blocks (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id         INTEGER  NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  plan_date       TEXT     NOT NULL,  -- YYYY-MM-DD
  start_time      TEXT     NOT NULL,  -- HH:MM
  end_time        TEXT     NOT NULL,  -- HH:MM
  topic           TEXT,
  actual_start    TEXT,               -- HH:MM, filled after studying
  actual_end      TEXT,               -- HH:MM, filled after studying
  actual_notes    TEXT,
  completion_pct  SMALLINT CHECK (completion_pct >= 0 AND completion_pct <= 100),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_blocks_user_date ON study_blocks(user_id, plan_date);
CREATE INDEX IF NOT EXISTS idx_study_blocks_task ON study_blocks(task_id);
