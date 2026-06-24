const Groq = require('groq-sdk');
const nodemailer = require('nodemailer');
const db = require('../database/db');
const { currentISOWeek, getISOWeekBounds } = require('../utils/dateHelpers');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
}

async function getWeeklyStats(userId) {
  const { start, end } = getISOWeekBounds(currentISOWeek());

  const [hoursRow, sessionRow, tasksRow, courseRow, userRow] = await Promise.all([
    db.get(
      `SELECT COALESCE(SUM(duration), 0)::int AS total_seconds
       FROM study_sessions
       WHERE user_id = ? AND start_time >= ? AND start_time < ? AND duration IS NOT NULL`,
      [userId, start, end]
    ),
    db.get(
      `SELECT COUNT(*)::int AS count
       FROM study_sessions
       WHERE user_id = ? AND start_time >= ? AND start_time < ? AND duration IS NOT NULL`,
      [userId, start, end]
    ),
    db.get(
      `SELECT COUNT(DISTINCT task_id)::int AS completed
       FROM study_sessions
       WHERE user_id = ? AND task_marked_done = 1 AND start_time >= ? AND start_time < ?`,
      [userId, start, end]
    ),
    db.get(
      `SELECT c.name, SUM(s.duration)::int AS total_seconds
       FROM study_sessions s
       JOIN tasks t ON s.task_id = t.id
       JOIN courses c ON t.course_id = c.id
       WHERE s.user_id = ? AND s.duration IS NOT NULL AND s.start_time >= ? AND s.start_time < ?
       GROUP BY c.id, c.name ORDER BY total_seconds DESC LIMIT 1`,
      [userId, start, end]
    ),
    db.get(
      `SELECT email, display_name, username, weekly_goal_hours FROM users WHERE id = ?`,
      [userId]
    ),
  ]);

  const totalHours = parseFloat((hoursRow.total_seconds / 3600).toFixed(1));
  const goalHours  = userRow.weekly_goal_hours || 10;
  const goalPct    = Math.min(Math.round((totalHours / goalHours) * 100), 100);

  return {
    email:              userRow.email,
    displayName:        userRow.display_name || userRow.username,
    totalHours,
    totalSeconds:       hoursRow.total_seconds,
    sessionCount:       sessionRow.count,
    tasksCompleted:     tasksRow.completed,
    mostStudiedCourse:  courseRow?.name || null,
    mostStudiedHours:   courseRow ? parseFloat((courseRow.total_seconds / 3600).toFixed(1)) : null,
    goalHours,
    goalPct,
  };
}

async function generateAISummary(stats) {
  const courseInfo = stats.mostStudiedCourse
    ? `Most studied subject/course this week: ${stats.mostStudiedCourse} (${stats.mostStudiedHours}h).`
    : 'No specific course tracked this week.';

  const goalStatus = stats.goalPct >= 100
    ? `They exceeded their ${stats.goalHours}h weekly goal by studying ${stats.totalHours}h — well done!`
    : stats.goalPct >= 70
      ? `They completed ${stats.goalPct}% of their ${stats.goalHours}h weekly goal (${stats.totalHours}h studied).`
      : `They studied ${stats.totalHours}h this week against a ${stats.goalHours}h goal (${stats.goalPct}% achieved).`;

  const prompt =
    `Write a personalized weekly study review for a student named ${stats.displayName}.\n\n` +
    `Their stats for this week:\n` +
    `- Total study time: ${stats.totalHours} hours across ${stats.sessionCount} sessions\n` +
    `- Tasks completed: ${stats.tasksCompleted}\n` +
    `- ${courseInfo}\n` +
    `- ${goalStatus}\n\n` +
    `Write exactly 2-3 short paragraphs:\n` +
    `1. A warm, specific summary of their week referencing their actual numbers\n` +
    `2. An observation about their effort or a pattern worth noting\n` +
    `3. One concrete, actionable tip to improve next week\n\n` +
    `Plain text only. No bullet points, no markdown, no asterisks. Keep it under 200 words total.`;

  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [
      {
        role: 'system',
        content:
          'You are a warm, encouraging study coach writing a weekly review email for a student using the Studifly app. ' +
          'Be specific, reference their real numbers, and keep the tone supportive. Plain text only — no markdown, no bullet points.',
      },
      { role: 'user', content: prompt },
    ],
    max_tokens: 400,
  });

  return completion.choices[0].message.content.trim();
}

function buildWeeklyReviewHtml(stats, aiSummary) {
  const appUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const goalColor = stats.goalPct >= 100 ? '#34C68A' : stats.goalPct >= 70 ? '#6C4DC4' : '#F5A623';
  const goalLabel = stats.goalPct >= 100 ? '🎯 Goal reached!' : `${stats.goalPct}% of goal`;

  const courseRow = stats.mostStudiedCourse
    ? `<p style="font-size:14px;color:#555;margin:16px 0 0;text-align:center;">
         📚 Most studied: <strong style="color:#1a1a2e;">${stats.mostStudiedCourse}</strong>
         &nbsp;·&nbsp; ${stats.mostStudiedHours}h this week
       </p>`
    : '';

  const summaryParagraphs = aiSummary
    .split(/\n\n+/)
    .filter(Boolean)
    .map(p => `<p style="font-size:15px;color:#333;line-height:1.7;margin:0 0 14px;">${p.trim()}</p>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f4f2fb;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:580px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(108,77,196,0.10);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#6C4DC4 0%,#8B6FD4 100%);padding:32px 36px 28px;text-align:center;">
      <div style="font-size:28px;font-weight:800;color:#fff;letter-spacing:-0.5px;">
        Studi<span style="color:#c9b8f0;">fly</span>
      </div>
      <div style="font-size:13px;color:#d8cff5;margin-top:4px;">Your personal study companion</div>
      <div style="display:inline-block;margin-top:18px;background:rgba(255,255,255,0.18);border-radius:20px;padding:5px 18px;font-size:13px;color:#fff;font-weight:600;">
        📊 Weekly Review
      </div>
    </div>

    <!-- Body -->
    <div style="padding:32px 36px;">
      <p style="font-size:18px;font-weight:700;color:#1a1a2e;margin:0 0 6px;">Hi ${stats.displayName}!</p>
      <p style="font-size:14px;color:#7B7A99;margin:0 0 24px;">Here's how your study week went:</p>

      <!-- Stats grid -->
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:8px;margin-bottom:8px;">
        <tr>
          <td style="background:#f8f6ff;border-radius:10px;padding:16px 8px;text-align:center;width:25%;">
            <div style="font-size:24px;font-weight:800;color:#6C4DC4;">${stats.totalHours}h</div>
            <div style="font-size:11px;font-weight:600;color:#9e97c0;text-transform:uppercase;letter-spacing:.5px;margin-top:4px;">Studied</div>
          </td>
          <td style="background:#f8f6ff;border-radius:10px;padding:16px 8px;text-align:center;width:25%;">
            <div style="font-size:24px;font-weight:800;color:#6C4DC4;">${stats.sessionCount}</div>
            <div style="font-size:11px;font-weight:600;color:#9e97c0;text-transform:uppercase;letter-spacing:.5px;margin-top:4px;">Sessions</div>
          </td>
          <td style="background:#f8f6ff;border-radius:10px;padding:16px 8px;text-align:center;width:25%;">
            <div style="font-size:24px;font-weight:800;color:#6C4DC4;">${stats.tasksCompleted}</div>
            <div style="font-size:11px;font-weight:600;color:#9e97c0;text-transform:uppercase;letter-spacing:.5px;margin-top:4px;">Tasks done</div>
          </td>
          <td style="background:#f8f6ff;border-radius:10px;padding:16px 8px;text-align:center;width:25%;">
            <div style="font-size:24px;font-weight:800;color:${goalColor};">${stats.goalPct}%</div>
            <div style="font-size:11px;font-weight:600;color:#9e97c0;text-transform:uppercase;letter-spacing:.5px;margin-top:4px;">${goalLabel}</div>
          </td>
        </tr>
      </table>

      ${courseRow}

      <!-- Divider -->
      <hr style="border:none;border-top:1px solid #ede9fb;margin:24px 0;" />

      <!-- AI Summary -->
      <div>
        ${summaryParagraphs}
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-top:28px;">
        <a href="${appUrl}" style="display:inline-block;background:#6C4DC4;color:#fff;text-decoration:none;padding:12px 36px;border-radius:8px;font-weight:700;font-size:15px;">
          Open Studifly
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f8f6ff;padding:20px 36px;text-align:center;font-size:12px;color:#9e97c0;border-top:1px solid #ede9fb;">
      Studifly &middot; Learn, grow, and fly.
    </div>
  </div>
</body>
</html>`;
}

async function sendWeeklyReviewToUser(userId) {
  const stats = await getWeeklyStats(userId);

  let aiSummary;
  try {
    aiSummary = await generateAISummary(stats);
  } catch (err) {
    console.error(`[weekly-review] Groq failed for user ${userId}: ${err.message}`);
    aiSummary =
      `You put in ${stats.totalHours} hours of study this week across ${stats.sessionCount} sessions — great effort!\n\n` +
      `You completed ${stats.tasksCompleted} task${stats.tasksCompleted !== 1 ? 's' : ''} this week. ` +
      (stats.mostStudiedCourse ? `Your top subject was ${stats.mostStudiedCourse}. ` : '') +
      `Keep building on this momentum.\n\n` +
      `For next week, try to spread your sessions evenly across the week so you stay fresh and retain more of what you study.`;
  }

  const html = buildWeeklyReviewHtml(stats, aiSummary);
  const transporter = createTransporter();

  await transporter.sendMail({
    from: `"Studifly" <${process.env.EMAIL_USER}>`,
    to: stats.email,
    subject: `📊 Your Studifly weekly review — ${stats.totalHours}h studied this week`,
    html,
  });

  console.log(`[weekly-review] Sent to ${stats.email} (user ${userId})`);
}

async function sendWeeklyReviewToAll() {
  const { start, end } = getISOWeekBounds(currentISOWeek());

  const users = await db.all(
    `SELECT DISTINCT u.id
     FROM users u
     JOIN study_sessions s ON s.user_id = u.id
     WHERE s.start_time >= ? AND s.start_time < ? AND s.duration IS NOT NULL`,
    [start, end]
  );

  console.log(`[weekly-review] Found ${users.length} user(s) with sessions this week.`);

  let sent = 0;
  for (const user of users) {
    try {
      await sendWeeklyReviewToUser(user.id);
      sent++;
    } catch (err) {
      console.error(`[weekly-review] Failed for user ${user.id}: ${err.message}`);
    }
  }

  console.log(`[weekly-review] Done — ${sent}/${users.length} weekly reviews sent.`);
  return { sent, total: users.length };
}

module.exports = { sendWeeklyReviewToUser, sendWeeklyReviewToAll };
