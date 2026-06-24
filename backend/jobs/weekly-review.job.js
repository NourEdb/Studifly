const cron = require('node-cron');
const { sendWeeklyReviewToAll } = require('../services/weekly-review.service');

function startWeeklyReviewJob() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('[weekly-review-job] EMAIL_USER or EMAIL_PASS not set — weekly review emails disabled.');
    return;
  }
  if (!process.env.GROQ_API_KEY) {
    console.warn('[weekly-review-job] GROQ_API_KEY not set — weekly review emails will use fallback text.');
  }

  // Every Sunday at 8:00 AM UTC
  cron.schedule('0 8 * * 0', () => {
    console.log('[weekly-review-job] Running — sending weekly reviews...');
    sendWeeklyReviewToAll().catch(err =>
      console.error('[weekly-review-job] Unexpected error:', err.message)
    );
  });

  console.log('[weekly-review-job] Scheduled: Sundays at 08:00 UTC.');
}

module.exports = { startWeeklyReviewJob };
