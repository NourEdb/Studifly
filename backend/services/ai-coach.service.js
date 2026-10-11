const Groq = require('groq-sdk');
const db = require('../database/db');
const { currentISOWeek, getISOWeekBounds, dateStrUTC } = require('../utils/dateHelpers');
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
  const today  = dateStrUTC(0);
  const tomorrow = dateStrUTC(1);
  const in14   = dateStrUTC(14);

  const [
    weekRow, sessionRow, bestHoursRows, courseRow, taskRows, overdueRow, userRow,
    reflectionRow, overtimeRow, prediction,
    upcomingTaskRows, overdueTaskRows, upcomingEventRows, studyBlockRows,
  ] = await Promise.all([
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
    // Concrete upcoming tasks (not completed, due within 14 days) — gives the
    // model specific names/dates/courses to talk about instead of only the
    // aggregate counts above.
    db.all(
      `SELECT t.id, t.name, t.due_date, t.status, t.category, t.planned_time,
              c.name AS course_name,
              COALESCE((SELECT SUM(duration) FROM study_sessions
                        WHERE task_id = t.id AND duration IS NOT NULL), 0)::int AS actual_seconds
       FROM tasks t
       LEFT JOIN courses c ON t.course_id = c.id
       WHERE t.user_id = ? AND t.status != 'completed'
         AND t.due_date >= ? AND t.due_date <= ?
       ORDER BY t.due_date ASC
       LIMIT 8`,
      [userId, today, in14]
    ),
    // Overdue tasks BY NAME (ctx.overdueTasks above is just the count).
    db.all(
      `SELECT t.name, t.due_date, t.category, c.name AS course_name
       FROM tasks t
       LEFT JOIN courses c ON t.course_id = c.id
       WHERE t.user_id = ? AND t.status != 'completed' AND t.due_date < ?
       ORDER BY t.due_date ASC
       LIMIT 8`,
      [userId, today]
    ),
    db.all(
      `SELECT title, type, event_date, event_time
       FROM events
       WHERE user_id = ? AND event_date >= ? AND event_date <= ?
       ORDER BY event_date ASC, event_time ASC NULLS LAST
       LIMIT 8`,
      [userId, today, in14]
    ),
    db.all(
      `SELECT sb.plan_date, sb.start_time, sb.end_time, sb.topic, sb.status,
              t.name AS task_name, c.name AS course_name
       FROM study_blocks sb
       JOIN tasks t ON sb.task_id = t.id
       LEFT JOIN courses c ON t.course_id = c.id
       WHERE sb.user_id = ? AND sb.plan_date IN (?, ?)
       ORDER BY sb.plan_date ASC, sb.start_time ASC NULLS LAST
       LIMIT 8`,
      [userId, today, tomorrow]
    ),
  ]);

  const counts = { pending: 0, in_progress: 0, completed: 0 };
  taskRows.forEach(r => { counts[r.status] = r.count; });
  const total = counts.pending + counts.in_progress + counts.completed;
  const completionRate = total > 0 ? Math.round((counts.completed / total) * 100) : 0;

  const avgSessionMinutes = Math.round((sessionRow.avg_seconds || 0) / 60);
  const weeklyHours = ((weekRow.total_seconds || 0) / 3600).toFixed(1);
  const bestHours = bestHoursRows.map(r => fmtHour(r.hour));

  // getTaskPredictions() covers every not-completed task with a due date
  // (not just the next-14-days window below), so every upcomingTaskRows
  // entry is guaranteed a match here.
  const predictionStatusById = Object.fromEntries(prediction.tasks.map(t => [t.id, t.status]));

  const upcomingTasks = upcomingTaskRows.map(t => ({
    name:            t.name,
    course:          t.course_name,
    category:        t.category,
    dueDate:         t.due_date,
    status:          t.status,
    plannedMinutes:  t.planned_time || 0,
    actualMinutes:   Math.round((t.actual_seconds || 0) / 60),
    predictionStatus: predictionStatusById[t.id] || null,
  }));

  const overdueTaskList = overdueTaskRows.map(t => ({
    name:        t.name,
    course:      t.course_name,
    category:    t.category,
    dueDate:     t.due_date,
    daysOverdue: Math.round((Date.parse(today) - Date.parse(t.due_date)) / 86_400_000),
  }));

  const upcomingEvents = upcomingEventRows.map(e => ({
    title: e.title,
    type:  e.type,
    date:  e.event_date,
    time:  e.event_time,
  }));

  const studyBlocksSoon = studyBlockRows.map(b => ({
    dayLabel:  b.plan_date === today ? 'Today' : 'Tomorrow',
    startTime: b.start_time,
    endTime:   b.end_time,
    topic:     b.topic,
    status:    b.status,
    taskName:  b.task_name,
    course:    b.course_name,
  }));

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
    upcomingTasks,
    overdueTaskList,
    upcomingEvents,
    studyBlocksSoon,
  };
}

const PREDICTION_LABELS = { at_risk: 'at risk of missing the deadline', on_track: 'on track' };

function fmtUpcomingTask(t) {
  const course = t.course ? `${t.course} — ` : '';
  const risk = PREDICTION_LABELS[t.predictionStatus] ? `, ${PREDICTION_LABELS[t.predictionStatus]}` : '';
  return `"${t.name}" (${course}${t.category}, ${t.status}) — due ${t.dueDate}, planned ${t.plannedMinutes}m / studied ${t.actualMinutes}m${risk}`;
}

function fmtOverdueTask(t) {
  const course = t.course ? `${t.course} — ` : '';
  return `"${t.name}" (${course}${t.category}) — due ${t.dueDate}, ${t.daysOverdue} day${t.daysOverdue === 1 ? '' : 's'} overdue`;
}

function fmtUpcomingEvent(e) {
  const time = e.time ? ` at ${e.time}` : '';
  return `"${e.title}" (${e.type}) — ${e.date}${time}`;
}

function fmtStudyBlock(b) {
  const time = b.startTime && b.endTime ? ` ${b.startTime}–${b.endTime}` : '';
  const course = b.course ? ` (${b.course})` : '';
  const topic = b.topic ? ` — ${b.topic}` : '';
  return `${b.dayLabel}${time}: "${b.taskName}"${course}${topic} [${b.status}]`;
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

  const upcomingTasksInfo = ctx.upcomingTasks.length
    ? ctx.upcomingTasks.map(t => `  - ${fmtUpcomingTask(t)}`).join('\n')
    : '  None in the next 14 days.';

  const overdueListInfo = ctx.overdueTaskList.length
    ? ctx.overdueTaskList.map(t => `  - ${fmtOverdueTask(t)}`).join('\n')
    : '  None.';

  const upcomingEventsInfo = ctx.upcomingEvents.length
    ? ctx.upcomingEvents.map(e => `  - ${fmtUpcomingEvent(e)}`).join('\n')
    : '  None in the next 14 days.';

  const studyBlocksInfo = ctx.studyBlocksSoon.length
    ? ctx.studyBlocksSoon.map(b => `  - ${fmtStudyBlock(b)}`).join('\n')
    : '  None scheduled.';

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

Upcoming tasks (next 14 days, not completed):
${upcomingTasksInfo}

Overdue tasks:
${overdueListInfo}

Upcoming events (next 14 days):
${upcomingEventsInfo}

Study blocks scheduled today/tomorrow:
${studyBlocksInfo}

Rules:
- Answer the student's actual question first and directly — do not open with an unrelated stats recap.
- Refer to specific tasks, courses, and dates from the lists above when the question calls for it, instead of speaking only in aggregates — e.g. when asked what to focus on, name the actual task/event and its date, not just a general suggestion.
- Do not restate the weekly hours/goal summary unless the question is specifically about progress or goals.
- If you already stated a specific number (weekly hours, goal, task counts) in an earlier reply in this conversation, do not repeat it again unless the student is asking about it directly — bring something new instead.
- Keep replies to 3-6 sentences.
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
async function getCourseInsight(userId, { course_name, stats, task_names = [], course_id }) {
  // Richer than task_names (which the frontend sends with no date/status):
  // this course's own upcoming tasks, same 14-day window and shape as the
  // main chat context, so the insight can name specific tasks and dates
  // rather than only the aggregate stats below. Falls back to task_names
  // alone when course_id isn't provided (older frontend build).
  let upcomingInfo = '';
  if (course_id) {
    const today = dateStrUTC(0);
    const in14  = dateStrUTC(14);
    const rows = await db.all(
      `SELECT t.name, t.due_date, t.status, t.category, t.planned_time,
              COALESCE((SELECT SUM(duration) FROM study_sessions
                        WHERE task_id = t.id AND duration IS NOT NULL), 0)::int AS actual_seconds
       FROM tasks t
       WHERE t.user_id = ? AND t.course_id = ? AND t.status != 'completed'
         AND t.due_date >= ? AND t.due_date <= ?
       ORDER BY t.due_date ASC
       LIMIT 8`,
      [userId, course_id, today, in14]
    );
    if (rows.length > 0) {
      const list = rows.map(t => {
        const actualMinutes = Math.round((t.actual_seconds || 0) / 60);
        return `"${t.name}" (${t.category}, ${t.status}) due ${t.due_date}, planned ${t.planned_time || 0}m / studied ${actualMinutes}m`;
      }).join('; ');
      upcomingInfo = ` Upcoming tasks in this course (next 14 days): ${list}.`;
    }
  }

  const taskList = task_names.length > 0
    ? `Tasks include: ${task_names.slice(0, 6).join(', ')}.`
    : '';

  const userPrompt =
    `Give me an honest 2-3 sentence assessment of my progress in "${course_name}". ` +
    `Stats: ${stats.completed_tasks} of ${stats.total_tasks} tasks completed ` +
    `(${stats.completion_pct}% completion rate), ${stats.planned_hours}h total planned time, ` +
    `${stats.actual_hours}h actually studied. ${taskList}${upcomingInfo}`;

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are an encouraging AI study coach inside Studifly. ' +
          'Give a 2-3 sentence honest, specific, and practical assessment of the student\'s progress in the given course. ' +
          'Reference their actual numbers, and if specific upcoming tasks are listed, name the most relevant one(s) by name and date instead of speaking only in aggregates. ' +
          'Use plain text only — no markdown, no bullet points, no asterisks.',
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
