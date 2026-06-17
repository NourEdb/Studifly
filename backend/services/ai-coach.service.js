const Groq = require('groq-sdk');
const db = require('../database/db');
const { currentISOWeek, getISOWeekBounds } = require('../utils/dateHelpers');
const { getTaskPredictions } = require('./prediction.service');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function fmtHour(h) {
  if (h === 0)  return '12am';
  if (h === 12) return '12pm';
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

async function getStudyContext(userId) {
  const { start, end } = getISOWeekBounds(currentISOWeek());

  const [weekRow, sessionRow, bestHoursRows, courseRow, taskRows, reflectionRow, overtimeRow, prediction] = await Promise.all([
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
    // Reflection data: avg focus/difficulty, completion breakdown
    db.get(
      `SELECT
         ROUND(AVG(focus_score)::numeric, 1)       AS avg_focus,
         ROUND(AVG(difficulty_rating)::numeric, 1) AS avg_difficulty,
         COUNT(*) FILTER (WHERE completion_answer = 'yes')::int        AS completed_yes,
         COUNT(*) FILTER (WHERE completion_answer = 'partially')::int  AS completed_partial,
         COUNT(*) FILTER (WHERE completion_answer = 'no')::int         AS completed_no,
         COUNT(*) FILTER (WHERE completion_answer IS NOT NULL)::int     AS total_reflected
       FROM study_sessions WHERE user_id = ? AND duration IS NOT NULL`,
      [userId]
    ),
    // Tasks that repeatedly go over time (need more time on same task > 1 session)
    db.all(
      `SELECT t.name, COUNT(*)::int AS over_count
       FROM study_sessions s
       JOIN tasks t ON s.task_id = t.id
       WHERE s.user_id = ? AND s.status = 'needs_more_time'
       GROUP BY t.id, t.name HAVING COUNT(*) > 1
       ORDER BY over_count DESC LIMIT 3`,
      [userId]
    ),
    getTaskPredictions(userId),
  ]);

  const counts = { pending: 0, in_progress: 0, completed: 0 };
  taskRows.forEach(r => { counts[r.status] = r.count; });
  const total = counts.pending + counts.in_progress + counts.completed;
  const completionRate = total > 0 ? Math.round((counts.completed / total) * 100) : 0;

  const avgSessionMinutes = Math.round((sessionRow.avg_seconds || 0) / 60);
  const weeklyHours = ((weekRow.total_seconds || 0) / 3600).toFixed(1);
  const bestHours = bestHoursRows.map(r => fmtHour(r.hour));

  return {
    weeklyHours:          parseFloat(weeklyHours),
    completionRate,
    totalTasks:           total,
    completedTasks:       counts.completed,
    avgSessionMinutes,
    totalSessions:        sessionRow.total_sessions,
    bestHours,
    mostStudiedCourse:    courseRow?.name || null,
    mostStudiedSeconds:   courseRow?.total_seconds || 0,
    avgFocusScore:        reflectionRow?.avg_focus || null,
    avgDifficulty:        reflectionRow?.avg_difficulty || null,
    reflectionBreakdown:  {
      yes:      reflectionRow?.completed_yes || 0,
      partial:  reflectionRow?.completed_partial || 0,
      no:       reflectionRow?.completed_no || 0,
      total:    reflectionRow?.total_reflected || 0,
    },
    tasksNeedingBreakdown: overtimeRow || [],
    predictionSummary: prediction.summary.total_count > 0
      ? `${prediction.summary.on_track_count} of ${prediction.summary.total_count} pending tasks with deadlines are on track`
      : null,
  };
}

function buildSystemPrompt(ctx) {
  const courseInfo = ctx.mostStudiedCourse
    ? `${ctx.mostStudiedCourse} (${Math.round(ctx.mostStudiedSeconds / 3600 * 10) / 10}h all-time)`
    : 'No courses tracked yet';

  const hoursInfo = ctx.bestHours.length
    ? ctx.bestHours.join(', ')
    : 'Not enough data yet';

  const focusInfo = ctx.avgFocusScore
    ? `Average focus score: ${ctx.avgFocusScore}/5, average difficulty: ${ctx.avgDifficulty}/5`
    : 'No focus/difficulty data yet';

  const rb = ctx.reflectionBreakdown;
  const reflectionInfo = rb.total > 0
    ? `Out of ${rb.total} reflected sessions: ${rb.yes} fully completed, ${rb.partial} partially, ${rb.no} not completed`
    : 'No reflection data yet';

  const overtimeInfo = ctx.tasksNeedingBreakdown.length
    ? `Tasks repeatedly needing more time: ${ctx.tasksNeedingBreakdown.map(t => `"${t.name}" (${t.over_count}x)`).join(', ')}`
    : null;

  return `You are an encouraging AI study coach inside Studifly, a study-tracking app.
Your job is to give short, practical, personalized advice based on the student's real data.

Current student stats:
- This week: ${ctx.weeklyHours}h studied
- Average session length: ${ctx.avgSessionMinutes} min
- Total sessions logged: ${ctx.totalSessions}
- Tasks completed: ${ctx.completedTasks} of ${ctx.totalTasks} (${ctx.completionRate}% completion rate)
- Most studied course/subject: ${courseInfo}
- Peak productivity hours: ${hoursInfo}
- ${focusInfo}
- Session completion: ${reflectionInfo}${overtimeInfo ? `\n- ${overtimeInfo}` : ''}${ctx.predictionSummary ? `\n- Task completion forecast: ${ctx.predictionSummary}` : ''}

Rules:
- Keep every reply under 120 words.
- Be specific — reference the student's actual numbers when relevant.
- Be warm and motivating, not generic.
- Use plain text only (no markdown, no bullet symbols, no asterisks).
- If tasks repeatedly exceed planned time, suggest breaking them into smaller parts.
- If data is missing (e.g. no sessions yet) still give helpful general advice.`;
}

async function getContext(userId) {
  return getStudyContext(userId);
}

async function getHistory(userId) {
  return db.all(
    'SELECT role, content, created_at FROM ai_coach_messages WHERE user_id = ? ORDER BY created_at ASC',
    [userId]
  );
}

async function getRecentContext(userId, limit = 15) {
  const rows = await db.all(
    'SELECT role, content FROM ai_coach_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    [userId, limit]
  );
  return rows.reverse();
}

async function chat(userId, newUserMessage) {
  const [ctx, recentContext] = await Promise.all([
    getStudyContext(userId),
    getRecentContext(userId, 15),
  ]);

  const groqMessages = [
    { role: 'system', content: buildSystemPrompt(ctx) },
    ...recentContext,
    { role: 'user', content: newUserMessage },
  ];

  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: groqMessages,
    max_tokens: 300,
  });

  const reply = completion.choices[0].message.content;

  await db.run(
    'INSERT INTO ai_coach_messages (user_id, role, content) VALUES (?, ?, ?), (?, ?, ?)',
    [userId, 'user', newUserMessage, userId, 'assistant', reply]
  );

  return { reply };
}

async function clearHistory(userId) {
  await db.run('DELETE FROM ai_coach_messages WHERE user_id = ?', [userId]);
  return { ok: true };
}

module.exports = { getContext, getHistory, chat, clearHistory };
