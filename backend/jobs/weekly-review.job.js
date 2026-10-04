const cron = require('node-cron');
const { sendWeeklyReviewToAll } = require('../services/weekly-review.service');
const { isEmailConfigured } = require('../services/email.service');

function startWeeklyReviewJob() {
  if (!isEmailConfigured()) {
    console.warn('[weekly-review-job] No email transport configured (BREVO_API_KEY, or EMAIL_USER + EMAIL_PASS) — weekly review emails disabled.');
    return;
  }
  if (!process.env.GROQ_API_KEY) {
    console.warn('[weekly-review-job] GROQ_API_KEY not set — weekly review emails will use fallback text.');
  }

  if (process.env.NODE_ENV === 'production') {
    // Same reason as the reminder job: a sleeping free instance never fires its
    // own schedule. Production is driven by POST /api/jobs/weekly-review.
    console.log('[weekly-review-job] Production — in-process cron disabled; driven by POST /api/jobs/weekly-review.');
    return;
  }

  // Every Sunday at 8:00 AM Israel time
  cron.schedule('0 8 * * 0', () => {
    console.log('[weekly-review-job] Running — sending weekly reviews...');
    sendWeeklyReviewToAll().catch(err =>
      console.error(
        '[weekly-review-job] Unexpected error:', err.message,
        err.code ? `| code=${err.code}` : '',
        err.responseCode ? `| responseCode=${err.responseCode}` : '',
        err.response ? `| response=${err.response}` : ''
      )
    );
  }, { timezone: 'Asia/Jerusalem' });

  console.log('[weekly-review-job] Scheduled: Sundays at 08:00 Asia/Jerusalem (local dev).');
}

module.exports = { startWeeklyReviewJob };
