const cron = require('node-cron');
const db = require('../database/db');
const { sendReminderEmail } = require('../services/email.service');

function dateStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function sendReminders() {
  const today    = dateStr(0);
  const tomorrow = dateStr(1);

  console.log(`[reminder-job] Running at ${new Date().toISOString()} — checking window ${today} → ${tomorrow}`);

  const rows = await db.all(
    `SELECT e.*, u.email
     FROM events e
     JOIN users u ON u.id = e.user_id
     WHERE e.reminder_sent = false
       AND e.event_date >= ?
       AND e.event_date <= ?`,
    [today, tomorrow]
  );

  if (rows.length === 0) {
    console.log('[reminder-job] No pending reminders in window — nothing to send.');
    return;
  }

  console.log(`[reminder-job] Found ${rows.length} event(s) needing reminders.`);

  let sent = 0;
  for (const event of rows) {
    try {
      await sendReminderEmail(event.email, event);
      await db.run('UPDATE events SET reminder_sent = true WHERE id = ?', [event.id]);
      sent++;
      console.log(`[reminder-job] ✓ Sent and marked — id=${event.id} "${event.title}" → ${event.email}`);
    } catch (err) {
      console.error(`[reminder-job] ✗ Failed — id=${event.id} "${event.title}": ${err.message}`);
    }
  }

  console.log(`[reminder-job] Done — ${sent}/${rows.length} reminders sent.`);
}

function startReminderJob() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('[reminder-job] EMAIL_USER or EMAIL_PASS not set — reminder emails disabled.');
    return;
  }

  // Runs every hour on the hour — catches missed runs within 1 hour of server restart
  cron.schedule('0 * * * *', () => {
    sendReminders().catch(err => console.error('[reminder-job] Unexpected error:', err.message));
  });

  console.log('[reminder-job] Scheduled: hourly. Window covers today + tomorrow (reminder_sent=false only).');
}

module.exports = { startReminderJob, sendReminders };
