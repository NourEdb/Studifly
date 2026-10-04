const nodemailer = require('nodemailer');
const { dateStrUTC } = require('../utils/dateHelpers');

const TYPE_LABELS = {
  exam:     { label: 'Exam',     color: '#E85454', icon: '📝' },
  deadline: { label: 'Deadline', color: '#F5A623', icon: '⏰' },
  meeting:  { label: 'Meeting',  color: '#4A9FE0', icon: '👥' },
  reminder: { label: 'Reminder', color: '#34C68A', icon: '🔔' },
  other:    { label: 'Other',    color: '#7B7A99', icon: '📌' },
};

const TASK_CATEGORY_LABELS = {
  exam:     { label: 'Exam',     color: '#E85454', icon: '📝' },
  homework: { label: 'Homework', color: '#4A9FE0', icon: '📘' },
  project:  { label: 'Project',  color: '#F5A623', icon: '🛠️' },
  other:    { label: 'Other',    color: '#7B7A99', icon: '📌' },
};

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

// EMAIL_FROM takes either "a@b.com" or "Name <a@b.com>". Falls back to the SMTP
// account so local dev still works with only EMAIL_USER set.
function senderFrom() {
  const raw = (process.env.EMAIL_FROM || process.env.EMAIL_USER || '').trim();
  const match = raw.match(/^(.*)<(.+)>\s*$/);
  if (match) {
    return { name: match[1].trim().replace(/^"|"$/g, '') || 'Studifly', email: match[2].trim() };
  }
  return { name: 'Studifly', email: raw };
}

function emailTransportName() {
  return process.env.BREVO_API_KEY ? 'brevo' : 'smtp';
}

function isEmailConfigured() {
  return !!process.env.BREVO_API_KEY || !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

async function sendViaBrevo({ to, subject, html }) {
  const res = await fetch(BREVO_ENDPOINT, {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: senderFrom(),
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    // Brevo puts the actual reason (unverified sender, invalid recipient, quota
    // exceeded) in the body. Without it every failure looks identical in logs.
    const detail = await res.text().catch(() => '');
    const err = new Error(`Brevo API ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ''}`);
    err.code = `BREVO_${res.status}`;
    err.responseCode = res.status;
    throw err;
  }
}

async function sendViaSmtp({ to, subject, html }) {
  const sender = senderFrom();
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"${sender.name}" <${sender.email}>`,
    to,
    subject,
    html,
  });
}

// Single exit point for every outgoing email. Production uses Brevo's HTTPS API
// because Render's free tier blocks outbound SMTP ports (25/465/587), which is
// why nodemailer silently timed out there; SMTP stays the local-dev path.
async function sendEmail({ to, subject, html }) {
  if (!to) throw new Error('sendEmail: missing recipient');
  if (!isEmailConfigured()) throw new Error('sendEmail: no transport configured (set BREVO_API_KEY, or EMAIL_USER + EMAIL_PASS)');

  const transport = emailTransportName();
  if (transport === 'brevo') await sendViaBrevo({ to, subject, html });
  else await sendViaSmtp({ to, subject, html });

  console.log(`[email] Sent via ${transport} → ${to} | "${subject}"`);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function dayLabelFor(dateStr) {
  return dateStr === dateStrUTC(0) ? 'today' : 'tomorrow';
}

function buildReminderHtml({ meta, dayLabel, kicker, title, rows }) {
  const appUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const detailRows = rows
    .filter(([, value]) => value)
    .map(([label, value]) => `<tr><td class="label">${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`)
    .join('\n        ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  body { margin: 0; padding: 0; background: #f4f2fb; font-family: 'Segoe UI', Arial, sans-serif; }
  .wrapper { max-width: 560px; margin: 32px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(108,77,196,0.10); }
  .header { background: linear-gradient(135deg, #6C4DC4 0%, #8B6FD4 100%); padding: 32px 36px 28px; text-align: center; }
  .logo { font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
  .logo span { color: #c9b8f0; }
  .tagline { font-size: 13px; color: #d8cff5; margin-top: 4px; }
  .badge { display: inline-block; margin-top: 18px; background: rgba(255,255,255,0.18); border-radius: 20px; padding: 5px 16px; font-size: 13px; color: #fff; font-weight: 600; }
  .content { padding: 32px 36px; }
  .reminder-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #6C4DC4; margin-bottom: 8px; }
  .event-title { font-size: 22px; font-weight: 700; color: #1a1a2e; margin-bottom: 20px; line-height: 1.3; }
  .type-chip { display: inline-block; padding: 3px 12px; border-radius: 12px; font-size: 12px; font-weight: 700; color: #fff; background: ${meta.color}; margin-bottom: 20px; }
  table.details { width: 100%; border-collapse: collapse; font-size: 14px; }
  table.details td { padding: 9px 0; border-bottom: 1px solid #f0eef8; color: #444; vertical-align: top; }
  table.details td.label { width: 80px; font-weight: 600; color: #6C4DC4; white-space: nowrap; }
  .cta { margin-top: 28px; text-align: center; }
  .cta a { display: inline-block; background: #6C4DC4; color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 700; font-size: 15px; }
  .footer { background: #f8f6ff; padding: 20px 36px; text-align: center; font-size: 12px; color: #9e97c0; border-top: 1px solid #ede9fb; }
</style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo">Studi<span>fly</span></div>
      <div class="tagline">Your personal study companion</div>
      <div class="badge">${meta.icon} Reminder for ${dayLabel}</div>
    </div>
    <div class="content">
      <p class="reminder-title">${escapeHtml(kicker)}</p>
      <p class="event-title">${escapeHtml(title)}</p>
      <span class="type-chip">${meta.label}</span>
      <table class="details">
        ${detailRows}
      </table>
      <div class="cta">
        <a href="${appUrl}">Open Studifly</a>
      </div>
    </div>
    <div class="footer">Studifly &middot; Learn, grow, and fly.</div>
  </div>
</body>
</html>`;
}

function buildEventHtml(event) {
  const meta = TYPE_LABELS[event.type] || TYPE_LABELS.other;
  return buildReminderHtml({
    meta,
    dayLabel: dayLabelFor(event.event_date),
    kicker: 'Upcoming event',
    title: event.title,
    rows: [
      ['Date', event.event_date],
      ['Time', event.event_time],
      ['Notes', event.notes],
    ],
  });
}

function buildTaskHtml(task) {
  const meta = TASK_CATEGORY_LABELS[task.category] || TASK_CATEGORY_LABELS.other;
  return buildReminderHtml({
    meta,
    dayLabel: dayLabelFor(task.due_date),
    kicker: 'Task due soon',
    title: task.name,
    rows: [
      ['Due', task.due_date],
      ['Course', task.course_name],
      ['Status', task.status === 'in_progress' ? 'In progress' : 'Pending'],
    ],
  });
}

function buildPasswordResetHtml(resetUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  body { margin: 0; padding: 0; background: #f4f2fb; font-family: 'Segoe UI', Arial, sans-serif; }
  .wrapper { max-width: 560px; margin: 32px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(108,77,196,0.10); }
  .header { background: linear-gradient(135deg, #6C4DC4 0%, #8B6FD4 100%); padding: 32px 36px 28px; text-align: center; }
  .logo { font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
  .logo span { color: #c9b8f0; }
  .tagline { font-size: 13px; color: #d8cff5; margin-top: 4px; }
  .badge { display: inline-block; margin-top: 18px; background: rgba(255,255,255,0.18); border-radius: 20px; padding: 5px 16px; font-size: 13px; color: #fff; font-weight: 600; }
  .content { padding: 32px 36px; }
  .section-label { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #6C4DC4; margin-bottom: 8px; }
  .main-text { font-size: 16px; color: #1a1a2e; margin-bottom: 12px; line-height: 1.6; }
  .sub-text { font-size: 14px; color: #666; margin-bottom: 28px; line-height: 1.5; }
  .cta { text-align: center; margin-bottom: 28px; }
  .cta a { display: inline-block; background: #6C4DC4; color: #fff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: 700; font-size: 15px; }
  .url-fallback { background: #f4f2fb; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #7B7A99; word-break: break-all; margin-bottom: 20px; }
  .expiry-note { font-size: 13px; color: #E85454; font-weight: 600; text-align: center; margin-bottom: 8px; }
  .ignore-note { font-size: 13px; color: #9e97c0; text-align: center; }
  .footer { background: #f8f6ff; padding: 20px 36px; text-align: center; font-size: 12px; color: #9e97c0; border-top: 1px solid #ede9fb; }
</style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo">Studi<span>fly</span></div>
      <div class="tagline">Your personal study companion</div>
      <div class="badge">🔐 Password Reset</div>
    </div>
    <div class="content">
      <p class="section-label">Password reset request</p>
      <p class="main-text">We received a request to reset the password for your Studifly account.</p>
      <p class="sub-text">Click the button below to choose a new password. If you didn't request this, you can safely ignore this email — your password won't change.</p>
      <div class="cta">
        <a href="${resetUrl}">Reset my password</a>
      </div>
      <p class="expiry-note">⏰ This link expires in 1 hour.</p>
      <p class="ignore-note">If the button doesn't work, copy and paste this link into your browser:</p>
      <div class="url-fallback">${resetUrl}</div>
    </div>
    <div class="footer">Studifly &middot; Learn, grow, and fly.</div>
  </div>
</body>
</html>`;
}

async function sendReminderEmail(toEmail, event) {
  const meta = TYPE_LABELS[event.type] || TYPE_LABELS.other;
  await sendEmail({
    to: toEmail,
    subject: `${meta.icon} Reminder: "${event.title}" is ${dayLabelFor(event.event_date)}`,
    html: buildEventHtml(event),
  });
}

async function sendTaskReminderEmail(toEmail, task) {
  const meta = TASK_CATEGORY_LABELS[task.category] || TASK_CATEGORY_LABELS.other;
  await sendEmail({
    to: toEmail,
    subject: `${meta.icon} Due ${dayLabelFor(task.due_date)}: "${task.name}"`,
    html: buildTaskHtml(task),
  });
}

async function sendPasswordResetEmail(toEmail, resetUrl) {
  await sendEmail({
    to: toEmail,
    subject: '🔐 Reset your Studifly password',
    html: buildPasswordResetHtml(resetUrl),
  });
}

module.exports = {
  sendEmail,
  sendReminderEmail,
  sendTaskReminderEmail,
  sendPasswordResetEmail,
  isEmailConfigured,
  emailTransportName,
};
