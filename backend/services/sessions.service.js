const db = require('../database/db');
const { getISOWeekBounds } = require('../utils/dateHelpers');

async function start(userId, { task_id }) {
  return db.get(
    'INSERT INTO study_sessions (user_id, task_id, start_time) VALUES (?, ?, NOW()) RETURNING *',
    [userId, task_id || null]
  );
}

async function stop(userId, id) {
  const session = await db.get('SELECT * FROM study_sessions WHERE id = ? AND user_id = ?', [id, userId]);
  if (!session) { const e = new Error('Not found'); e.status = 404; throw e; }
  if (session.end_time) { const e = new Error('Session already stopped'); e.status = 400; throw e; }
  const end_time = new Date();
  const duration = Math.round((end_time - new Date(session.start_time)) / 1000);
  return db.get(
    'UPDATE study_sessions SET end_time = NOW(), duration = ? WHERE id = ? RETURNING *',
    [duration, id]
  );
}

async function manual(userId, { task_id, start_time, end_time, duration }) {
  const dur = duration || Math.round((new Date(end_time) - new Date(start_time)) / 1000);
  return db.get(
    'INSERT INTO study_sessions (user_id, task_id, start_time, end_time, duration, is_manual) VALUES (?,?,?,?,?,1) RETURNING *',
    [userId, task_id || null, start_time, end_time || null, dur]
  );
}

async function getAll(userId, filters = {}) {
  let sql = `SELECT s.*, t.name as task_name
             FROM study_sessions s LEFT JOIN tasks t ON s.task_id = t.id
             WHERE s.user_id = ?`;
  const params = [userId];

  if (filters.task_id) { sql += ' AND s.task_id = ?'; params.push(filters.task_id); }
  if (filters.week) {
    const { start, end } = getISOWeekBounds(filters.week);
    sql += ' AND s.start_time >= ? AND s.start_time < ?';
    params.push(start, end);
  }
  sql += ' ORDER BY s.start_time DESC';
  if (filters.limit) { sql += ' LIMIT ?'; params.push(parseInt(filters.limit)); }
  return db.all(sql, params);
}

async function remove(userId, id) {
  const session = await db.get('SELECT id FROM study_sessions WHERE id = ? AND user_id = ?', [id, userId]);
  if (!session) { const e = new Error('Not found'); e.status = 404; throw e; }
  await db.run('DELETE FROM study_sessions WHERE id = ?', [id]);
}

module.exports = { start, stop, manual, getAll, remove };
