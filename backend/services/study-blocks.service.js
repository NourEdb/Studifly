const db = require('../database/db');

async function getAll(userId, filters = {}) {
  let sql = `
    SELECT sb.*, t.name AS task_name, t.course_id,
           c.name AS course_name, c.color AS course_color
    FROM study_blocks sb
    JOIN tasks t ON sb.task_id = t.id
    LEFT JOIN courses c ON t.course_id = c.id
    WHERE sb.user_id = ?`;
  const params = [userId];

  if (filters.task_id) {
    sql += ' AND sb.task_id = ?';
    params.push(filters.task_id);
  }
  if (filters.plan_date) {
    sql += ' AND sb.plan_date = ?';
    params.push(filters.plan_date);
  }
  if (filters.week_start) {
    // Expect YYYY-MM-DD; return the 7 days starting from that date
    sql += ' AND sb.plan_date >= ? AND sb.plan_date < (DATE(?) + INTERVAL \'7 days\')::TEXT';
    params.push(filters.week_start, filters.week_start);
  }

  sql += ' ORDER BY sb.plan_date ASC, sb.start_time ASC';
  return db.all(sql, params);
}

async function getOne(userId, id) {
  const block = await db.get(
    `SELECT sb.*, t.name AS task_name, t.course_id,
            c.name AS course_name, c.color AS course_color
     FROM study_blocks sb
     JOIN tasks t ON sb.task_id = t.id
     LEFT JOIN courses c ON t.course_id = c.id
     WHERE sb.id = ? AND sb.user_id = ?`,
    [id, userId]
  );
  if (!block) { const e = new Error('Not found'); e.status = 404; throw e; }
  return block;
}

async function create(userId, body) {
  const { task_id, plan_date, start_time, end_time, topic } = body;

  // Verify the task belongs to this user
  const task = await db.get('SELECT id FROM tasks WHERE id = ? AND user_id = ?', [task_id, userId]);
  if (!task) { const e = new Error('Task not found'); e.status = 404; throw e; }

  const block = await db.get(
    `INSERT INTO study_blocks (user_id, task_id, plan_date, start_time, end_time, topic)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
    [userId, task_id, plan_date, start_time, end_time, topic || null]
  );
  return getOne(userId, block.id);
}

async function update(userId, id, body) {
  const block = await db.get('SELECT id FROM study_blocks WHERE id = ? AND user_id = ?', [id, userId]);
  if (!block) { const e = new Error('Not found'); e.status = 404; throw e; }

  const fields = [];
  const params = [];

  if (body.plan_date !== undefined)  { fields.push('plan_date = ?');  params.push(body.plan_date); }
  if (body.start_time !== undefined) { fields.push('start_time = ?'); params.push(body.start_time); }
  if (body.end_time !== undefined)   { fields.push('end_time = ?');   params.push(body.end_time); }
  if ('topic' in body)               { fields.push('topic = ?');      params.push(body.topic || null); }

  if (fields.length) {
    params.push(id);
    await db.run(`UPDATE study_blocks SET ${fields.join(', ')} WHERE id = ?`, params);
  }
  return getOne(userId, id);
}

async function remove(userId, id) {
  const block = await db.get('SELECT id FROM study_blocks WHERE id = ? AND user_id = ?', [id, userId]);
  if (!block) { const e = new Error('Not found'); e.status = 404; throw e; }
  await db.run('DELETE FROM study_blocks WHERE id = ?', [id]);
}

async function logActual(userId, id, body) {
  const block = await db.get('SELECT id FROM study_blocks WHERE id = ? AND user_id = ?', [id, userId]);
  if (!block) { const e = new Error('Not found'); e.status = 404; throw e; }

  const fields = [];
  const params = [];

  if ('actual_start' in body)    { fields.push('actual_start = ?');   params.push(body.actual_start || null); }
  if ('actual_end' in body)      { fields.push('actual_end = ?');     params.push(body.actual_end || null); }
  if ('actual_notes' in body)    { fields.push('actual_notes = ?');   params.push(body.actual_notes || null); }
  if ('completion_pct' in body)  { fields.push('completion_pct = ?'); params.push(body.completion_pct ?? null); }

  if (fields.length) {
    params.push(id);
    await db.run(`UPDATE study_blocks SET ${fields.join(', ')} WHERE id = ?`, params);
  }
  return getOne(userId, id);
}

module.exports = { getAll, getOne, create, update, remove, logActual };
