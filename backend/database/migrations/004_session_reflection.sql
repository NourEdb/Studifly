ALTER TABLE study_sessions
  ADD COLUMN IF NOT EXISTS status              TEXT    DEFAULT 'completed'
    CHECK (status IN ('completed','partial','continued','needs_more_time')),
  ADD COLUMN IF NOT EXISTS notes               TEXT,
  ADD COLUMN IF NOT EXISTS focus_score         SMALLINT CHECK (focus_score BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS difficulty_rating   SMALLINT CHECK (difficulty_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS completion_answer   TEXT CHECK (completion_answer IN ('yes','partially','no')),
  ADD COLUMN IF NOT EXISTS estimated_extra_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS task_marked_done    SMALLINT NOT NULL DEFAULT 0;
