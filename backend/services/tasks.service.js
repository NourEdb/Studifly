const { getDb } = require('../database/db');
const { getISOWeekBounds } = require('../utils/dateHelpers');

function buildQuery(userId, filters) {
  let sql = 'SELECT t.*, c.name as course_name, c.color as course_color FROM tasks t LEFT JOIN courses c ON t.course_id = c.id WHERE t.user_id = ?';
  const params = [userId];

  if (filters.course_id) { sql += ' AND t.course_id = ?'; params.push(filters.course_id); }
  if (filters.status) { sql += ' AND t.status = ?'; params.push(filters.status); }
  if (filters.week) {
    const { start, end } = getISOWeekBounds(filters.week);
    sql += ' AND t.due_date >= ? AND t.due_date < ?';
    params.push(start.slice(0, 10), end.slice(0, 10));
  }
  sql += ' ORDER BY t.due_date ASC, t.created_at DESC';
  return { sql, params };
}

function getAll(userId, filters = {}) {
  const { sql, params } = buildQuery(userId, filters);
  const rows = getDb().prepare(sql).all(...params);
  const now = new Date().toISOString().slice(0, 10);
  return rows.map(r => ({ ...r, overdue: r.status !== 'completed' && r.due_date && r.due_date < now }));
}

function getOne(userId, id) {
  const db = getDb();
  const task = db.prepare(
    'SELECT t.*, c.name as course_name, c.color as course_color FROM tasks t LEFT JOIN courses c ON t.course_id = c.id WHERE t.id = ? AND t.user_id = ?'
  ).get(id, userId);
  if (!task) { const e = new Error('Not found'); e.status = 404; throw e; }
  const sessions = db.prepare('SELECT SUM(duration) as total_seconds, COUNT(*) as session_count FROM study_sessions WHERE task_id = ? AND duration IS NOT NULL').get(id);
  return { ...task, sessions };
}

function create(userId, body) {
  const db = getDb();
  const { name, course_id, activity_type, planned_time, due_date, status } = body;
  const result = db.prepare(
    'INSERT INTO tasks (user_id, course_id, name, activity_type, planned_time, due_date, status) VALUES (?,?,?,?,?,?,?)'
  ).run(userId, course_id || null, name, activity_type, planned_time || 0, due_date || null, status || 'pending');
  return getOne(userId, Number(result.lastInsertRowid));
}

function update(userId, id, body) {
  const db = getDb();
  const task = db.prepare('SELECT id FROM tasks WHERE id = ? AND user_id = ?').get(id, userId);
  if (!task) { const e = new Error('Not found'); e.status = 404; throw e; }
  const { name, course_id, activity_type, planned_time, due_date, status } = body;
  db.prepare(
    `UPDATE tasks SET
      name = COALESCE(?, name),
      course_id = CASE WHEN ? IS NOT NULL THEN ? ELSE course_id END,
      activity_type = COALESCE(?, activity_type),
      planned_time = COALESCE(?, planned_time),
      due_date = CASE WHEN ? IS NOT NULL THEN ? ELSE due_date END,
      status = COALESCE(?, status)
    WHERE id = ?`
  ).run(name || null, course_id, course_id, activity_type || null, planned_time ?? null, due_date, due_date, status || null, id);
  return getOne(userId, id);
}

function updateStatus(userId, id, status) {
  const db = getDb();
  const task = db.prepare('SELECT id FROM tasks WHERE id = ? AND user_id = ?').get(id, userId);
  if (!task) { const e = new Error('Not found'); e.status = 404; throw e; }
  db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(status, id);
  return getOne(userId, id);
}

function remove(userId, id) {
  const db = getDb();
  const task = db.prepare('SELECT id FROM tasks WHERE id = ? AND user_id = ?').get(id, userId);
  if (!task) { const e = new Error('Not found'); e.status = 404; throw e; }
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
}

module.exports = { getAll, getOne, create, update, updateStatus, remove };
