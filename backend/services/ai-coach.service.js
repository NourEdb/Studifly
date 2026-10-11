const Groq = require('groq-sdk');
const db = require('../database/db');
const { currentISOWeek, getISOWeekBounds } = require('../utils/dateHelpers');
const { getTaskPredictions } = require('./prediction.service');
const { getWeeklyHours, getStreak } = require('./dashboard.service');
const { getProfile } = require('./gamification.service');
const { listMyGroups, getLeaderboard } = require('./study-groups.service');
const { finalizeCompletion } = require('../utils/textHelpers');

const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';

// Built lazily, not at module scope: the Groq SDK's constructor itself throws
// synchronously if the key is missing/empty, which previously meant the
// GROQ_API_KEY check below could never run — this whole module (and the
// server, via app.js requiring it) would already have crashed at boot.
// Constructing it only when actually needed lets our own check run first and
// return a normal per-request error instead of taking the process down.
let _groq = null;
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}

// ── Date helpers ─────────────────────────────────────────────────────────────
// "Today" for the AI Coach is anchored to Asia/Jerusalem specifically (unlike
// the rest of the app, which is UTC/Sunday-start) so that "today"/"tomorrow"
// phrasing in a live chat is never off by the few hours IL sits ahead of UTC.

function ilToday() {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' })
    .format(new Date()).split('-').map(Number);
  return { y, m, d };
}
function ilDateString(offsetDays = 0) {
  const t = ilToday();
  const base = new Date(Date.UTC(t.y, t.m - 1, t.d));
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return base.toISOString().slice(0, 10);
}
function ilTodayLabel() {
  const now = new Date();
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', weekday: 'long' }).format(now);
  const date = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', month: 'long', day: 'numeric', year: 'numeric' }).format(now);
  return `${weekday}, ${date}`;
}

// Short readable date for the prompt — the model is instructed to never show
// a raw ISO date, so every date handed to it is pre-formatted like this
// rather than relying on the instruction alone.
function fmtDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const sameYear = d.getUTCFullYear() === new Date().getUTCFullYear();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric', timeZone: 'UTC' });
}

// Mirrors frontend/src/utils/formatWeek.js's math (Sunday-start, UTC) for a
// readable "Oct 4–10" label from a backend week string like "2026-W41".
function fmtWeekLabel(weekStr) {
  const { start, end } = getISOWeekBounds(weekStr);
  const startD = new Date(start);
  const endD = new Date(end);
  endD.setUTCDate(endD.getUTCDate() - 1); // end is exclusive (next Sunday) — want the inclusive Saturday
  const startMonth = startD.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  const endMonth = endD.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  return startMonth === endMonth
    ? `${startMonth} ${startD.getUTCDate()}–${endD.getUTCDate()}`
    : `${startMonth} ${startD.getUTCDate()}–${endMonth} ${endD.getUTCDate()}`;
}

// ── Groq call wrapper ────────────────────────────────────────────────────────
// A missing key is a configuration problem, distinct from a transient failure
// — checked locally (not via Groq's own 401) so this exact message only ever
// shows when the key truly isn't set, not for some other auth issue.
// Anything else (429 rate limit, 5xx, a connection timeout) is retried once;
// if that retry also fails, the caller sees one generic, non-technical
// message instead of whatever Groq's raw error happened to say.
function isRetryableGroqError(err) {
  return err instanceof Groq.RateLimitError          // 429
    || err instanceof Groq.InternalServerError        // 5xx
    || err instanceof Groq.APIConnectionError;         // network issue or timeout (APIConnectionTimeoutError extends this)
}

const BUSY_MESSAGE = 'The AI coach is busy right now, please try again in a moment.';

async function createChatCompletion(params) {
  if (!process.env.GROQ_API_KEY) {
    const err = new Error('AI Coach is not configured — the GROQ_API_KEY environment variable is missing.');
    err.status = 503;
    throw err;
  }
  try {
    return await getGroq().chat.completions.create(params);
  } catch (err) {
    if (!isRetryableGroqError(err)) {
      console.error('[AI Coach] Groq call failed (not retryable):', err.message, '| status=', err.status);
      const friendly = new Error(BUSY_MESSAGE);
      friendly.status = err.status || 502;
      throw friendly;
    }
    console.warn('[AI Coach] Groq call failed, retrying once:', err.message, '| status=', err.status);
    try {
      return await getGroq().chat.completions.create(params);
    } catch (err2) {
      console.error('[AI Coach] Groq retry also failed:', err2.message, '| status=', err2.status);
      const friendly = new Error(BUSY_MESSAGE);
      friendly.status = err2.status || 502;
      throw friendly;
    }
  }
}

const PREDICTION_LABELS = {
  at_risk: 'at risk of missing the deadline',
  on_track: 'on track',
  overdue: 'overdue',
};

function fmtOpenTask(t) {
  const course = t.course ? `${t.course} — ` : '';
  const due = t.dueDate ? `due ${fmtDate(t.dueDate)}` : 'no due date';
  const risk = PREDICTION_LABELS[t.predictionStatus] ? `, ${PREDICTION_LABELS[t.predictionStatus]}` : '';
  return `"${t.name}" (${course}${t.category}, ${t.status}) — ${due}, planned ${t.plannedMinutes}m / studied ${t.actualMinutes}m${risk}`;
}

function fmtCourseSummary(c) {
  const last = c.lastSessionDate ? fmtDate(c.lastSessionDate) : 'never';
  const nearest = c.nearestDueDate ? fmtDate(c.nearestDueDate) : 'none';
  return `${c.name}: this week ${c.weekHours}h, last 4 weeks ${c.last4WeekHours}h, all time ${c.allTimeHours}h — last studied ${last}; ${c.openTaskCount} open task${c.openTaskCount === 1 ? '' : 's'}, nearest due ${nearest}`;
}

async function getStudyContext(userId) {
  const { start: weekStart, end: weekEnd } = getISOWeekBounds(currentISOWeek());
  const moodWindowStart = ilDateString(-13); // 14 days inclusive of today

  const [
    userRow,
    courseSessionRows,
    courseTaskRows,
    openTaskRows,
    weeklyTotals,
    moodRows,
    profile,
    streakDays,
    myGroups,
    prediction,
  ] = await Promise.all([
    db.get(`SELECT weekly_goal_hours FROM users WHERE id = ?`, [userId]),

    // (b) Per-course hours (this week / rolling last 4 weeks / all time) and
    // last session date. LEFT JOINs so a course with zero sessions still
    // shows up with all-zero numbers rather than being silently omitted.
    db.all(
      `SELECT c.id, c.name,
              COALESCE(SUM(CASE WHEN s.start_time >= ? AND s.start_time < ? THEN s.duration END), 0)::int AS week_seconds,
              COALESCE(SUM(CASE WHEN s.start_time >= NOW() - INTERVAL '28 days' THEN s.duration END), 0)::int AS last4w_seconds,
              COALESCE(SUM(s.duration), 0)::int AS alltime_seconds,
              MAX(s.start_time) AS last_session_at
       FROM courses c
       LEFT JOIN tasks t ON t.course_id = c.id
       LEFT JOIN study_sessions s ON s.task_id = t.id AND s.duration IS NOT NULL
       WHERE c.user_id = ?
       GROUP BY c.id, c.name
       ORDER BY alltime_seconds DESC
       LIMIT 10`,
      [weekStart, weekEnd, userId]
    ),
    // (b) Per-course open-task count + nearest due date, merged with the
    // above in JS below (kept separate to avoid a session/task JOIN fan-out).
    db.all(
      `SELECT course_id,
              COUNT(*) FILTER (WHERE status != 'completed')::int AS open_count,
              MIN(due_date) FILTER (WHERE status != 'completed' AND due_date IS NOT NULL) AS nearest_due
       FROM tasks WHERE user_id = ? AND course_id IS NOT NULL
       GROUP BY course_id`,
      [userId]
    ),

    // (d) EVERY open (not completed) task, not just those due soon — a task
    // with no due date at all still matters for "what should I focus on".
    db.all(
      `SELECT t.id, t.name, t.due_date, t.status, t.category, t.planned_time,
              c.name AS course_name,
              COALESCE((SELECT SUM(duration) FROM study_sessions
                        WHERE task_id = t.id AND duration IS NOT NULL), 0)::int AS actual_seconds
       FROM tasks t
       LEFT JOIN courses c ON t.course_id = c.id
       WHERE t.user_id = ? AND t.status != 'completed'
       ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC
       LIMIT 12`,
      [userId]
    ),

    // (c) The last 4 Sunday–Saturday weeks, oldest to newest — same query
    // the Dashboard's own weekly bar chart uses, so these numbers always
    // agree with what the student sees there.
    getWeeklyHours(userId, 4),

    // (e) Mood/energy for the last 14 Israel-calendar days, joined to that
    // day's study minutes (same join shape as mood.service.js's
    // getCorrelation(), just windowed to 14 days instead of all-time).
    db.all(
      `SELECT mc.mood_score, mc.energy_score,
              COALESCE(SUM(ss.duration) / 60, 0)::int AS study_minutes
       FROM mood_checkins mc
       LEFT JOIN study_sessions ss
         ON ss.user_id = mc.user_id
        AND (ss.start_time AT TIME ZONE 'UTC')::date = mc.checkin_date
        AND ss.duration IS NOT NULL
       WHERE mc.user_id = ? AND mc.checkin_date >= ?::date
       GROUP BY mc.checkin_date, mc.mood_score, mc.energy_score`,
      [userId, moodWindowStart]
    ),

    // (f) Level/XP/badges.
    getProfile(userId),
    // (f) Current streak — directly relevant to the Week Streak badge.
    getStreak(userId, 'Asia/Jerusalem'),

    // (g) Study groups — leaderboards are fetched after, once we have ids.
    listMyGroups(userId),

    getTaskPredictions(userId),
  ]);

  // --- (b) merge per-course sessions + tasks ---
  const openTasksByCourse = Object.fromEntries(courseTaskRows.map(r => [r.course_id, r]));
  const courseSummaries = courseSessionRows.map(c => {
    const taskInfo = openTasksByCourse[c.id];
    return {
      name:            c.name,
      weekHours:       Math.round(c.week_seconds / 3600 * 10) / 10,
      last4WeekHours:  Math.round(c.last4w_seconds / 3600 * 10) / 10,
      allTimeHours:    Math.round(c.alltime_seconds / 3600 * 10) / 10,
      lastSessionDate: c.last_session_at ? new Date(c.last_session_at).toISOString().slice(0, 10) : null,
      openTaskCount:   taskInfo?.open_count || 0,
      nearestDueDate:  taskInfo?.nearest_due || null,
      weekSeconds:     c.week_seconds,
    };
  });
  const overallWeekHours = Math.round(courseSummaries.reduce((sum, c) => sum + c.weekSeconds, 0) / 3600 * 10) / 10;

  // --- (d) open tasks, with the prediction service's at-risk/on-track/overdue
  // flag threaded in by task id. getTaskPredictions() covers every
  // not-completed task that has a due date, so a task here with no due date
  // simply has no matching entry (predictionStatus stays null).
  const predictionStatusById = Object.fromEntries(prediction.tasks.map(t => [t.id, t.status]));
  const openTasks = openTaskRows.map(t => ({
    name:             t.name,
    course:           t.course_name,
    category:         t.category,
    dueDate:          t.due_date,
    status:           t.status,
    plannedMinutes:   t.planned_time || 0,
    actualMinutes:    Math.round((t.actual_seconds || 0) / 60),
    predictionStatus: predictionStatusById[t.id] || null,
  }));

  // --- (e) mood/energy averages, and whether study minutes run higher on
  // high-mood (4-5) days than on lower-mood (1-3) days in the same window.
  const round1 = v => Math.round(v * 10) / 10;
  const avg = arr => arr.length ? round1(arr.reduce((s, v) => s + v, 0) / arr.length) : null;
  const avgMood   = avg(moodRows.map(r => r.mood_score));
  const avgEnergy = avg(moodRows.map(r => r.energy_score));
  const highMoodMinutes  = moodRows.filter(r => r.mood_score >= 4).map(r => r.study_minutes);
  const lowerMoodMinutes = moodRows.filter(r => r.mood_score < 4).map(r => r.study_minutes);
  const avgMinutesHighMood  = highMoodMinutes.length  ? Math.round(highMoodMinutes.reduce((s, v) => s + v, 0) / highMoodMinutes.length)  : null;
  const avgMinutesLowerMood = lowerMoodMinutes.length ? Math.round(lowerMoodMinutes.reduce((s, v) => s + v, 0) / lowerMoodMinutes.length) : null;

  // --- (g) study groups — leaderboard per group, this user's rank/hours plus
  // other members' names and aggregate hours only (never their individual
  // tasks/sessions). Resolved to a ready-to-print line here, while userId is
  // still in scope, rather than passed down as raw rows.
  const groups = await Promise.all(
    myGroups.slice(0, 5).map(async g => {
      const { leaderboard } = await getLeaderboard(userId, g.id);
      const top = leaderboard.slice(0, 8);
      const mine = top.find(r => r.user_id === userId);
      const others = top
        .filter(r => r.user_id !== userId)
        .map(r => `${r.display_name || r.username} ${r.total_hours}h (#${r.rank})`)
        .join(', ');
      return {
        name: g.name,
        myRank: mine ? mine.rank : null,
        myHours: mine ? mine.total_hours : 0,
        othersText: others || 'no one else has logged hours this week',
      };
    })
  );

  return {
    todayLabel:        ilTodayLabel(),
    weeklyGoalHours:    userRow?.weekly_goal_hours || 10,
    overallWeekHours,
    courseSummaries,
    weeklyTotals,       // [{week, total_seconds}], oldest to newest
    openTasks,
    avgMood,
    avgEnergy,
    avgMinutesHighMood,
    avgMinutesLowerMood,
    moodCheckinCount:  moodRows.length,
    level:             profile.xp.level,
    xpTotal:           profile.xp.total,
    xpInLevel:         profile.xp.xpInLevel,
    xpForLevel:        profile.xp.xpForLevel,
    earnedBadges:      profile.badges.filter(b => b.earned).map(b => b.name),
    lockedBadges:      profile.badges.filter(b => !b.earned).map(b => ({ name: b.name, description: b.description })),
    streakDays,
    groups,
  };
}

function buildSystemPrompt(ctx) {
  const courseInfo = ctx.courseSummaries.length
    ? ctx.courseSummaries.map(c => `  - ${fmtCourseSummary(c)}`).join('\n')
    : '  No courses yet.';

  const weeklyTotalsInfo = ctx.weeklyTotals.length
    ? ctx.weeklyTotals.map(w => `${fmtWeekLabel(w.week)}: ${(w.total_seconds / 3600).toFixed(1)}h`).join(', ')
    : 'No session history yet.';

  const openTasksInfo = ctx.openTasks.length
    ? ctx.openTasks.map(t => `  - ${fmtOpenTask(t)}`).join('\n')
    : '  None — no open tasks.';

  const moodInfo = ctx.moodCheckinCount > 0
    ? `Last 14 days (${ctx.moodCheckinCount} check-in${ctx.moodCheckinCount === 1 ? '' : 's'}): average mood ${ctx.avgMood}/5, average energy ${ctx.avgEnergy}/5. ` +
      `Average study minutes on high-mood days (4-5): ${ctx.avgMinutesHighMood ?? 'no data'}. Average study minutes on lower-mood days (1-3): ${ctx.avgMinutesLowerMood ?? 'no data'}.`
    : 'No mood check-ins in the last 14 days.';

  const earnedInfo = ctx.earnedBadges.length ? ctx.earnedBadges.join(', ') : 'none yet';
  const lockedInfo = ctx.lockedBadges.length
    ? ctx.lockedBadges.map(b => `${b.name} (${b.description})`).join('; ')
    : 'none — all badges earned';

  const groupsText = ctx.groups.length
    ? ctx.groups.map(g => `"${g.name}": you are rank #${g.myRank ?? '-'} with ${g.myHours}h this week; others: ${g.othersText}`).join('\n  ')
    : 'Not a member of any study group.';

  return `You are an encouraging AI study coach inside Studifly, a study-tracking app.
Your job is to give short, practical, personalized advice based on the student's real data — never generic advice when specific data is available.

Today is ${ctx.todayLabel} (Israel time). This week so far: ${ctx.overallWeekHours}h studied toward a ${ctx.weeklyGoalHours}h weekly goal.

Per-course summary:
${courseInfo}

Weekly totals, last 4 weeks (oldest to newest): ${weeklyTotalsInfo}

All open tasks (not completed):
${openTasksInfo}

Mood and energy: ${moodInfo}

Gamification: Level ${ctx.level} (${ctx.xpTotal} XP total). ${ctx.xpInLevel} of ${ctx.xpForLevel} XP earned toward Level ${ctx.level + 1} — ${ctx.xpForLevel - ctx.xpInLevel} XP remaining. Current streak: ${ctx.streakDays} day${ctx.streakDays === 1 ? '' : 's'}. Earned badges: ${earnedInfo}. Locked badges (how to earn each): ${lockedInfo}.

Study groups:
  ${groupsText}

Rules:
- The FIRST sentence of your reply must address the student's CURRENT question. Never open by recapping, restating, or summarizing an earlier question or your own earlier reply in this conversation — for example, if your previous reply covered tomorrow's plan, do not repeat that plan before answering a new, unrelated question. Earlier turns are for your own reference only, never something to re-explain.
- Name specific courses, tasks, and dates from the context above when relevant — never speak only in vague generalities when concrete context exists.
- Always write dates in a short readable form (e.g. "Oct 14"), never in ISO format (never write something like "2026-10-14").
- Use only the numbers given in the context above. If the question needs a number that isn't in the context, say plainly that you don't have that data instead of estimating or guessing.
- If the student has little or no data yet, say so plainly and give practical getting-started advice — never invent numbers to fill the gap.
- For a question unrelated to studying (including general-knowledge questions), answer it briefly and correctly using your own knowledge, then steer the conversation back to study planning — never claim not to know a well-known fact.
- Do not restate the weekly hours/goal summary unless the question is specifically about progress or goals.
- Keep replies to 3-6 sentences.
- Be warm and encouraging, not generic.
- Plain text only — no markdown, no bullet symbols, no asterisks.`;
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

  // A reminder placed right before the new question lands closer to where the
  // model generates its reply than the same instruction buried earlier in the
  // system prompt — this measurably cut down on the model otherwise opening
  // by recapping the previous turn's topic before answering the new one.
  // Only needed once there's prior history to possibly recap.
  const groqMessages = [
    { role: 'system', content: buildSystemPrompt(ctx) },
    ...recentContext,
    ...(recentContext.length > 0
      ? [{ role: 'system', content: 'Reminder: the next message is a new, separate question. Answer only it — do not recap or reference the topic of your previous reply.' }]
      : []),
    { role: 'user', content: newUserMessage },
  ];

  const completion = await createChatCompletion({
    model: GROQ_MODEL,
    messages: groqMessages,
    // openai/gpt-oss-20b is a reasoning model — reasoning tokens are drawn
    // from the same budget as the visible reply, so a low ceiling here could
    // leave the reply cut off mid-sentence/word even though the system
    // prompt only asks for 3-6 sentences. max_completion_tokens (not the
    // deprecated max_tokens) covers reasoning + reply together;
    // reasoning_effort: 'low' keeps reasoning brief so more of that budget
    // goes to the actual answer.
    max_completion_tokens: 1500,
    reasoning_effort: 'medium',
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
  // this course's own upcoming tasks, so the insight can name specific tasks
  // and dates rather than only the aggregate stats below. Falls back to
  // task_names alone when course_id isn't provided (older frontend build).
  let upcomingInfo = '';
  if (course_id) {
    const today = ilDateString(0);
    const in14  = ilDateString(14);
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
        return `"${t.name}" (${t.category}, ${t.status}) due ${fmtDate(t.due_date)}, planned ${t.planned_time || 0}m / studied ${actualMinutes}m`;
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

  const completion = await createChatCompletion({
    model: GROQ_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are an encouraging AI study coach inside Studifly. ' +
          'Give a 2-3 sentence honest, specific, and practical assessment of the student\'s progress in the given course. ' +
          'Reference their actual numbers, and if specific upcoming tasks are listed, name the most relevant one(s) by name and date (written like "Oct 14", never ISO format) instead of speaking only in aggregates. ' +
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
