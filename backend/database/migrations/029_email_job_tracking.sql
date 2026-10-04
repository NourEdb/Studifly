-- Task due dates now get reminder emails too, so tasks need the same de-dupe
-- flag events already carry (see 009_reminder_sent.sql).
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT false;

-- Without this, the first run of the new task reminder would mail a backlog of
-- every historic due date. Anything not due today or later can never land in
-- the job's today/tomorrow window, so mark it as already handled.
UPDATE tasks
SET reminder_sent = true
WHERE reminder_sent = false
  AND (due_date IS NULL OR due_date < to_char(NOW(), 'YYYY-MM-DD'));

-- Holds the Sun-Sat week key the user's last weekly review covered (e.g.
-- "2026-W40"), claimed before sending so the GitHub Actions schedule and a
-- local node-cron run can never both mail the same review.
ALTER TABLE users ADD COLUMN IF NOT EXISTS weekly_review_last_sent TEXT;

CREATE INDEX IF NOT EXISTS idx_tasks_reminder ON tasks(reminder_sent, due_date);
