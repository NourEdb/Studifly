const nodemailer = require('nodemailer');

const TYPE_LABELS = {
  exam:     { label: 'Exam',     color: '#E85454', icon: '📝' },
  deadline: { label: 'Deadline', color: '#F5A623', icon: '⏰' },
  meeting:  { label: 'Meeting',  color: '#4A9FE0', icon: '👥' },
  reminder: { label: 'Reminder', color: '#34C68A', icon: '🔔' },
  other:    { label: 'Other',    color: '#7B7A99', icon: '📌' },
};

function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

function buildHtml(event) {
  const meta = TYPE_LABELS[event.type] || TYPE_LABELS.other;
  const timeRow = event.event_time
    ? `<tr><td class="label">Time</td><td>${event.event_time}</td></tr>`
    : '';
  const notesRow = event.notes
    ? `<tr><td class="label">Notes</td><td>${event.notes}</td></tr>`
    : '';

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
      <div class="badge">${meta.icon} Reminder for tomorrow</div>
    </div>
    <div class="content">
      <p class="reminder-title">Upcoming event</p>
      <p class="event-title">${event.title}</p>
      <span class="type-chip">${meta.label}</span>
      <table class="details">
        <tr><td class="label">Date</td><td>${event.event_date}</td></tr>
        ${timeRow}
        ${notesRow}
      </table>
      <div class="cta">
        <a href="#">Open Studifly</a>
      </div>
    </div>
    <div class="footer">Studifly &middot; Learn, grow, and fly.</div>
  </div>
</body>
</html>`;
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
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"Studifly" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `${meta.icon} Reminder: "${event.title}" is tomorrow`,
    html: buildHtml(event),
  });
}

async function sendPasswordResetEmail(toEmail, resetUrl) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"Studifly" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: '🔐 Reset your Studifly password',
    html: buildPasswordResetHtml(resetUrl),
  });
}

module.exports = { sendReminderEmail, sendPasswordResetEmail };
