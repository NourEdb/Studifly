const db = require('../database/db');
const { currentISOWeek, getISOWeekBounds } = require('../utils/dateHelpers');

const XP_PER_LEVEL = 200;

const BADGE_DEFS = [
  { key: 'first_task',    name: 'First Task',    icon: '🎯', description: 'Complete your first task' },
  { key: 'week_streak',   name: 'Week Streak',   icon: '🔥', description: 'Study at least once every day for 7 days' },
  { key: 'goal_crusher',  name: 'Goal Crusher',  icon: '💪', description: 'Reach your weekly study goal (10 h)' },
  { key: 'night_owl',     name: 'Night Owl',     icon: '🦉', description: 'Study after 10 PM' },
  { key: 'early_bird',    name: 'Early Bird',    icon: '🐦', description: 'Study before 8 AM' },
];

function computeLevel(totalXp) {
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  return {
    level,
    xpInLevel: totalXp % XP_PER_LEVEL,
    xpForLevel: XP_PER_LEVEL,
  };
}

// Awards XP for a unique event. Silently skips if already awarded (ON CONFLICT).
async function awardXP(userId, amount, refType, refId) {
  const result = await db.run(
    'INSERT INTO xp_log (user_id, amount, ref_type, ref_id) VALUES (?,?,?,?) ON CONFLICT (user_id, ref_type, ref_id) DO NOTHING',
    [userId, amount, refType, refId]
  );
  if (result.rowCount === 0) return; // already awarded

  await db.run(
    `INSERT INTO user_xp (user_id, total_xp, updated_at) VALUES (?,?,NOW())
     ON CONFLICT (user_id) DO UPDATE SET total_xp = user_xp.total_xp + ?, updated_at = NOW()`,
    [userId, amount, amount]
  );
}

// Awards a badge. Silently skips if already earned (ON CONFLICT).
async function awardBadge(userId, badgeKey) {
  await db.run(
    'INSERT INTO user_badges (user_id, badge_key) VALUES (?,?) ON CONFLICT (user_id, badge_key) DO NOTHING',
    [userId, badgeKey]
  );
}

async function checkWeekStreak(userId) {
  // Count distinct UTC study dates in the last 7 days (today + 6 previous).
  // Both sides use explicit UTC so server timezone never affects the result.
  const row = await db.get(
    `SELECT COUNT(DISTINCT (start_time AT TIME ZONE 'UTC')::date)::int AS study_days
     FROM study_sessions
     WHERE user_id = ?
       AND (start_time AT TIME ZONE 'UTC')::date
             >= (NOW() AT TIME ZONE 'UTC')::date - INTERVAL '6 days'`,
    [userId]
  );
  if ((row?.study_days || 0) >= 7) {
    await awardBadge(userId, 'week_streak');
  }
}

async function checkWeeklyGoal(userId) {
  const { start, end } = getISOWeekBounds(currentISOWeek());
  const [row, userRow] = await Promise.all([
    db.get(
      `SELECT COALESCE(SUM(duration), 0)::int AS total_seconds
       FROM study_sessions
       WHERE user_id = ? AND start_time >= ? AND start_time < ? AND duration IS NOT NULL`,
      [userId, start, end]
    ),
    db.get('SELECT weekly_goal_hours FROM users WHERE id = ?', [userId]),
  ]);
  const goalSeconds = (userRow?.weekly_goal_hours || 10) * 3600;
  if ((row?.total_seconds || 0) >= goalSeconds) {
    const week = currentISOWeek();
    await awardXP(userId, 100, 'weekly_goal', week);
    await awardBadge(userId, 'goal_crusher');
  }
}

// Called after a session ends (timer stop or manual entry).
async function onSessionComplete(userId, session) {
  if (!session.duration) return;

  // +10 XP per 30 minutes studied
  const units = Math.floor(session.duration / 1800);
  if (units > 0) {
    await awardXP(userId, units * 10, 'session', String(session.id));
  }

  // Time-of-day badges — use UTC hour from the stored TIMESTAMPTZ
  const hour = new Date(session.start_time).getUTCHours();
  if (hour >= 22) await awardBadge(userId, 'night_owl');
  if (hour < 8)   await awardBadge(userId, 'early_bird');

  await checkWeekStreak(userId);
  await checkWeeklyGoal(userId);
}

// Called when a task is marked completed (any code path).
async function onTaskComplete(userId, taskId) {
  // Award 50 XP (idempotent — duplicate prevented by xp_log unique constraint).
  await awardXP(userId, 50, 'task', String(taskId));

  // Award first-task badge unconditionally. awardBadge uses ON CONFLICT DO NOTHING
  // so it is only inserted once regardless of how many tasks the user completes.
  // Previously this used a COUNT === 1 check which became permanently unreachable
  // if the very first call ever failed silently.
  await awardBadge(userId, 'first_task');
}

async function getProfile(userId) {
  const xpRow = await db.get('SELECT total_xp FROM user_xp WHERE user_id = ?', [userId]);
  const totalXp = xpRow?.total_xp || 0;

  const earnedRows = await db.all(
    'SELECT badge_key, earned_at FROM user_badges WHERE user_id = ?',
    [userId]
  );
  const earnedMap = Object.fromEntries(earnedRows.map(r => [r.badge_key, r.earned_at]));

  const badges = BADGE_DEFS.map(b => ({
    ...b,
    earned: b.key in earnedMap,
    earned_at: earnedMap[b.key] || null,
  }));

  return {
    xp: { total: totalXp, ...computeLevel(totalXp) },
    badges,
  };
}

module.exports = { onSessionComplete, onTaskComplete, getProfile };
