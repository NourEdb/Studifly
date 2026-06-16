const db = require('../database/db');
const { getISOWeekBounds } = require('../utils/dateHelpers');
const gamification = require('./gamification.service');

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
  const updated = await db.get(
    'UPDATE study_sessions SET end_time = NOW(), duration = ? WHERE id = ? RETURNING *',
    [duration, id]
  );
  gamification.onSessionComplete(userId, updated).catch(err => console.error('[gamification] onSessionComplete failed:', err.message));
  return updated;
}

async function reflect(userId, id, data) {
  const session = await db.get('SELECT * FROM study_sessions WHERE id = ? AND user_id = ?', [id, userId]);
  if (!session) { const e = new Error('Not found'); e.status = 404; throw e; }

  // Partial update — only touch fields explicitly present in data
  const sets = [];
  const vals = [];

  if ('completion_answer' in data) {
    const answer = data.completion_answer || null;
    sets.push('completion_answer = ?');
    vals.push(answer);

    // Only derive and update status when the student actually answered the question.
    // If answer is null (e.g. they saved notes/ratings but skipped completion), leave status alone.
    if (answer) {
      const statusMap = { yes: 'completed', partially: 'partial', no: 'needs_more_time' };
      sets.push('status = ?');
      vals.push(statusMap[answer] ?? null);
    }
  }

  if ('notes' in data)                    { sets.push('notes = ?');                    vals.push(data.notes || null); }
  if ('focus_score' in data)              { sets.push('focus_score = ?');              vals.push(data.focus_score || null); }
  if ('difficulty_rating' in data)        { sets.push('difficulty_rating = ?');        vals.push(data.difficulty_rating || null); }
  if ('estimated_extra_minutes' in data)  { sets.push('estimated_extra_minutes = ?');  vals.push(data.estimated_extra_minutes || null); }
  if ('task_marked_done' in data)         { sets.push('task_marked_done = ?');         vals.push(data.task_marked_done ? 1 : 0); }
  if ('resume_later' in data)             { sets.push('resume_later = ?');             vals.push(data.resume_later ? true : false); }

  if (sets.length === 0) return session;

  vals.push(id);
  const updated = await db.get(
    `UPDATE study_sessions SET ${sets.join(', ')} WHERE id = ? RETURNING *`,
    vals
  );

  // Mark the linked task completed and fire gamification if requested
  if (data.task_marked_done && session.task_id) {
    await db.run(
      `UPDATE tasks SET status = 'completed' WHERE id = ? AND user_id = ?`,
      [session.task_id, userId]
    );
    gamification.onTaskComplete(userId, session.task_id).catch(err => console.error('[gamification] onTaskComplete failed:', err.message));
  }

  return updated;
}

async function manual(userId, { task_id, start_time, end_time, duration, notes, focus_score, difficulty_rating }) {
  const dur = duration || Math.round((new Date(end_time) - new Date(start_time)) / 1000);
  const session = await db.get(
    `INSERT INTO study_sessions
       (user_id, task_id, start_time, end_time, duration, is_manual, notes, focus_score, difficulty_rating, status)
     VALUES (?,?,?,?,?,1,?,?,?,'completed') RETURNING *`,
    [userId, task_id || null, start_time, end_time || null, dur, notes || null, focus_score || null, difficulty_rating || null]
  );
  gamification.onSessionComplete(userId, session).catch(err => console.error('[gamification] onSessionComplete failed:', err.message));
  return session;
}

async function getTaskTotal(userId, taskId) {
  const row = await db.get(
    `SELECT COALESCE(SUM(duration), 0)::int AS total_seconds
     FROM study_sessions
     WHERE user_id = ? AND task_id = ? AND duration IS NOT NULL`,
    [userId, taskId]
  );
  return { total_seconds: row?.total_seconds || 0 };
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

module.exports = { start, stop, reflect, manual, getAll, getTaskTotal, remove };
