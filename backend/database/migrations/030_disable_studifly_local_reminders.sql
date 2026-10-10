-- Demo/peer accounts seeded with @studifly.local addresses (see
-- backend/scripts/seed-demo.js) are undeliverable — Brevo would accept and
-- then hard-bounce them, hurting sender reputation. Turn reminders and
-- weekly-review emails off for any such account, present or future.
UPDATE users SET email_reminders_enabled = false
WHERE email ILIKE '%@studifly.local' AND email_reminders_enabled = true;
