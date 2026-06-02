const db = require('../database/db');
const { currentISOWeek } = require('../utils/dateHelpers');

const XP_PER_LEVEL = 200;

const BADGE_DEFS = [
  { key: 'first_task',    name: 'First Task',    icon: '🎯', description: 'Complete your first task' },
  { key: 'week_streak',   name: 'Week Streak',   icon: '🔥', description: 'Study at least once every day for 7 days' },
  { key: 'goal_crusher',  name: 'Goal Crusher',  icon: '💪', description: 'Reach your weekly study goal (10 h)' },
  { key: 'night_owl',     name: 'Night Owl',     icon: '🦉', description: 'Study after 10 PM' },
  { key: 'early_bird',    name: 'Early Bird',    icon: '🐦', description: 'Study before 8 AM' },
];

const WEEKLY_GOAL_SECONDS = 36000; // 10 hours

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

// Awards a badge. Silently skips if already earned.
async function awardBadge(userId, badgeKey) {
  await db.run(
    'INSERT INTO user_badges (user_id, badge_key) VALUES (?,?) ON CONFLICT (user_id, badge_key) DO NOTHING',
    [userId, badgeKey]
  );
}

async function checkWeekStreak(userId) {
  const row = await db.get(
    `SELECT COUNT(DISTINCT DATE(start_time AT TIME ZONE 'UTC')) AS study_days
     FROM study_sessions
     WHERE user_id = ? AND start_time >= (CURRENT_DATE - INTERVAL '6 days')`,
    [userId]
  );
  if (parseInt(row?.study_days || 0) >= 7) {
    await awardBadge(userId, 'week_streak');
  }
}

async function checkWeeklyGoal(userId) {
  const row = await db.get(
    `SELECT COALESCE(SUM(duration), 0) AS total_seconds
     FROM study_sessions
     WHERE user_id = ? AND start_time >= DATE_TRUNC('week', NOW()) AND duration IS NOT NULL`,
    [userId]
  );
  if (parseInt(row?.total_seconds || 0) >= WEEKLY_GOAL_SECONDS) {
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

  // Time-of-day badges
  const hour = new Date(session.start_time).getUTCHours();
  if (hour >= 22) await awardBadge(userId, 'night_owl');
  if (hour < 8)  await awardBadge(userId, 'early_bird');

  await checkWeekStreak(userId);
  await checkWeeklyGoal(userId);
}

// Called when a task is marked completed.
async function onTaskComplete(userId, taskId) {
  await awardXP(userId, 50, 'task', String(taskId));

  const row = await db.get(
    "SELECT COUNT(*) AS cnt FROM tasks WHERE user_id = ? AND status = 'completed'",
    [userId]
  );
  if (parseInt(row?.cnt || 0) === 1) {
    await awardBadge(userId, 'first_task');
  }
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
