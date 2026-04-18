const { getDb } = require('../database/db');

function getAll(userId) {
  return getDb().prepare('SELECT * FROM courses WHERE user_id = ? ORDER BY created_at DESC').all(userId);
}

function create(userId, { name, color }) {
  const db = getDb();
  const result = db.prepare('INSERT INTO courses (user_id, name, color) VALUES (?, ?, ?)').run(userId, name, color || '#6C4DC4');
  return db.prepare('SELECT * FROM courses WHERE id = ?').get(Number(result.lastInsertRowid));
}

function update(userId, id, { name, color }) {
  const db = getDb();
  const course = db.prepare('SELECT * FROM courses WHERE id = ? AND user_id = ?').get(id, userId);
  if (!course) { const e = new Error('Not found'); e.status = 404; throw e; }
  db.prepare('UPDATE courses SET name = COALESCE(?, name), color = COALESCE(?, color) WHERE id = ?').run(name || null, color || null, id);
  return db.prepare('SELECT * FROM courses WHERE id = ?').get(id);
}

function remove(userId, id) {
  const db = getDb();
  const course = db.prepare('SELECT id FROM courses WHERE id = ? AND user_id = ?').get(id, userId);
  if (!course) { const e = new Error('Not found'); e.status = 404; throw e; }
  db.prepare('DELETE FROM courses WHERE id = ?').run(id);
}

function getTasksByCourse(userId, courseId) {
  return getDb().prepare('SELECT * FROM tasks WHERE course_id = ? AND user_id = ? ORDER BY created_at DESC').all(courseId, userId);
}

module.exports = { getAll, create, update, remove, getTasksByCourse };
