const db = require('../database/db');
const { getISOWeekBounds, currentISOWeek } = require('../utils/dateHelpers');

async function getAll(userId) {
  return db.all('SELECT * FROM courses WHERE user_id = ? ORDER BY created_at DESC', [userId]);
}

async function create(userId, { name, color }) {
  return db.get(
    'INSERT INTO courses (user_id, name, color) VALUES (?, ?, ?) RETURNING *',
    [userId, name, color || '#6C4DC4']
  );
}

async function update(userId, id, body) {
  const course = await db.get('SELECT id FROM courses WHERE id = ? AND user_id = ?', [id, userId]);
  if (!course) { const e = new Error('Not found'); e.status = 404; throw e; }
  const fields = [];
  const params = [];
  if (body.name) { fields.push('name = ?'); params.push(body.name); }
  if (body.color) { fields.push('color = ?'); params.push(body.color); }
  if (!fields.length) return db.get('SELECT * FROM courses WHERE id = ?', [id]);
  params.push(id);
  return db.get(`UPDATE courses SET ${fields.join(', ')} WHERE id = ? RETURNING *`, params);
}

async function remove(userId, id) {
  const course = await db.get('SELECT id FROM courses WHERE id = ? AND user_id = ?', [id, userId]);
  if (!course) { const e = new Error('Not found'); e.status = 404; throw e; }
  await db.run('DELETE FROM courses WHERE id = ?', [id]);
}

async function getTasksByCourse(userId, courseId) {
  return db.all('SELECT * FROM tasks WHERE course_id = ? AND user_id = ? ORDER BY created_at DESC', [courseId, userId]);
}

async function getCourseDetail(userId, courseId) {
  const { start, end } = getISOWeekBounds(currentISOWeek());
  const weekStart = start.slice(0, 10);
  const weekEnd   = end.slice(0, 10);

  const [course, tasks, plannedRow, actualRow, blocksComparison] = await Promise.all([
    db.get('SELECT * FROM courses WHERE id = ? AND user_id = ?', [courseId, userId]),
    db.all(
      `SELECT * FROM tasks WHERE course_id = ? AND user_id = ?
       ORDER BY due_date ASC NULLS LAST, created_at DESC`,
      [courseId, userId]
    ),
    db.get(
      `SELECT COALESCE(SUM(planned_time), 0)::int AS total_planned_minutes
       FROM tasks WHERE course_id = ? AND user_id = ?`,
      [courseId, userId]
    ),
    db.get(
      `SELECT COALESCE(SUM(s.duration), 0)::int AS actual_seconds
       FROM study_sessions s JOIN tasks t ON s.task_id = t.id
       WHERE t.course_id = ? AND t.user_id = ? AND s.duration IS NOT NULL`,
      [courseId, userId]
    ),
    db.all(
      `SELECT sb.plan_date AS date,
              ROUND(SUM(EXTRACT(EPOCH FROM (sb.end_time::time - sb.start_time::time)) / 60.0))::int AS planned_minutes,
              ROUND(SUM(CASE WHEN sb.completion_pct IS NOT NULL
                THEN EXTRACT(EPOCH FROM (sb.end_time::time - sb.start_time::time)) / 60.0 * sb.completion_pct / 100.0
                ELSE 0 END))::int AS actual_minutes
       FROM study_blocks sb JOIN tasks t ON sb.task_id = t.id
       WHERE sb.user_id = ? AND t.course_id = ?
         AND sb.plan_date >= ? AND sb.plan_date < ?
       GROUP BY sb.plan_date ORDER BY sb.plan_date ASC`,
      [userId, courseId, weekStart, weekEnd]
    ),
  ]);

  if (!course) { const e = new Error('Not found'); e.status = 404; throw e; }

  const total     = tasks.length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const now       = new Date().toISOString().slice(0, 10);

  return {
    course,
    stats: {
      total_tasks:      total,
      completed_tasks:  completed,
      completion_pct:   total > 0 ? Math.round(completed / total * 100) : 0,
      planned_hours:    Math.round((plannedRow.total_planned_minutes / 60) * 10) / 10,
      actual_hours:     Math.round((actualRow.actual_seconds / 3600) * 10) / 10,
    },
    tasks: tasks.map(t => ({
      ...t,
      overdue: t.status !== 'completed' && t.due_date && t.due_date < now,
    })),
    blocks_comparison: blocksComparison,
  };
}

module.exports = { getAll, create, update, remove, getTasksByCourse, getCourseDetail };
