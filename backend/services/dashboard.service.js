const db = require('../database/db');
const { getISOWeekBounds, currentISOWeek } = require('../utils/dateHelpers');

async function getStreak(userId, tz = 'UTC') {
  const rows = await db.all(
    `SELECT DISTINCT (start_time AT TIME ZONE ?)::date::text AS d
     FROM study_sessions
     WHERE user_id = ? AND duration IS NOT NULL
       AND start_time >= NOW() - INTERVAL '60 days'
     ORDER BY d DESC`,
    [tz, userId]
  );

  if (rows.length === 0) return 0;

  // Compute today and yesterday as YYYY-MM-DD strings in the user's timezone
  const today = new Date().toLocaleDateString('en-CA', { timeZone: tz });
  const [y, m, d] = today.split('-').map(Number);
  const todayUtc = new Date(Date.UTC(y, m - 1, d));
  const yesterdayUtc = new Date(todayUtc);
  yesterdayUtc.setUTCDate(todayUtc.getUTCDate() - 1);
  const yesterday = yesterdayUtc.toISOString().slice(0, 10);

  const daySet = new Set(rows.map(r => r.d));

  // Streak is alive if the user studied today or yesterday
  let anchor;
  if (daySet.has(today))     anchor = todayUtc;
  else if (daySet.has(yesterday)) anchor = yesterdayUtc;
  else return 0;

  // Walk backward day by day counting consecutive hits
  let streak = 0;
  const cur = new Date(anchor);
  while (daySet.has(cur.toISOString().slice(0, 10))) {
    streak++;
    cur.setUTCDate(cur.getUTCDate() - 1);
  }
  return streak;
}

async function getPeerComparison(currentUserId, weekStart, weekEnd) {
  const [weekRows, taskRows] = await Promise.all([
    db.all(
      `SELECT user_id, COALESCE(SUM(duration), 0)::int AS user_total
       FROM study_sessions
       WHERE user_id != ? AND start_time >= ? AND start_time < ? AND duration IS NOT NULL
       GROUP BY user_id`,
      [currentUserId, weekStart, weekEnd]
    ),
    db.all(
      `SELECT user_id, status, COUNT(*)::int AS count
       FROM tasks WHERE user_id != ?
       GROUP BY user_id, status`,
      [currentUserId]
    ),
  ]);

  // Metric A: avg weekly seconds among active peers
  const peer_count = weekRows.length;
  const avg_weekly_seconds = peer_count > 0
    ? Math.round(weekRows.reduce((s, r) => s + r.user_total, 0) / peer_count)
    : null;

  // Metric B: avg completion rate among peers with tasks
  const userTaskMap = {};
  for (const r of taskRows) {
    if (!userTaskMap[r.user_id]) userTaskMap[r.user_id] = {};
    userTaskMap[r.user_id][r.status] = r.count;
  }
  const peerRates = Object.values(userTaskMap)
    .map(counts => {
      const total = (counts.pending || 0) + (counts.in_progress || 0) + (counts.completed || 0);
      return total > 0 ? (counts.completed || 0) / total : null;
    })
    .filter(r => r !== null);

  const completion_peer_count = peerRates.length;
  const avg_completion_rate = completion_peer_count > 0
    ? Math.round(peerRates.reduce((s, r) => s + r, 0) / completion_peer_count * 100)
    : null;

  const enough_data = peer_count >= 3 && completion_peer_count >= 3;

  return {
    enough_data,
    peer_count,
    avg_weekly_seconds:   enough_data ? avg_weekly_seconds   : null,
    completion_peer_count,
    avg_completion_rate:  enough_data ? avg_completion_rate  : null,
  };
}

async function getSummary(userId, tz = 'UTC') {
  const { start, end } = getISOWeekBounds(currentISOWeek());

  const [hoursRow, taskCounts, overdueRow, streak, peers] = await Promise.all([
    db.get(
      'SELECT COALESCE(SUM(duration), 0) as total_seconds FROM study_sessions WHERE user_id = ? AND start_time >= ? AND start_time < ? AND duration IS NOT NULL',
      [userId, start, end]
    ),
    db.all(
      'SELECT status, COUNT(*)::int as count FROM tasks WHERE user_id = ? GROUP BY status',
      [userId]
    ),
    db.get(
      `SELECT COUNT(*)::int as count FROM tasks WHERE user_id = ? AND status != 'completed' AND due_date < CURRENT_DATE::text`,
      [userId]
    ),
    getStreak(userId, tz),
    getPeerComparison(userId, start, end),
  ]);

  const counts = { pending: 0, in_progress: 0, completed: 0 };
  taskCounts.forEach(r => { counts[r.status] = r.count; });
  const total = counts.pending + counts.in_progress + counts.completed;

  return {
    week: currentISOWeek(),
    weekly_seconds: parseInt(hoursRow.total_seconds),
    task_counts: counts,
    total_tasks: total,
    completion_rate: total > 0 ? Math.round((counts.completed / total) * 100) : 0,
    overdue_count: overdueRow.count,
    streak,
    peers,
  };
}

async function getWeeklyHours(userId, weeks = 4) {
  const results = [];
  const now = currentISOWeek();
  const [yearStr, weekPart] = now.split('-W');
  let year = parseInt(yearStr);
  let week = parseInt(weekPart);

  for (let i = 0; i < weeks; i++) {
    const label = `${year}-W${String(week).padStart(2, '0')}`;
    const { start, end } = getISOWeekBounds(label);
    const row = await db.get(
      'SELECT COALESCE(SUM(duration), 0) as total_seconds FROM study_sessions WHERE user_id = ? AND start_time >= ? AND start_time < ? AND duration IS NOT NULL',
      [userId, start, end]
    );
    results.unshift({ week: label, total_seconds: parseInt(row.total_seconds) });
    week--;
    if (week < 1) { week = 52; year--; }
  }
  return results;
}

async function getByCourse(userId) {
  const { start, end } = getISOWeekBounds(currentISOWeek());
  return db.all(
    `SELECT c.name as course_name, c.color, COALESCE(SUM(s.duration), 0)::int as total_seconds
     FROM study_sessions s
     JOIN tasks t ON s.task_id = t.id
     JOIN courses c ON t.course_id = c.id
     WHERE s.user_id = ? AND s.start_time >= ? AND s.start_time < ? AND s.duration IS NOT NULL
     GROUP BY c.id, c.name, c.color`,
    [userId, start, end]
  );
}

// Returns total seconds per (day-of-week, hour) slot across all sessions.
// dow: 1=Monday … 7=Sunday  (ISO day of week)
// hour: 0–23 (UTC)
async function getHeatmap(userId) {
  return db.all(
    `SELECT
       EXTRACT(ISODOW FROM start_time AT TIME ZONE 'UTC')::int AS dow,
       EXTRACT(HOUR  FROM start_time AT TIME ZONE 'UTC')::int AS hour,
       SUM(duration)::int                                      AS total_seconds
     FROM study_sessions
     WHERE user_id = ? AND duration IS NOT NULL
     GROUP BY dow, hour`,
    [userId]
  );
}

async function getCourseComparison(userId) {
  return db.all(
    `SELECT c.name AS course_name, c.color,
            COALESCE(SUM(s.duration), 0)::int AS total_seconds
     FROM study_sessions s
     JOIN tasks t ON s.task_id = t.id
     JOIN courses c ON t.course_id = c.id
     WHERE s.user_id = ? AND s.duration IS NOT NULL
     GROUP BY c.id, c.name, c.color
     ORDER BY total_seconds DESC`,
    [userId]
  );
}

// Returns per-day planned vs actual minutes for the current ISO week.
// planned = block duration in minutes; actual = completion_pct * planned / 100.
// Only days with at least one block are included.
async function getBlocksComparison(userId) {
  const { start, end } = getISOWeekBounds(currentISOWeek());
  const weekStart = start.slice(0, 10);
  const weekEnd   = end.slice(0, 10);

  return db.all(
    `SELECT
       plan_date AS date,
       ROUND(SUM(
         EXTRACT(EPOCH FROM (end_time::time - start_time::time)) / 60.0
       ))::int AS planned_minutes,
       ROUND(SUM(
         CASE WHEN completion_pct IS NOT NULL
         THEN EXTRACT(EPOCH FROM (end_time::time - start_time::time)) / 60.0
              * completion_pct / 100.0
         ELSE 0 END
       ))::int AS actual_minutes
     FROM study_blocks
     WHERE user_id = ?
       AND plan_date >= ?
       AND plan_date < ?
     GROUP BY plan_date
     ORDER BY plan_date ASC`,
    [userId, weekStart, weekEnd]
  );
}

module.exports = { getSummary, getStreak, getPeerComparison, getWeeklyHours, getByCourse, getHeatmap, getCourseComparison, getBlocksComparison };
