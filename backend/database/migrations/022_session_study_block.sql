ALTER TABLE study_sessions ADD COLUMN IF NOT EXISTS study_block_id INTEGER REFERENCES study_blocks(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_study_block ON study_sessions(study_block_id);
