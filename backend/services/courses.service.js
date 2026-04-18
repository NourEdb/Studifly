const db = require('../database/db');

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

module.exports = { getAll, create, update, remove, getTasksByCourse };
