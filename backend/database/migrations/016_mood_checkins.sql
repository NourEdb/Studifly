CREATE TABLE IF NOT EXISTS mood_checkins (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mood_score   SMALLINT NOT NULL CHECK (mood_score   BETWEEN 1 AND 5),
  energy_score SMALLINT NOT NULL CHECK (energy_score BETWEEN 1 AND 5),
  note         TEXT,
  checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, checkin_date)
);
CREATE INDEX IF NOT EXISTS idx_mood_checkins_user ON mood_checkins(user_id);
