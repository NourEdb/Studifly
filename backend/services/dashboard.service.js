const { getDb } = require('../database/db');
const { getISOWeekBounds, currentISOWeek } = require('../utils/dateHelpers');

function getSummary(userId) {
  const db = getDb();
  const { start, end } = getISOWeekBounds(currentISOWeek());

  const hoursRow = db.prepare(
    'SELECT COALESCE(SUM(duration), 0) as total_seconds FROM study_sessions WHERE user_id = ? AND start_time >= ? AND start_time < ? AND duration IS NOT NULL'
  ).get(userId, start, end);

  const taskCounts = db.prepare(
    'SELECT status, COUNT(*) as count FROM tasks WHERE user_id = ? GROUP BY status'
  ).all(userId);

  const counts = { pending: 0, in_progress: 0, completed: 0 };
  taskCounts.forEach(r => { counts[r.status] = r.count; });
  const total = counts.pending + counts.in_progress + counts.completed;

  const overdueTasks = db.prepare(
    `SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND status != 'completed' AND due_date < date('now')`
  ).get(userId);

  return {
    week: currentISOWeek(),
    weekly_seconds: hoursRow.total_seconds,
    task_counts: counts,
    total_tasks: total,
    completion_rate: total > 0 ? Math.round((counts.completed / total) * 100) : 0,
    overdue_count: overdueTasks.count
  };
}

function getWeeklyHours(userId, weeks = 4) {
  const db = getDb();
  const results = [];
  const now = currentISOWeek();
  const [yearStr, weekPart] = now.split('-W');
  let year = parseInt(yearStr);
  let week = parseInt(weekPart);

  for (let i = 0; i < weeks; i++) {
    const label = `${year}-W${String(week).padStart(2, '0')}`;
    const { start, end } = getISOWeekBounds(label);
    const row = db.prepare(
      'SELECT COALESCE(SUM(duration), 0) as total_seconds FROM study_sessions WHERE user_id = ? AND start_time >= ? AND start_time < ? AND duration IS NOT NULL'
    ).get(userId, start, end);
    results.unshift({ week: label, total_seconds: row.total_seconds });
    week--;
    if (week < 1) { week = 52; year--; }
  }
  return results;
}

function getByCourse(userId) {
  const db = getDb();
  const { start, end } = getISOWeekBounds(currentISOWeek());
  return db.prepare(
    `SELECT c.name as course_name, c.color, COALESCE(SUM(s.duration), 0) as total_seconds
     FROM study_sessions s
     JOIN tasks t ON s.task_id = t.id
     JOIN courses c ON t.course_id = c.id
     WHERE s.user_id = ? AND s.start_time >= ? AND s.start_time < ? AND s.duration IS NOT NULL
     GROUP BY c.id`
  ).all(userId, start, end);
}

module.exports = { getSummary, getWeeklyHours, getByCourse };
