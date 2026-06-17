const db = require('../database/db');
const { getISOWeekBounds } = require('../utils/dateHelpers');
const gamification = require('./gamification.service');

const BUILT_IN_ACTIVITY_TYPES = ['reading', 'practice', 'watching', 'other'];

async function getCustomActivityTypes(userId) {
  const placeholders = BUILT_IN_ACTIVITY_TYPES.map(() => '?').join(', ');
  const rows = await db.all(
    `SELECT DISTINCT activity_type FROM tasks
     WHERE user_id = ? AND activity_type NOT IN (${placeholders})
     ORDER BY activity_type ASC`,
    [userId, ...BUILT_IN_ACTIVITY_TYPES]
  );
  return rows.map(r => r.activity_type);
}

async function getOne(userId, id) {
  const task = await db.get(
    `SELECT t.*, c.name as course_name, c.color as course_color
     FROM tasks t LEFT JOIN courses c ON t.course_id = c.id
     WHERE t.id = ? AND t.user_id = ?`,
    [id, userId]
  );
  if (!task) { const e = new Error('Not found'); e.status = 404; throw e; }
  const sessions = await db.get(
    'SELECT SUM(duration) as total_seconds, COUNT(*) as session_count FROM study_sessions WHERE task_id = ? AND duration IS NOT NULL',
    [id]
  );
  const now = new Date().toISOString().slice(0, 10);
  return { ...task, overdue: task.status !== 'completed' && task.due_date && task.due_date < now, sessions };
}

async function getAll(userId, filters = {}) {
  let sql = `SELECT t.*, c.name as course_name, c.color as course_color,
             COALESCE((SELECT SUM(s.duration) FROM study_sessions s WHERE s.task_id = t.id AND s.duration IS NOT NULL), 0)::int AS actual_seconds
             FROM tasks t LEFT JOIN courses c ON t.course_id = c.id
             WHERE t.user_id = ?`;
  const params = [userId];

  if (filters.course_id) { sql += ' AND t.course_id = ?'; params.push(filters.course_id); }
  if (filters.status) { sql += ' AND t.status = ?'; params.push(filters.status); }
  if (filters.week) {
    const { start, end } = getISOWeekBounds(filters.week);
    sql += ' AND t.due_date >= ? AND t.due_date < ?';
    params.push(start.slice(0, 10), end.slice(0, 10));
  }
  sql += ' ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC';

  const rows = await db.all(sql, params);
  const now = new Date().toISOString().slice(0, 10);
  return rows.map(r => ({ ...r, overdue: r.status !== 'completed' && r.due_date && r.due_date < now }));
}

async function create(userId, body) {
  const { name, course_id, activity_type, planned_time, due_date, status } = body;
  const task = await db.get(
    'INSERT INTO tasks (user_id, course_id, name, activity_type, planned_time, due_date, status) VALUES (?,?,?,?,?,?,?) RETURNING *',
    [userId, course_id || null, name, activity_type, planned_time || 0, due_date || null, status || 'pending']
  );
  return getOne(userId, task.id);
}

async function update(userId, id, body) {
  const task = await db.get('SELECT id FROM tasks WHERE id = ? AND user_id = ?', [id, userId]);
  if (!task) { const e = new Error('Not found'); e.status = 404; throw e; }

  const fields = [];
  const params = [];
  if (body.name !== undefined) { fields.push('name = ?'); params.push(body.name); }
  if ('course_id' in body) { fields.push('course_id = ?'); params.push(body.course_id || null); }
  if (body.activity_type !== undefined) { fields.push('activity_type = ?'); params.push(body.activity_type); }
  if (body.planned_time !== undefined) { fields.push('planned_time = ?'); params.push(body.planned_time); }
  if ('due_date' in body) { fields.push('due_date = ?'); params.push(body.due_date || null); }
  if (body.status !== undefined) { fields.push('status = ?'); params.push(body.status); }

  if (fields.length) {
    params.push(id);
    await db.run(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, params);
  }
  return getOne(userId, id);
}

async function updateStatus(userId, id, status) {
  const task = await db.get('SELECT id FROM tasks WHERE id = ? AND user_id = ?', [id, userId]);
  if (!task) { const e = new Error('Not found'); e.status = 404; throw e; }
  await db.run('UPDATE tasks SET status = ? WHERE id = ?', [status, id]);
  if (status === 'completed') {
    gamification.onTaskComplete(userId, id).catch(err => console.error('[gamification] onTaskComplete failed:', err.message));
  }
  return getOne(userId, id);
}

async function remove(userId, id) {
  const task = await db.get('SELECT id FROM tasks WHERE id = ? AND user_id = ?', [id, userId]);
  if (!task) { const e = new Error('Not found'); e.status = 404; throw e; }
  await db.run('DELETE FROM tasks WHERE id = ?', [id]);
}

module.exports = { getAll, getOne, getCustomActivityTypes, create, update, updateStatus, remove };
