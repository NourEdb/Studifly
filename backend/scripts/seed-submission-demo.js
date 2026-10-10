'use strict';

/**
 * Creates a two-account demo (a student + one friend) for an instructor demo,
 * directly against whatever DATABASE_URL points at (the shared production
 * database, normally). Safe by construction: every write is scoped to the
 * two user ids this script itself looks up or creates, the whole run is one
 * transaction, and no other user's rows are ever touched.
 *
 * Usage (Windows PowerShell):
 *
 *   Normal run — creates "studifly_demo" and "studifly_friend" if
 *   "studifly_demo" doesn't exist yet; otherwise prints a message and exits
 *   without changing anything:
 *
 *     $env:DEMO_PASSWORD = "<a password>"
 *     $env:DEMO_FRIEND_PASSWORD = "<a password>"
 *     node backend/scripts/seed-submission-demo.js
 *
 *   Refresh — wipes ONLY rows owned by those two accounts (sessions, blocks,
 *   tasks, courses, events, mood check-ins, XP/badges, AI messages, their one
 *   friendship, their "Exam Prep" group) and recreates everything with dates
 *   anchored to today:
 *
 *     $env:DEMO_PASSWORD = "<a password>"
 *     $env:DEMO_FRIEND_PASSWORD = "<a password>"
 *     node backend/scripts/seed-submission-demo.js --refresh
 *
 * Both env vars are required in both modes — the script refuses to run
 * without them. Set them in the current shell only; never hard-code them.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const REFRESH = process.argv.includes('--refresh');

const DEMO_PASSWORD = process.env.DEMO_PASSWORD;
const DEMO_FRIEND_PASSWORD = process.env.DEMO_FRIEND_PASSWORD;
if (!DEMO_PASSWORD || !DEMO_FRIEND_PASSWORD) {
  console.error('Refusing to run: set DEMO_PASSWORD and DEMO_FRIEND_PASSWORD in the environment first.');
  process.exit(1);
}

const DEMO_USERNAME = 'studifly_demo';
const DEMO_EMAIL = 'studifly.reminders+demo@gmail.com';
const DEMO_DISPLAY_NAME = 'Demo Student';

const FRIEND_USERNAME = 'studifly_friend';
const FRIEND_EMAIL = 'studifly.reminders+friend@gmail.com';
const FRIEND_DISPLAY_NAME = 'Maya';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

function pgify(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// ── Date helpers ─────────────────────────────────────────────────────────────
// Calendar-day math ("today", "N days ago/from now") is anchored to
// Asia/Jerusalem, matching how the rest of the app defines "today" for a
// given timezone (see dashboard.service.js's getStreak()). The hour-of-day
// for session timestamps is then chosen directly in UTC, because that's what
// the app's own badge and heatmap logic reads — see sessionStart() below.
//
// SIGN CONVENTION, and it matters: every `days` argument below is an OFFSET
// that is ADDED to today. Future = positive, past = NEGATIVE. The session and
// mood tables below are written in "days ago" (positive) for readability, so
// their call sites negate explicitly.
function ilToday() {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' })
    .format(new Date()).split('-').map(Number);
  return { y, m, d };
}
function ilDateOffset(days) {
  const t = ilToday();
  const base = new Date(Date.UTC(t.y, t.m - 1, t.d));
  base.setUTCDate(base.getUTCDate() + days);
  return { y: base.getUTCFullYear(), m: base.getUTCMonth() + 1, d: base.getUTCDate() };
}
function pad2(n) { return String(n).padStart(2, '0'); }
function ilDateString(days) {
  const { y, m, d } = ilDateOffset(days);
  return `${y}-${pad2(m)}-${pad2(d)}`;
}
function utcInstant(days, hourUTC, minuteUTC = 0) {
  const { y, m, d } = ilDateOffset(days);
  return new Date(Date.UTC(y, m - 1, d, hourUTC, minuteUTC, 0));
}
// utcInstant(), but never returns a moment in the future.
//
// The only legitimate overshoot is the IL/UTC rollover: IL runs 2-3h ahead of
// UTC, so for the last 2-3 hours of each UTC day "IL today" is already "UTC
// tomorrow", and a session placed late on IL-today can sit a few hours past
// now. That small case gets nudged back. A larger overshoot means `days` was
// passed with the wrong sign — which previously collapsed every affected
// session into an identical pile of "now" timestamps instead of failing, so
// it throws now rather than silently producing unusable demo data.
const MAX_FUTURE_NUDGE_MS = 6 * 3_600_000;
function sessionStart(days, hourUTC, minuteUTC = 0) {
  const candidate = utcInstant(days, hourUTC, minuteUTC);
  const overshootMs = candidate.getTime() - Date.now();
  if (overshootMs <= 0) return candidate;
  if (overshootMs <= MAX_FUTURE_NUDGE_MS) return new Date(Date.now() - 5 * 60_000);
  throw new Error(
    `sessionStart(days=${days}, ${hourUTC}:${pad2(minuteUTC)}) resolves ` +
    `${Math.round(overshootMs / 3_600_000)}h into the future — a past offset must be negative.`
  );
}

// ── Demo data definitions ────────────────────────────────────────────────────

const COURSES = [
  { name: 'Calculus II',        color: '#6C4DC4' },
  { name: 'Organic Chemistry',  color: '#4A9FE0' },
  { name: 'Data Structures',    color: '#34C68A' },
  { name: 'English Literature', color: '#E87AB0' },
  { name: 'Statistics',         color: '#F5C842' },
];

// due: days from today (negative = past), or null = undated. planned is in
// MINUTES (tasks.planned_time's actual unit — see tasks.service.js).
const TASKS = [
  { key: 't1',  course: 'Calculus II',        name: 'Midterm Exam Review',                     activity: 'reading',  category: 'exam',     planned: 180, status: 'completed',   due: -10 },
  { key: 't2',  course: 'Calculus II',        name: 'Problem Set 7',                            activity: 'practice', category: 'homework', planned: 90,  status: 'completed',   due: -7 },
  { key: 't3',  course: 'Organic Chemistry',  name: 'Lab Report: Esters',                       activity: 'practice', category: 'homework', planned: 120, status: 'completed',   due: -5 },
  { key: 't4',  course: 'Organic Chemistry',  name: 'Midterm Exam',                             activity: 'reading',  category: 'exam',     planned: 150, status: 'completed',   due: -3 },
  { key: 't5',  course: 'Data Structures',    name: 'Binary Tree Implementation',               activity: 'practice', category: 'project',  planned: 240, status: 'completed',   due: -2 },
  { key: 't6',  course: 'Data Structures',    name: 'Linked List Assignment',                   activity: 'practice', category: 'homework', planned: 100, status: 'completed',   due: -14 },
  { key: 't7',  course: 'English Literature', name: 'Essay: Hamlet Analysis',                   activity: 'reading',  category: 'homework', planned: 150, status: 'completed',   due: -9 },
  { key: 't8',  course: 'Statistics',         name: 'Chapter 3 Practice Problems',              activity: 'practice', category: 'homework', planned: 60,  status: 'completed',   due: null },
  { key: 't9',  course: 'Calculus II',        name: 'Final Project: Optimization Models',       activity: 'practice', category: 'project',  planned: 300, status: 'in_progress', due: 10 },
  { key: 't10', course: 'Data Structures',    name: 'Graph Algorithms Project',                 activity: 'practice', category: 'project',  planned: 240, status: 'in_progress', due: 7 },
  { key: 't11', course: 'Organic Chemistry',  name: 'Research Proposal Outline',                activity: 'reading',  category: 'other',    planned: 90,  status: 'in_progress', due: null },
  { key: 't12', course: 'English Literature', name: 'Final Exam',                               activity: 'reading',  category: 'exam',     planned: 200, status: 'pending',     due: 3 },
  { key: 't13', course: 'Statistics',         name: 'Homework Set 5',                           activity: 'practice', category: 'homework', planned: 80,  status: 'pending',     due: 5 },
  { key: 't14', course: 'Calculus II',        name: 'Overdue Worksheet: Integration by Parts',  activity: 'practice', category: 'other',    planned: 45,  status: 'pending',     due: -4 },
  { key: 't15', course: 'Organic Chemistry',  name: 'Group Project: Synthesis Pathway',          activity: 'practice', category: 'project',  planned: 200, status: 'pending',     due: 15 },
];

// day: days from today for plan_date (negative = last week, null = unscheduled).
// planned is in minutes. actualStart/actualEnd are HH:MM, only set when status
// isn't 'pending'.
const BLOCKS = [
  // Task 9 — Calculus II Final Project (in_progress, due in 10 days)
  { key: 'b9a',  task: 't9',  topic: 'Define objective function',   planned: 90,  day: -9,   start: '10:00', end: '11:30', status: 'completed',   pct: 100, actualStart: '10:05', actualEnd: '11:35' },
  { key: 'b9b',  task: 't9',  topic: 'Build constraint equations',  planned: 90,  day: -3,   start: '14:00', end: '15:30', status: 'completed',   pct: 90,  actualStart: '14:00', actualEnd: '15:25' },
  { key: 'b9c',  task: 't9',  topic: 'Write up solution & present', planned: 120, day: 2,    start: '11:00', end: '13:00', status: 'pending',     pct: null, actualStart: null,   actualEnd: null },

  // Task 10 — Data Structures Graph Algorithms Project (in_progress, due in 7 days)
  { key: 'b10a', task: 't10', topic: 'Implement BFS/DFS',           planned: 70,  day: -11,  start: '13:00', end: '14:15', status: 'completed',   pct: 100, actualStart: '13:00', actualEnd: '14:10' },
  { key: 'b10b', task: 't10', topic: 'Implement Dijkstra',          planned: 90,  day: -5,   start: '10:00', end: '11:30', status: 'in_progress', pct: 60,  actualStart: '10:00', actualEnd: '11:05' },
  { key: 'b10c', task: 't10', topic: 'Testing & edge cases',        planned: 60,  day: null, start: null,   end: null,    status: 'pending',     pct: null, actualStart: null,   actualEnd: null },

  // Task 5 — Data Structures Binary Tree (already completed, due 2 days ago)
  { key: 'b5a',  task: 't5',  topic: 'Core insert/delete methods',  planned: 100, day: -13,  start: '09:00', end: '10:40', status: 'completed',   pct: 100, actualStart: '09:00', actualEnd: '10:35' },
  { key: 'b5b',  task: 't5',  topic: 'Traversal methods + tests',   planned: 90,  day: -1,   start: '09:00', end: '10:30', status: 'completed',   pct: 100, actualStart: '09:00', actualEnd: '10:20' },

  // Task 15 — Organic Chemistry Group Project (pending, due in 15 days)
  { key: 'b15a', task: 't15', topic: 'Research synthesis routes',  planned: 90,  day: null, start: null,   end: null,    status: 'pending',     pct: null, actualStart: null,   actualEnd: null },
  { key: 'b15b', task: 't15', topic: 'Draft pathway diagram',      planned: 60,  day: 4,    start: '16:00', end: '17:00', status: 'pending',     pct: null, actualStart: null,   actualEnd: null },
];

// [daysBack, hourUTC, minuteUTC, studyMin, breakMin, linkType, linkKey, focus, difficulty, completionAnswer, taskMarkedDone]
// daysBack is POSITIVE days-in-the-past; it is negated at the call site (see
// the sign convention note above the date helpers).
// linkType is 'task' (links study_sessions.task_id directly) or 'block'
// (links study_sessions.study_block_id — task_id is still set, to the
// block's parent, matching how the real timer starts a subtask session).
const DEMO_SESSIONS = [
  // --- Unbroken 7-day streak ending today (daysBack 0..6) — Week Streak badge ---
  [0, 16,  0, 70,  5, 'task',  't1',   4, 3, 'yes',       true],
  [1,  9,  0, 60,  0, 'block', 'b5b',  5, 2, 'yes',       true],
  [2, 14,  0, 80, 10, 'task',  't3',   3, 3, 'yes',       true],
  [3, 11,  0, 90,  5, 'block', 'b9b',  4, 4, 'partially', false],
  [4, 18,  0, 50,  0, 'task',  't6',   4, 2, 'yes',       true],
  [5, 10,  0, 65,  5, 'block', 'b10b', 3, 4, 'partially', false],
  [6, 15,  0, 75,  0, 'task',  't7',   5, 2, 'yes',       true],

  // --- History across weeks 2-5 back — heatmap/bar-chart spread ---
  [8,  15,  0, 55,  0, 'task',  't2',   4, 3, 'yes',  true],
  [9,  10,  0, 85,  5, 'block', 'b9a',  4, 3, 'yes',  true],
  [10, 22, 30, 40,  0, 'task',  't2',   3, 3, null,   false], // Night Owl badge: UTC hour >= 22
  [11, 13,  0, 70,  0, 'block', 'b10a', 4, 2, 'yes',  true],
  [12,  6, 15, 35,  0, 'task',  't4',   4, 2, null,   false], // Early Bird badge: UTC hour < 8
  [13,  9,  0, 95, 10, 'block', 'b5a',  5, 3, 'yes',  true],
  [16, 17,  0, 55,  0, 'task',  't8',   3, 2, 'yes',  true],
  [20, 12,  0, 65,  5, 'task',  't1',   4, 3, 'partially', false],
  [24, 19,  0, 50,  0, 'task',  't6',   3, 3, 'yes',  true],
  [28, 10,  0, 70,  5, 'task',  't3',   4, 2, 'partially', false],
  [32, 14,  0, 60,  0, 'task',  't7',   3, 3, 'yes',  true],
  [35, 11,  0, 80, 10, 'task',  't4',   4, 3, 'yes',  true],
];

// Friend's own sessions this week (task-less, same shape minus the link columns).
const FRIEND_SESSIONS = [
  [0, 17, 0, 45, 0],
  [1, 10, 0, 60, 5],
  [3, 15, 0, 50, 0],
];

const MOOD_NOTES = [
  'Felt sharp today, got through everything I planned.',
  null,
  'Dragging a bit but still showed up.',
  'Good focus in the afternoon session.',
  null,
  'Rest day — needed it.',
  'Back on track, steady pace.',
];

// ── DB helpers (bound to the transaction client) ────────────────────────────

function makeQuery(client) {
  async function q(sql, params = []) {
    const { rows } = await client.query(pgify(sql), params);
    return rows;
  }
  async function one(sql, params = []) {
    const rows = await q(sql, params);
    return rows[0] || null;
  }
  return { q, one };
}

async function wipeOwnedData(q, ids) {
  await q('DELETE FROM study_sessions WHERE user_id = ANY(?::int[])', [ids]);
  await q('DELETE FROM study_blocks WHERE user_id = ANY(?::int[])', [ids]);
  await q('DELETE FROM tasks WHERE user_id = ANY(?::int[])', [ids]);
  await q('DELETE FROM courses WHERE user_id = ANY(?::int[])', [ids]);
  await q('DELETE FROM events WHERE user_id = ANY(?::int[])', [ids]);
  await q('DELETE FROM mood_checkins WHERE user_id = ANY(?::int[])', [ids]);
  await q('DELETE FROM ai_coach_messages WHERE user_id = ANY(?::int[])', [ids]);
  await q('DELETE FROM xp_log WHERE user_id = ANY(?::int[])', [ids]);
  await q('DELETE FROM user_badges WHERE user_id = ANY(?::int[])', [ids]);
  await q('DELETE FROM user_xp WHERE user_id = ANY(?::int[])', [ids]);
  // Only the ONE friendship between these two specific ids (both directions,
  // in case it was stored the other way round) — never every friendship
  // either id happens to be a party to.
  if (ids.length === 2) {
    await q(
      `DELETE FROM friendships
       WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`,
      [ids[0], ids[1], ids[1], ids[0]]
    );
  }
  // Only study groups THEY created (membership cascades via the FK) — never a
  // group created by someone else that either of them merely joined.
  await q('DELETE FROM study_groups WHERE created_by = ANY(?::int[])', [ids]);
}

async function upsertUser(q, { existingId, username, email, displayName, passwordPlain, weeklyGoalHours, emailRemindersEnabled }) {
  const hash = bcrypt.hashSync(passwordPlain, 10);

  if (existingId) {
    const fields = ['password_hash = ?', 'email = ?', 'display_name = ?'];
    const params = [hash, email, displayName];
    if (weeklyGoalHours !== undefined) { fields.push('weekly_goal_hours = ?'); params.push(weeklyGoalHours); }
    if (emailRemindersEnabled !== undefined) { fields.push('email_reminders_enabled = ?'); params.push(emailRemindersEnabled); }
    params.push(existingId);
    await q(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
    return existingId;
  }

  const cols = ['username', 'email', 'password_hash', 'display_name'];
  const vals = [username, email, hash, displayName];
  if (weeklyGoalHours !== undefined) { cols.push('weekly_goal_hours'); vals.push(weeklyGoalHours); }
  if (emailRemindersEnabled !== undefined) { cols.push('email_reminders_enabled'); vals.push(emailRemindersEnabled); }
  const row = await q(
    `INSERT INTO users (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(',')}) RETURNING id`,
    vals
  );
  return row[0].id;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { q, one } = makeQuery(client);

    // Exact-username lookups only — never a pattern match — so this can never
    // accidentally resolve to the wrong account.
    const existingDemo  = await one('SELECT id FROM users WHERE username = ?', [DEMO_USERNAME]);
    const existingFriend = await one('SELECT id FROM users WHERE username = ?', [FRIEND_USERNAME]);

    if (existingDemo && !REFRESH) {
      console.log(`"${DEMO_USERNAME}" already exists (id=${existingDemo.id}). Nothing to do — pass --refresh to wipe and recreate its demo data.`);
      await client.query('ROLLBACK');
      return;
    }

    if (REFRESH) {
      const idsToWipe = [existingDemo?.id, existingFriend?.id].filter(Boolean);
      console.log(`--refresh: "${DEMO_USERNAME}" ${existingDemo ? `id=${existingDemo.id}` : '(not found)'}, "${FRIEND_USERNAME}" ${existingFriend ? `id=${existingFriend.id}` : '(not found)'}.`);
      if (idsToWipe.length) {
        console.log(`Deleting owned rows for id(s): ${idsToWipe.join(', ')}`);
        await wipeOwnedData(q, idsToWipe);
      } else {
        console.log('Neither account exists yet — nothing to wipe, creating fresh.');
      }
    }

    const demoId = await upsertUser(q, {
      existingId: existingDemo?.id,
      username: DEMO_USERNAME,
      email: DEMO_EMAIL,
      displayName: DEMO_DISPLAY_NAME,
      passwordPlain: DEMO_PASSWORD,
      weeklyGoalHours: 12,
      emailRemindersEnabled: true,
    });
    const friendId = await upsertUser(q, {
      existingId: existingFriend?.id,
      username: FRIEND_USERNAME,
      email: FRIEND_EMAIL,
      displayName: FRIEND_DISPLAY_NAME,
      passwordPlain: DEMO_FRIEND_PASSWORD,
    });
    console.log(`Using demo id=${demoId}, friend id=${friendId}`);

    // Courses
    const courseId = {};
    for (const c of COURSES) {
      const row = await one('INSERT INTO courses (user_id, name, color) VALUES (?,?,?) RETURNING id', [demoId, c.name, c.color]);
      courseId[c.name] = row.id;
    }

    // Tasks
    const taskId = {};
    for (const t of TASKS) {
      const dueDate = t.due === null ? null : ilDateString(t.due);
      const completedAt = t.status === 'completed' ? sessionStart(t.due !== null ? t.due : -1, 12) : null;
      const row = await one(
        `INSERT INTO tasks (user_id, course_id, name, activity_type, category, planned_time, status, due_date, completed_at)
         VALUES (?,?,?,?,?,?,?,?,?) RETURNING id`,
        [demoId, courseId[t.course], t.name, t.activity, t.category, t.planned, t.status, dueDate, completedAt]
      );
      taskId[t.key] = row.id;
    }

    // Subtasks (study blocks)
    const blockId = {};
    for (const b of BLOCKS) {
      const planDate = b.day === null ? null : ilDateString(b.day);
      const completedAt = b.status === 'completed' ? sessionStart(b.day, 12) : null;
      const row = await one(
        `INSERT INTO study_blocks
           (user_id, task_id, plan_date, start_time, end_time, topic, planned_time, actual_start, actual_end, completion_pct, status, completed_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`,
        [demoId, taskId[b.task], planDate, b.start, b.end, b.topic, b.planned, b.actualStart, b.actualEnd, b.pct, b.status, completedAt]
      );
      blockId[b.key] = row.id;
    }

    // Study sessions — tracks per-day minutes for the mood correlation below,
    // and accumulates session-based XP (+10 per 30 min, matching
    // gamification.service.js's onSessionComplete()).
    const minutesByDaysBack = {};
    const xpLogRows = [];
    const insertedUtcHours = new Set();
    for (const [daysBack, hourUTC, minuteUTC, studyMin, breakMin, linkType, linkKey, focus, difficulty, completionAnswer, taskMarkedDone] of DEMO_SESSIONS) {
      const start = sessionStart(-daysBack, hourUTC, minuteUTC);
      const end = new Date(start.getTime() + (studyMin + breakMin) * 60_000);
      const duration = studyMin * 60;
      const breakSeconds = breakMin * 60;
      const linkedBlockId = linkType === 'block' ? blockId[linkKey] : null;
      const parentTaskId = linkType === 'block' ? taskId[BLOCKS.find(b => b.key === linkKey).task] : taskId[linkKey];
      const status = completionAnswer === 'yes' ? 'completed' : completionAnswer === 'partially' ? 'partial' : null;

      // is_manual = 0 — these read as timer-tracked sessions in the Tracker
      // history, not flagged "manual", matching what a real study session
      // would look like.
      const session = await one(
        `INSERT INTO study_sessions
           (user_id, task_id, study_block_id, start_time, end_time, duration, break_seconds, is_manual,
            focus_score, difficulty_rating, completion_answer, task_marked_done, status)
         VALUES (?,?,?,?,?,?,?,0,?,?,?,?,?) RETURNING id`,
        [demoId, parentTaskId, linkedBlockId, start, end, duration, breakSeconds, focus, difficulty, completionAnswer, taskMarkedDone ? 1 : 0, status]
      );

      minutesByDaysBack[daysBack] = (minutesByDaysBack[daysBack] || 0) + studyMin;
      insertedUtcHours.add(start.getUTCHours());

      const units = Math.floor(duration / 1800);
      if (units > 0) xpLogRows.push({ amount: units * 10, refType: 'session', refId: String(session.id) });
    }

    // Friend's sessions this week (populate the study-group leaderboard)
    for (const [daysBack, hourUTC, minuteUTC, studyMin, breakMin] of FRIEND_SESSIONS) {
      const start = sessionStart(-daysBack, hourUTC, minuteUTC);
      const end = new Date(start.getTime() + (studyMin + breakMin) * 60_000);
      await q(
        `INSERT INTO study_sessions (user_id, task_id, start_time, end_time, duration, break_seconds, is_manual)
         VALUES (?,NULL,?,?,?,?,0)`,
        [friendId, start, end, studyMin * 60, breakMin * 60]
      );
    }

    // Mood check-ins — last 14 IL calendar days, loosely tracking that day's
    // study minutes. utcInstant()'s (y,m,d) IS the UTC calendar date too
    // (the hour component never rolls the date over), so checkin_date lines
    // up with the UTC date getCorrelation() groups sessions by — see
    // mood.service.js.
    for (let d = 0; d <= 13; d++) {
      const minutes = minutesByDaysBack[d] || 0;
      let mood = 3, energy = 3;
      if (minutes >= 90)      { mood = 5; energy = 5; }
      else if (minutes >= 45) { mood = 4; energy = 4; }
      else if (minutes === 0) { mood = d % 2 === 0 ? 2 : 3; energy = d % 2 === 0 ? 2 : 3; }
      const note = d % 2 === 0 ? MOOD_NOTES[d % MOOD_NOTES.length] : null;
      await q(
        `INSERT INTO mood_checkins (user_id, mood_score, energy_score, note, checkin_date)
         VALUES (?,?,?,?,?) ON CONFLICT (user_id, checkin_date) DO NOTHING`,
        [demoId, mood, energy, note, ilDateString(-d)]
      );
    }

    // Events — one due tomorrow so the reminder job has something to catch live
    await q(
      `INSERT INTO events (user_id, title, type, notes, event_date, event_time) VALUES (?,?,?,?,?,?)`,
      [demoId, 'Statistics Midterm', 'exam', 'Covers chapters 1-5. Bring a calculator.', ilDateString(1), '09:00']
    );
    await q(
      `INSERT INTO events (user_id, title, type, notes, event_date, event_time) VALUES (?,?,?,?,?,?)`,
      [demoId, 'Research Proposal Submission', 'deadline', null, ilDateString(5), '23:59']
    );
    await q(
      `INSERT INTO events (user_id, title, type, notes, event_date, event_time) VALUES (?,?,?,?,?,?)`,
      [demoId, "Dentist appointment", 'personal', null, ilDateString(2), '15:30']
    );

    // Friendship + study group
    await q(
      `INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?,?,'accepted')
       ON CONFLICT (requester_id, addressee_id) DO NOTHING`,
      [demoId, friendId]
    );
    const group = await one(`INSERT INTO study_groups (name, created_by) VALUES (?,?) RETURNING id`, ['Exam Prep', demoId]);
    await q(`INSERT INTO study_group_members (group_id, user_id) VALUES (?,?) ON CONFLICT DO NOTHING`, [group.id, demoId]);
    await q(`INSERT INTO study_group_members (group_id, user_id) VALUES (?,?) ON CONFLICT DO NOTHING`, [group.id, friendId]);

    // XP: +50 per completed task, plus the session XP accumulated above.
    // Goal Crusher is deliberately NOT forced — it's only earned if the
    // logged hours genuinely clear the 12h weekly goal, same as production.
    for (const t of TASKS) {
      if (t.status === 'completed') xpLogRows.push({ amount: 50, refType: 'task', refId: String(taskId[t.key]) });
    }
    let totalXp = 0;
    for (const r of xpLogRows) {
      await q(
        `INSERT INTO xp_log (user_id, amount, ref_type, ref_id) VALUES (?,?,?,?)
         ON CONFLICT (user_id, ref_type, ref_id) DO NOTHING`,
        [demoId, r.amount, r.refType, r.refId]
      );
      totalXp += r.amount;
    }
    await q(
      `INSERT INTO user_xp (user_id, total_xp, updated_at) VALUES (?,?,NOW())
       ON CONFLICT (user_id) DO UPDATE SET total_xp = ?, updated_at = NOW()`,
      [demoId, totalXp, totalXp]
    );

    // Badges — derived from the timestamps that were actually written, read
    // back from the DB with the same predicates gamification.service.js uses.
    // Reading the source arrays instead would let a badge be awarded that the
    // real data doesn't support (which is exactly what a date sign error in an
    // earlier version of this script produced).
    const streakRow = await one(
      `SELECT COUNT(DISTINCT (start_time AT TIME ZONE 'UTC')::date)::int AS study_days
       FROM study_sessions
       WHERE user_id = ?
         AND (start_time AT TIME ZONE 'UTC')::date >= (NOW() AT TIME ZONE 'UTC')::date - INTERVAL '6 days'`,
      [demoId]
    );
    const completedTasks = await one(
      `SELECT COUNT(*)::int AS n FROM tasks WHERE user_id = ? AND status = 'completed'`,
      [demoId]
    );

    const badgesToAward = [];
    if (completedTasks.n > 0) badgesToAward.push('first_task');
    if (streakRow.study_days >= 7) badgesToAward.push('week_streak');
    if ([...insertedUtcHours].some(h => h >= 22)) badgesToAward.push('night_owl');
    if ([...insertedUtcHours].some(h => h < 8)) badgesToAward.push('early_bird');

    // Any of these missing means the generated sessions no longer back the
    // badges this demo is supposed to show — fail rather than ship a demo
    // that's quietly missing a feature.
    const expectedBadges = ['first_task', 'week_streak', 'night_owl', 'early_bird'];
    const missing = expectedBadges.filter(b => !badgesToAward.includes(b));
    if (missing.length) {
      throw new Error(
        `Generated data does not earn: ${missing.join(', ')}. ` +
        `streak_days=${streakRow.study_days}, completed_tasks=${completedTasks.n}, ` +
        `session UTC hours=[${[...insertedUtcHours].sort((a, b) => a - b).join(',')}]`
      );
    }

    for (const key of badgesToAward) {
      await q(`INSERT INTO user_badges (user_id, badge_key) VALUES (?,?) ON CONFLICT (user_id, badge_key) DO NOTHING`, [demoId, key]);
    }
    await q(`UPDATE users SET pinned_badge = ? WHERE id = ?`, ['week_streak', demoId]);

    await client.query('COMMIT');

    console.log('\nDemo data ready:');
    console.log(`  Courses: ${COURSES.length}`);
    console.log(`  Tasks: ${TASKS.length} (${TASKS.filter(t => t.status === 'completed').length} completed, ${TASKS.filter(t => t.status === 'in_progress').length} in progress, ${TASKS.filter(t => t.status === 'pending').length} pending)`);
    console.log(`  Subtasks: ${BLOCKS.length}`);
    console.log(`  Study sessions: ${DEMO_SESSIONS.length} (demo) + ${FRIEND_SESSIONS.length} (friend)`);
    console.log(`  Mood check-ins: 14`);
    console.log(`  Events: 3 (1 exam due tomorrow, 1 deadline, 1 personal)`);
    console.log(`  Study group: "Exam Prep" (2 members)`);
    console.log(`  XP: ${totalXp} | Badges: ${badgesToAward.join(', ')} (pinned: week_streak)`);
    console.log('\nLogin usernames (passwords are whatever you set in the env vars):');
    console.log(`  ${DEMO_USERNAME}`);
    console.log(`  ${FRIEND_USERNAME}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed — rolled back, no changes were made:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  // Should be unreachable — main() already catches everything internally —
  // but kept as a safety net so an unexpected rejection never surfaces as an
  // unhandled promise rejection.
  console.error('Unexpected failure:', err.message);
  process.exitCode = 1;
});
