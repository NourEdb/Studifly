-- A user's own fixed study-call link (Zoom Personal Meeting / Google Meet / etc.),
-- shared with friends via the "Study Together" invite feature. Nullable — no
-- link saved means the invite button stays disabled for that user.
ALTER TABLE users ADD COLUMN IF NOT EXISTS meeting_link TEXT;
