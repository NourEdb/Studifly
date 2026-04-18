const { getDb } = require('../database/db');
const { getISOWeekBounds } = require('../utils/dateHelpers');

function start(userId, { task_id }) {
  const db = getDb();
  const start_time = new Date().toISOString();
  const result = db.prepare(
    'INSERT INTO study_sessions (user_id, task_id, start_time) VALUES (?, ?, ?)'
  ).run(userId, task_id || null, start_time);
  return db.prepare('SELECT * FROM study_sessions WHERE id = ?').get(Number(result.lastInsertRowid));
}

function stop(userId, id) {
  const db = getDb();
  const session = db.prepare('SELECT * FROM study_sessions WHERE id = ? AND user_id = ?').get(id, userId);
  if (!session) { const e = new Error('Not found'); e.status = 404; throw e; }
  if (session.end_time) { const e = new Error('Session already stopped'); e.status = 400; throw e; }
  const end_time = new Date().toISOString();
  const duration = Math.round((new Date(end_time) - new Date(session.start_time)) / 1000);
  db.prepare('UPDATE study_sessions SET end_time = ?, duration = ? WHERE id = ?').run(end_time, duration, id);
  return db.prepare('SELECT * FROM study_sessions WHERE id = ?').get(id);
}

function manual(userId, { task_id, start_time, end_time, duration }) {
  const db = getDb();
  const dur = duration || Math.round((new Date(end_time) - new Date(start_time)) / 1000);
  const result = db.prepare(
    'INSERT INTO study_sessions (user_id, task_id, start_time, end_time, duration, is_manual) VALUES (?,?,?,?,?,1)'
  ).run(userId, task_id || null, start_time, end_time || null, dur);
  return db.prepare('SELECT * FROM study_sessions WHERE id = ?').get(Number(result.lastInsertRowid));
}

function getAll(userId, filters = {}) {
  let sql = `SELECT s.*, t.name as task_name FROM study_sessions s LEFT JOIN tasks t ON s.task_id = t.id WHERE s.user_id = ?`;
  const params = [userId];

  if (filters.task_id) { sql += ' AND s.task_id = ?'; params.push(filters.task_id); }
  if (filters.week) {
    const { start, end } = getISOWeekBounds(filters.week);
    sql += ' AND s.start_time >= ? AND s.start_time < ?';
    params.push(start, end);
  }
  sql += ' ORDER BY s.start_time DESC';
  if (filters.limit) { sql += ' LIMIT ?'; params.push(parseInt(filters.limit)); }
  return getDb().prepare(sql).all(...params);
}

function remove(userId, id) {
  const db = getDb();
  const session = db.prepare('SELECT id FROM study_sessions WHERE id = ? AND user_id = ?').get(id, userId);
  if (!session) { const e = new Error('Not found'); e.status = 404; throw e; }
  db.prepare('DELETE FROM study_sessions WHERE id = ?').run(id);
}

module.exports = { start, stop, manual, getAll, remove };
