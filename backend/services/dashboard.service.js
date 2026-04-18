const db = require('../database/db');
const { getISOWeekBounds, currentISOWeek } = require('../utils/dateHelpers');

async function getSummary(userId) {
  const { start, end } = getISOWeekBounds(currentISOWeek());

  const hoursRow = await db.get(
    'SELECT COALESCE(SUM(duration), 0) as total_seconds FROM study_sessions WHERE user_id = ? AND start_time >= ? AND start_time < ? AND duration IS NOT NULL',
    [userId, start, end]
  );

  const taskCounts = await db.all(
    'SELECT status, COUNT(*)::int as count FROM tasks WHERE user_id = ? GROUP BY status',
    [userId]
  );

  const counts = { pending: 0, in_progress: 0, completed: 0 };
  taskCounts.forEach(r => { counts[r.status] = r.count; });
  const total = counts.pending + counts.in_progress + counts.completed;

  const overdueRow = await db.get(
    `SELECT COUNT(*)::int as count FROM tasks WHERE user_id = ? AND status != 'completed' AND due_date < CURRENT_DATE::text`,
    [userId]
  );

  return {
    week: currentISOWeek(),
    weekly_seconds: parseInt(hoursRow.total_seconds),
    task_counts: counts,
    total_tasks: total,
    completion_rate: total > 0 ? Math.round((counts.completed / total) * 100) : 0,
    overdue_count: overdueRow.count
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

module.exports = { getSummary, getWeeklyHours, getByCourse };
