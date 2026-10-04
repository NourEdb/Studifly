const crypto = require('crypto');
const express = require('express');
const router  = express.Router();
const { sendReminders } = require('../jobs/reminder.job');
const { sendWeeklyReviewToAll } = require('../services/weekly-review.service');

function secretMatches(provided, expected) {
  const a = Buffer.from(String(provided || ''));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// A shared secret rather than the usual JWT: the caller is GitHub Actions, which
// has no Studifly account. These endpoints exist because Render's free instance
// sleeps and can't run its own cron (see jobs/reminder.job.js).
function cronAuth(req, res, next) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[jobs] CRON_SECRET is not set — refusing to run scheduled jobs over HTTP.');
    return res.status(503).json({ error: 'Scheduled jobs not configured' });
  }
  if (!secretMatches(req.headers['x-cron-secret'], secret)) {
    console.warn(`[jobs] Rejected ${req.method} ${req.originalUrl} — bad or missing x-cron-secret.`);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// POST /api/jobs/reminders — event + task due-date reminders for today/tomorrow
router.post('/reminders', cronAuth, async (req, res) => {
  try {
    const result = await sendReminders();
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error(`[POST /api/jobs/reminders] ${err.message}` + (err.code ? ` | code=${err.code}` : ''));
    res.status(500).json({ error: err.message || 'Reminder job failed' });
  }
});

// POST /api/jobs/weekly-review — one review per user per reported week
router.post('/weekly-review', cronAuth, async (req, res) => {
  try {
    const result = await sendWeeklyReviewToAll();
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error(`[POST /api/jobs/weekly-review] ${err.message}` + (err.code ? ` | code=${err.code}` : ''));
    res.status(500).json({ error: err.message || 'Weekly review job failed' });
  }
});

module.exports = router;
