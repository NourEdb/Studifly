const db = require('../database/db');

const BUILT_IN_TYPES = ['exam', 'deadline', 'meeting', 'reminder', 'work', 'other'];

async function getCustomTypes(userId) {
  const placeholders = BUILT_IN_TYPES.map(() => '?').join(', ');
  const rows = await db.all(
    `SELECT DISTINCT type FROM events
     WHERE user_id = ? AND type NOT IN (${placeholders})
     ORDER BY type ASC`,
    [userId, ...BUILT_IN_TYPES]
  );
  return rows.map(r => r.type);
}

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

async function update(userId, id, { title, type, notes, event_date, event_time }) {
  const event = await db.get('SELECT id FROM events WHERE id = ? AND user_id = ?', [id, userId]);
  if (!event) { const e = new Error('Not found'); e.status = 404; throw e; }
  return db.get(
    `UPDATE events SET title = ?, type = ?, notes = ?, event_date = ?, event_time = ? WHERE id = ? RETURNING *`,
    [title, type || 'other', notes || null, event_date, event_time || null, id]
  );
}

async function remove(userId, id) {
  const event = await db.get('SELECT id FROM events WHERE id = ? AND user_id = ?', [id, userId]);
  if (!event) { const e = new Error('Not found'); e.status = 404; throw e; }
  await db.run('DELETE FROM events WHERE id = ?', [id]);
}

module.exports = { getAll, getCustomTypes, create, update, remove };
