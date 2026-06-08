const Groq = require('groq-sdk');
const db = require('../database/db');
const { currentISOWeek, getISOWeekBounds } = require('../utils/dateHelpers');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function fmtHour(h) {
  if (h === 0)  return '12am';
  if (h === 12) return '12pm';
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

// Gathers all study stats for a user into a single object used both for
// the /context endpoint (insight cards) and the AI system prompt.
async function getStudyContext(userId) {
  const { start, end } = getISOWeekBounds(currentISOWeek());

  const [weekRow, sessionRow, bestHoursRows, courseRow, taskRows] = await Promise.all([
    db.get(
      `SELECT COALESCE(SUM(duration), 0)::int AS total_seconds
       FROM study_sessions WHERE user_id = ? AND start_time >= ? AND start_time < ? AND duration IS NOT NULL`,
      [userId, start, end]
    ),
    db.get(
      `SELECT COALESCE(AVG(duration), 0)::int AS avg_seconds,
              COUNT(*)::int                    AS total_sessions
       FROM study_sessions WHERE user_id = ? AND duration IS NOT NULL`,
      [userId]
    ),
    db.all(
      `SELECT EXTRACT(HOUR FROM start_time AT TIME ZONE 'UTC')::int AS hour,
              SUM(duration)::int AS total_seconds
       FROM study_sessions WHERE user_id = ? AND duration IS NOT NULL
       GROUP BY hour ORDER BY total_seconds DESC LIMIT 3`,
      [userId]
    ),
    db.get(
      `SELECT c.name, SUM(s.duration)::int AS total_seconds
       FROM study_sessions s
       JOIN tasks t ON s.task_id = t.id
       JOIN courses c ON t.course_id = c.id
       WHERE s.user_id = ? AND s.duration IS NOT NULL
       GROUP BY c.id, c.name ORDER BY total_seconds DESC LIMIT 1`,
      [userId]
    ),
    db.all(
      `SELECT status, COUNT(*)::int AS count FROM tasks WHERE user_id = ? GROUP BY status`,
      [userId]
    ),
  ]);

  const counts = { pending: 0, in_progress: 0, completed: 0 };
  taskRows.forEach(r => { counts[r.status] = r.count; });
  const total = counts.pending + counts.in_progress + counts.completed;
  const completionRate = total > 0 ? Math.round((counts.completed / total) * 100) : 0;

  const avgSessionMinutes = Math.round((sessionRow.avg_seconds || 0) / 60);
  const weeklyHours = ((weekRow.total_seconds || 0) / 3600).toFixed(1);
  const bestHours = bestHoursRows.map(r => fmtHour(r.hour));

  return {
    weeklyHours:        parseFloat(weeklyHours),
    completionRate,
    totalTasks:         total,
    completedTasks:     counts.completed,
    avgSessionMinutes,
    totalSessions:      sessionRow.total_sessions,
    bestHours,
    mostStudiedCourse:  courseRow?.name || null,
    mostStudiedSeconds: courseRow?.total_seconds || 0,
  };
}

function buildSystemPrompt(ctx) {
  const courseInfo = ctx.mostStudiedCourse
    ? `${ctx.mostStudiedCourse} (${Math.round(ctx.mostStudiedSeconds / 3600 * 10) / 10}h all-time)`
    : 'No courses tracked yet';

  const hoursInfo = ctx.bestHours.length
    ? ctx.bestHours.join(', ')
    : 'Not enough data yet';

  return `You are an encouraging AI study coach inside Studifly, a study-tracking app.
Your job is to give short, practical, personalized advice based on the student's real data.

Current student stats:
- This week: ${ctx.weeklyHours}h studied
- Average session length: ${ctx.avgSessionMinutes} min
- Total sessions logged: ${ctx.totalSessions}
- Tasks completed: ${ctx.completedTasks} of ${ctx.totalTasks} (${ctx.completionRate}% completion rate)
- Most studied course/subject: ${courseInfo}
- Peak productivity hours: ${hoursInfo}

Rules:
- Keep every reply under 120 words.
- Be specific — reference the student's actual numbers when relevant.
- Be warm and motivating, not generic.
- Use plain text only (no markdown, no bullet symbols, no asterisks).
- If data is missing (e.g. no sessions yet) still give helpful general advice.`;
}

async function getContext(userId) {
  return getStudyContext(userId);
}

async function chat(userId, messages) {
  const ctx = await getStudyContext(userId);

  // Groq follows the OpenAI messages format: [{role, content}].
  // Prepend the system prompt as a system message.
  const groqMessages = [
    { role: 'system', content: buildSystemPrompt(ctx) },
    ...messages,
  ];

  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: groqMessages,
    max_tokens: 300,
  });

  return { reply: completion.choices[0].message.content };
}

module.exports = { getContext, chat };
