const db = require('../database/db');
const gamification = require('./gamification.service');

const ACTUAL_SECONDS_SUBQUERY = `
  COALESCE((
    SELECT SUM(duration) FROM study_sessions
    WHERE study_block_id = sb.id AND duration IS NOT NULL
  ), 0)::int`;

async function getAll(userId, filters = {}) {
  let sql = `
    SELECT sb.*, t.name AS task_name, t.course_id,
           c.name AS course_name, c.color AS course_color,
           ${ACTUAL_SECONDS_SUBQUERY} AS actual_seconds
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

  // Completed subtasks sink to the bottom (newest-completed first within that
  // group); everything else keeps the existing date/time ordering — mirrors
  // tasks.service.js's getAll().
  sql += ` ORDER BY (sb.status = 'completed'),
           CASE WHEN sb.status = 'completed' THEN sb.completed_at END DESC NULLS LAST,
           sb.plan_date ASC NULLS LAST, sb.start_time ASC NULLS LAST`;
  return db.all(sql, params);
}

async function getOne(userId, id) {
  const block = await db.get(
    `SELECT sb.*, t.name AS task_name, t.course_id,
            c.name AS course_name, c.color AS course_color,
            ${ACTUAL_SECONDS_SUBQUERY} AS actual_seconds
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
  const { task_id, plan_date, start_time, end_time, topic, planned_time } = body;

  // Verify the task belongs to this user
  const task = await db.get('SELECT id FROM tasks WHERE id = ? AND user_id = ?', [task_id, userId]);
  if (!task) { const e = new Error('Task not found'); e.status = 404; throw e; }

  const block = await db.get(
    `INSERT INTO study_blocks (user_id, task_id, plan_date, start_time, end_time, topic, planned_time)
     VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    [userId, task_id, plan_date || null, start_time || null, end_time || null, topic || null, planned_time || null]
  );
  return getOne(userId, block.id);
}

async function update(userId, id, body) {
  const block = await db.get('SELECT id FROM study_blocks WHERE id = ? AND user_id = ?', [id, userId]);
  if (!block) { const e = new Error('Not found'); e.status = 404; throw e; }

  const fields = [];
  const params = [];

  if (body.plan_date !== undefined)    { fields.push('plan_date = ?');    params.push(body.plan_date || null); }
  if (body.start_time !== undefined)   { fields.push('start_time = ?');   params.push(body.start_time || null); }
  if (body.end_time !== undefined)     { fields.push('end_time = ?');     params.push(body.end_time || null); }
  if ('topic' in body)                 { fields.push('topic = ?');       params.push(body.topic || null); }
  if (body.planned_time !== undefined) { fields.push('planned_time = ?'); params.push(body.planned_time || null); }

  if (fields.length) {
    params.push(id);
    await db.run(`UPDATE study_blocks SET ${fields.join(', ')} WHERE id = ?`, params);
  }
  return getOne(userId, id);
}

const VALID_STATUSES = ['pending', 'in_progress', 'completed'];

// Separate from update() for the same reason as tasks.service.js's updateStatus:
// a narrow, explicit action used by the subtask checkmark toggle and by the
// timer when it starts a subtask.
async function updateStatus(userId, id, status) {
  if (!VALID_STATUSES.includes(status)) { const e = new Error('Invalid status'); e.status = 400; throw e; }
  const block = await db.get('SELECT id, task_id FROM study_blocks WHERE id = ? AND user_id = ?', [id, userId]);
  if (!block) { const e = new Error('Not found'); e.status = 404; throw e; }

  let parentTaskCompleted = false;
  if (status === 'completed') {
    await db.run('UPDATE study_blocks SET status = ?, completed_at = NOW() WHERE id = ?', [status, id]);
    // Same cascade as the post-session reflection flow: completing the last
    // remaining subtask (however it happened — timer or this manual toggle)
    // auto-completes the parent task too.
    const remaining = await db.get(
      `SELECT COUNT(*)::int AS cnt FROM study_blocks WHERE task_id = ? AND user_id = ? AND status <> 'completed'`,
      [block.task_id, userId]
    );
    if (remaining.cnt === 0) {
      await db.run(`UPDATE tasks SET status = 'completed', completed_at = NOW() WHERE id = ? AND user_id = ?`, [block.task_id, userId]);
      gamification.onTaskComplete(userId, block.task_id).catch(err => console.error('[gamification] onTaskComplete failed:', err.message));
      parentTaskCompleted = true;
    }
  } else {
    await db.run('UPDATE study_blocks SET status = ?, completed_at = NULL WHERE id = ?', [status, id]);
  }
  const updated = await getOne(userId, id);
  return { ...updated, parent_task_completed: parentTaskCompleted };
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

module.exports = { getAll, getOne, create, update, updateStatus, remove, logActual };
