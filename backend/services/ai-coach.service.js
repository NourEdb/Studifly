const Groq = require('groq-sdk');
const db = require('../database/db');
const { currentISOWeek, getISOWeekBounds } = require('../utils/dateHelpers');
const { getTaskPredictions } = require('./prediction.service');
const { finalizeCompletion } = require('../utils/textHelpers');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';

function fmtHour(h) {
  if (h === 0)  return '12am';
  if (h === 12) return '12pm';
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

async function getStudyContext(userId) {
  const { start, end } = getISOWeekBounds(currentISOWeek());

  const [weekRow, sessionRow, bestHoursRows, courseRow, taskRows, overdueRow, userRow, reflectionRow, overtimeRow, prediction] = await Promise.all([
    db.get(
      `SELECT COALESCE(SUM(duration), 0)::int AS total_seconds,
              COUNT(*)::int                   AS session_count
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
    // Same "overdue" definition as dashboard.service.js's getSummary(): not
    // completed and past its due date.
    db.get(
      `SELECT COUNT(*)::int AS count FROM tasks WHERE user_id = ? AND status != 'completed' AND due_date < CURRENT_DATE::text`,
      [userId]
    ),
    db.get(
      `SELECT weekly_goal_hours FROM users WHERE id = ?`,
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
    weeklySessionCount:   weekRow.session_count,
    weeklyGoalHours:      userRow?.weekly_goal_hours || 10,
    completionRate,
    totalTasks:           total,
    completedTasks:       counts.completed,
    // "Not completed" = pending + in_progress combined, not just status
    // = 'pending' — the model previously said "15 pending tasks" when 15
    // was actually totalTasks, so this needs its own explicit count rather
    // than being re-derived (or mis-derived) from total/completed in the prompt.
    pendingTasks:         total - counts.completed,
    overdueTasks:         overdueRow.count,
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

  // Every line below states its own time period explicitly (this week vs.
  // all time) — ctx.totalSessions and most of the other fields are all-time
  // totals computed with no date filter, NOT this-week figures. Without an
  // explicit label here, the model previously inferred they were all "this
  // week" (the stat listed just above) and reported e.g. an all-time session
  // count as "sessions this week".
  return `You are an encouraging AI study coach inside Studifly, a study-tracking app.
Your job is to give short, practical, personalized advice based on the student's real data.

Current student stats:
- This week: ${ctx.weeklyHours}h studied across ${ctx.weeklySessionCount} session${ctx.weeklySessionCount === 1 ? '' : 's'} (weekly goal: ${ctx.weeklyGoalHours}h)
- All time: ${ctx.totalSessions} total session${ctx.totalSessions === 1 ? '' : 's'} logged, averaging ${ctx.avgSessionMinutes} min each
- Tasks (all time): ${ctx.totalTasks} total, ${ctx.completedTasks} completed, ${ctx.pendingTasks} pending (not completed), ${ctx.overdueTasks} overdue (${ctx.completionRate}% completion rate)
- Most studied course/subject (all time): ${courseInfo}
- Peak productivity hours (all time): ${hoursInfo}
- ${focusInfo} (all time)
- Session completion (all time): ${reflectionInfo}${overtimeInfo ? `\n- ${overtimeInfo} (all time)` : ''}${ctx.predictionSummary ? `\n- Task completion forecast (pending tasks with deadlines): ${ctx.predictionSummary}` : ''}

Rules:
- Keep every reply under 120 words.
- Be specific — reference the student's actual numbers when relevant, and always use the exact time period each stat above is labeled with (this week vs. all time) — never state an all-time figure as if it were this week's, or vice versa.
- Use only the exact task counts and weekly goal given above (total, completed, pending, overdue, weekly goal) — never combine, re-derive, round, or restate them as a different number (e.g. the total task count is not the pending count, and the weekly goal is not the hours actually studied).
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
    model: GROQ_MODEL,
    messages: groqMessages,
    // openai/gpt-oss-20b is a reasoning model — reasoning tokens are drawn
    // from the same budget as the visible reply, so a low ceiling here (the
    // old max_tokens: 300) could leave the reply cut off mid-sentence/word
    // even though the system prompt only asks for ~120 words.
    // max_completion_tokens (not the deprecated max_tokens) covers reasoning
    // + reply together; reasoning_effort: 'low' keeps reasoning brief so more
    // of that budget goes to the actual answer.
    max_completion_tokens: 1500,
    reasoning_effort: 'low',
  });

  const choice = completion.choices[0];
  const reply = finalizeCompletion(choice.message.content, choice.finish_reason);

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

// One-shot course insight — does NOT save to chat history.
async function getCourseInsight(userId, { course_name, stats, task_names = [] }) {
  const taskList = task_names.length > 0
    ? `Tasks include: ${task_names.slice(0, 6).join(', ')}.`
    : '';

  const userPrompt =
    `Give me an honest 2-3 sentence assessment of my progress in "${course_name}". ` +
    `Stats: ${stats.completed_tasks} of ${stats.total_tasks} tasks completed ` +
    `(${stats.completion_pct}% completion rate), ${stats.planned_hours}h total planned time, ` +
    `${stats.actual_hours}h actually studied. ${taskList}`;

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are an encouraging AI study coach inside Studifly. ' +
          'Give a 2-3 sentence honest, specific, and practical assessment of the student\'s progress in the given course. ' +
          'Reference their actual numbers. Use plain text only — no markdown, no bullet points, no asterisks.',
      },
      { role: 'user', content: userPrompt },
    ],
    // See chat()'s identical comment — reasoning tokens for this model draw
    // from the same budget as the visible reply.
    max_completion_tokens: 1500,
    reasoning_effort: 'low',
  });

  const choice = completion.choices[0];
  return { insight: finalizeCompletion(choice.message.content, choice.finish_reason).trim() };
}

module.exports = { getContext, getHistory, chat, clearHistory, getCourseInsight };
