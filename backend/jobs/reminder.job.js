const cron = require('node-cron');
const db = require('../database/db');
const { sendReminderEmail } = require('../services/email.service');

// Returns tomorrow's date as YYYY-MM-DD in local time
function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function sendReminders() {
  const tomorrow = tomorrowStr();
  console.log(`[reminder-job] Checking events for ${tomorrow}…`);

  const rows = await db.all(
    `SELECT e.*, u.email
     FROM events e
     JOIN users u ON u.id = e.user_id
     WHERE e.event_date = ?`,
    [tomorrow]
  );

  if (rows.length === 0) {
    console.log('[reminder-job] No events tomorrow — nothing to send.');
    return;
  }

  let sent = 0;
  for (const event of rows) {
    try {
      await sendReminderEmail(event.email, event);
      sent++;
      console.log(`[reminder-job] Sent reminder to ${event.email} for "${event.title}"`);
    } catch (err) {
      console.error(`[reminder-job] Failed to send to ${event.email}:`, err.message);
    }
  }
  console.log(`[reminder-job] Done — ${sent}/${rows.length} emails sent.`);
}

function startReminderJob() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('[reminder-job] EMAIL_USER or EMAIL_PASS not set — reminder emails disabled.');
    return;
  }

  // Runs every day at 08:00 AM server local time
  cron.schedule('0 8 * * *', () => {
    sendReminders().catch(err => console.error('[reminder-job] Unexpected error:', err.message));
  });

  console.log('[reminder-job] Scheduled: daily at 08:00 AM.');
}

module.exports = { startReminderJob };
