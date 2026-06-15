const db = require('../database/db');

async function getAll(userId) {
  return db.all(
    'SELECT * FROM events WHERE user_id = ? ORDER BY event_date ASC, event_time ASC NULLS LAST',
    [userId]
  );
}

async function create(userId, { title, type, notes, event_date, event_time }) {
  return db.get(
    `INSERT INTO events (user_id, title, type, notes, event_date, event_time)
     VALUES (?,?,?,?,?,?) RETURNING *`,
    [userId, title, type || 'other', notes || null, event_date, event_time || null]
  );
}

async function remove(userId, id) {
  const event = await db.get('SELECT id FROM events WHERE id = ? AND user_id = ?', [id, userId]);
  if (!event) { const e = new Error('Not found'); e.status = 404; throw e; }
  await db.run('DELETE FROM events WHERE id = ?', [id]);
}

module.exports = { getAll, create, remove };
