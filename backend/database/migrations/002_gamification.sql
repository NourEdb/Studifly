CREATE TABLE IF NOT EXISTS user_xp (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_xp   INTEGER     NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_badges (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_key  TEXT        NOT NULL,
  earned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, badge_key)
);

-- One row per (user, event) — prevents double-awarding XP for the same trigger.
-- ref_type: 'session' | 'task' | 'weekly_goal'
-- ref_id:   session id, task id, or ISO week string e.g. '2024-W03'
CREATE TABLE IF NOT EXISTS xp_log (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount     INTEGER     NOT NULL,
  ref_type   TEXT        NOT NULL,
  ref_id     TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, ref_type, ref_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_log_user      ON xp_log(user_id);
