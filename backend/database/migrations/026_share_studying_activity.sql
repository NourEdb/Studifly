-- Opt-in, default-off: whether a user's current task/course name is exposed to
-- friends alongside the existing online "studying now" dot. Off by default —
-- friends still see the generic dot/label either way (see 019_appear_offline.sql).
ALTER TABLE users ADD COLUMN IF NOT EXISTS share_studying_activity BOOLEAN NOT NULL DEFAULT false;
