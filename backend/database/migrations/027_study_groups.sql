-- A user-curated subset of their friends, for a scoped weekly leaderboard
-- (distinct from the automatic "all friends" list on the Friends page).
CREATE TABLE IF NOT EXISTS study_groups (
  id         SERIAL PRIMARY KEY,
  name       TEXT        NOT NULL,
  created_by INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS study_group_members (
  group_id  INTEGER     NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  user_id   INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_study_group_members_user ON study_group_members(user_id);
