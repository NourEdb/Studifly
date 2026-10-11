const cron = require('node-cron');
const db = require('../database/db');
const { sendReminderEmail, sendTaskReminderEmail, isEmailConfigured, emailTransportName } = require('../services/email.service');
const { dateStrUTC } = require('../utils/dateHelpers');

// err.message alone hides *why* a send failed (blocked SMTP port, unverified
// Brevo sender, quota, rejected recipient) — the exact ambiguity that made this
// silent in production. Always log the diagnostic fields alongside it.
function describeError(err) {
  return `${err.message}` +
    (err.code ? ` | code=${err.code}` : '') +
    (err.responseCode ? ` | responseCode=${err.responseCode}` : '') +
    (err.response ? ` | response=${err.response}` : '');
}

async function sendReminders() {
  const today    = dateStrUTC(0);
  const tomorrow = dateStrUTC(1);

  console.log(`[reminder-job] Running at ${new Date().toISOString()} via ${emailTransportName()} — checking window ${today} → ${tomorrow}`);

  const events = await db.all(
    `SELECT e.*, u.email
     FROM events e
     JOIN users u ON u.id = e.user_id
     WHERE e.reminder_sent = false
       AND e.type != 'personal'
       AND e.event_date >= ?
       AND e.event_date <= ?
       AND u.email_reminders_enabled = true`,
    [today, tomorrow]
  );

  const tasks = await db.all(
    `SELECT t.*, u.email, c.name AS course_name
     FROM tasks t
     JOIN users u ON u.id = t.user_id
     LEFT JOIN courses c ON c.id = t.course_id
     WHERE t.reminder_sent = false
       AND t.status != 'completed'
       AND t.due_date >= ?
       AND t.due_date <= ?
       AND u.email_reminders_enabled = true`,
    [today, tomorrow]
  );

  const total = events.length + tasks.length;
  if (total === 0) {
    console.log('[reminder-job] No pending reminders in window — nothing to send.');
    return { sent: 0, total: 0 };
  }

  console.log(`[reminder-job] Found ${events.length} event(s) and ${tasks.length} task(s) needing reminders.`);

  let sent = 0;
  for (const event of events) {
    // Claim BEFORE sending, not after: the SELECT above and this UPDATE are
    // two separate statements, so two runners (e.g. a developer's local cron
    // and GitHub Actions, both pointed at the same database) can both select
    // the same reminder_sent=false row before either one updates it — and
    // without this claim, both would then send. The WHERE clause makes the
    // claim atomic: only the runner whose UPDATE actually flips a row (rowCount
    // === 1) goes on to send; the other sees rowCount === 0 and skips.
    const claim = await db.run('UPDATE events SET reminder_sent = true WHERE id = ? AND reminder_sent = false', [event.id]);
    if (claim.rowCount === 0) {
      console.log(`[reminder-job] Skipped — event id=${event.id} already claimed by another run.`);
      continue;
    }
    try {
      await sendReminderEmail(event.email, event);
      sent++;
      console.log(`[reminder-job] ✓ Sent and marked — event id=${event.id} "${event.title}" → ${event.email}`);
    } catch (err) {
      // Release the claim so a later run can retry — otherwise a send
      // failure here would permanently mark this reminder as sent.
      await db.run('UPDATE events SET reminder_sent = false WHERE id = ?', [event.id]);
      console.error(`[reminder-job] ✗ Failed — event id=${event.id} "${event.title}": ${describeError(err)}`);
    }
  }

  for (const task of tasks) {
    const claim = await db.run('UPDATE tasks SET reminder_sent = true WHERE id = ? AND reminder_sent = false', [task.id]);
    if (claim.rowCount === 0) {
      console.log(`[reminder-job] Skipped — task id=${task.id} already claimed by another run.`);
      continue;
    }
    try {
      await sendTaskReminderEmail(task.email, task);
      sent++;
      console.log(`[reminder-job] ✓ Sent and marked — task id=${task.id} "${task.name}" → ${task.email}`);
    } catch (err) {
      await db.run('UPDATE tasks SET reminder_sent = false WHERE id = ?', [task.id]);
      console.error(`[reminder-job] ✗ Failed — task id=${task.id} "${task.name}": ${describeError(err)}`);
    }
  }

  console.log(`[reminder-job] Done — ${sent}/${total} reminders sent.`);
  return { sent, total };
}

function startReminderJob() {
  if (!isEmailConfigured()) {
    console.warn('[reminder-job] No email transport configured (BREVO_API_KEY, or EMAIL_USER + EMAIL_PASS) — reminder emails disabled.');
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    // Render's free instance sleeps when idle, so an in-process schedule simply
    // misses its window without any error. Production is driven externally by
    // POST /api/jobs/reminders (see .github/workflows/scheduled-jobs.yml).
    console.log('[reminder-job] Production — in-process cron disabled; driven by POST /api/jobs/reminders.');
    return;
  }

  if (process.env.ENABLE_LOCAL_CRON !== 'true') {
    // Off by default: every local backend points at the SAME shared database
    // (there's no per-developer dev database), so a laptop's own cron would
    // otherwise send real reminder emails to real users just by being left
    // running — this is exactly what caused the duplicate-send bug this fix
    // addresses. Opt in explicitly in .env to actually exercise this locally.
    console.log('[reminder-job] Local dev — in-process cron disabled (set ENABLE_LOCAL_CRON=true in .env to enable). Call POST /api/jobs/reminders directly to test.');
    return;
  }

  // Runs every hour on the hour — catches missed runs within 1 hour of server restart
  cron.schedule('0 * * * *', () => {
    sendReminders().catch(err => console.error('[reminder-job] Unexpected error:', describeError(err)));
  });

  console.log('[reminder-job] Scheduled: hourly (local dev, ENABLE_LOCAL_CRON=true). Window covers today + tomorrow (reminder_sent=false only).');
}

module.exports = { startReminderJob, sendReminders };
