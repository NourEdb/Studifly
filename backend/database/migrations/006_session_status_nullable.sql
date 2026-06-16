-- Fix: status was DEFAULT 'completed', causing sessions with no reflection to show as "done".
-- Clear the false defaults on sessions that were never actually reflected on,
-- then remove the default so future sessions start with no status.
UPDATE study_sessions
  SET status = NULL
  WHERE completion_answer IS NULL
    AND status = 'completed';

ALTER TABLE study_sessions
  ALTER COLUMN status SET DEFAULT NULL;
