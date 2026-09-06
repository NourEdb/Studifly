const db = require('../database/db');
const { getISOWeekBounds } = require('../utils/dateHelpers');
const gamification = require('./gamification.service');

async function start(userId, { task_id, study_block_id }) {
  return db.get(
    'INSERT INTO study_sessions (user_id, task_id, study_block_id, start_time) VALUES (?, ?, ?, NOW()) RETURNING *',
    [userId, task_id || null, study_block_id || null]
  );
}

async function stop(userId, id, breakSeconds = 0) {
  const session = await db.get('SELECT * FROM study_sessions WHERE id = ? AND user_id = ?', [id, userId]);
  if (!session) { const e = new Error('Not found'); e.status = 404; throw e; }
  if (session.end_time) { const e = new Error('Session already stopped'); e.status = 400; throw e; }
  const end_time = new Date();
  const totalSeconds = Math.round((end_time - new Date(session.start_time)) / 1000);
  // Clamp so a clock hiccup (or a client miscount) can never push break time past the
  // total elapsed time and produce a negative duration.
  const breakSec = Math.max(0, Math.min(Math.round(breakSeconds) || 0, totalSeconds));
  const duration = totalSeconds - breakSec;
  const updated = await db.get(
    'UPDATE study_sessions SET end_time = NOW(), duration = ?, break_seconds = ? WHERE id = ? RETURNING *',
    [duration, breakSec, id]
  );
  gamification.onSessionComplete(userId, updated).catch(err => console.error('[gamification] onSessionComplete failed:', err.message));
  return updated;
}

async function completeTaskDirect(userId, taskId) {
  await db.run(`UPDATE tasks SET status = 'completed', completed_at = NOW() WHERE id = ? AND user_id = ?`, [taskId, userId]);
  gamification.onTaskComplete(userId, taskId).catch(err => console.error('[gamification] onTaskComplete failed:', err.message));
}

// Completes a subtask, then completes its parent task too if that was the
// last remaining incomplete subtask. Returns true if the parent got completed.
async function completeSubtaskAndMaybeParent(userId, studyBlockId, taskId) {
  await db.run(`UPDATE study_blocks SET status = 'completed', completed_at = NOW() WHERE id = ? AND user_id = ?`, [studyBlockId, userId]);
  if (!taskId) return false;
  const remaining = await db.get(
    `SELECT COUNT(*)::int AS cnt FROM study_blocks WHERE task_id = ? AND user_id = ? AND status <> 'completed'`,
    [taskId, userId]
  );
  if (remaining.cnt === 0) {
    await completeTaskDirect(userId, taskId);
    return true;
  }
  return false;
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

  if (sets.length === 0) return { ...session, parent_task_completed: false };

  vals.push(id);
  const updated = await db.get(
    `UPDATE study_sessions SET ${sets.join(', ')} WHERE id = ? RETURNING *`,
    vals
  );

  // "Did you complete it?" refers to the subtask when the session was started
  // on one — completing the subtask can in turn auto-complete the parent task.
  let parentTaskCompleted = false;
  if (data.task_marked_done) {
    if (session.study_block_id) {
      parentTaskCompleted = await completeSubtaskAndMaybeParent(userId, session.study_block_id, session.task_id);
    } else if (session.task_id) {
      await completeTaskDirect(userId, session.task_id);
    }
  }

  // Partial answer nudges the subtask (and/or task) to in_progress — never
  // downgrades something already completed.
  if (data.completion_answer === 'partially' && !data.task_marked_done) {
    if (session.study_block_id) {
      await db.run(
        `UPDATE study_blocks SET status = 'in_progress' WHERE id = ? AND user_id = ? AND status <> 'completed'`,
        [session.study_block_id, userId]
      );
    }
    if (session.task_id) {
      await db.run(
        `UPDATE tasks SET status = 'in_progress' WHERE id = ? AND user_id = ? AND status <> 'completed'`,
        [session.task_id, userId]
      );
    }
  }

  return { ...updated, parent_task_completed: parentTaskCompleted };
}

async function manual(userId, { task_id, study_block_id, start_time, end_time, duration, notes, focus_score, difficulty_rating, completion_answer }) {
  const dur = duration || Math.round((new Date(end_time) - new Date(start_time)) / 1000);
  const answer = completion_answer || null;
  const statusMap = { yes: 'completed', partially: 'partial', no: 'needs_more_time' };
  const status = answer ? statusMap[answer] : 'completed';

  const session = await db.get(
    `INSERT INTO study_sessions
       (user_id, task_id, study_block_id, start_time, end_time, duration, is_manual, notes, focus_score, difficulty_rating, status, completion_answer)
     VALUES (?,?,?,?,?,?,1,?,?,?,?,?) RETURNING *`,
    [userId, task_id || null, study_block_id || null, start_time, end_time || null, dur, notes || null, focus_score || null, difficulty_rating || null, status, answer]
  );
  gamification.onSessionComplete(userId, session).catch(err => console.error('[gamification] onSessionComplete failed:', err.message));

  // "Yes!" answer auto-completes the linked subtask (and cascades to the
  // parent task) or, with no subtask selected, the task directly — same as
  // the post-session reflection checkbox.
  let parentTaskCompleted = false;
  if (answer === 'yes') {
    if (study_block_id) {
      parentTaskCompleted = await completeSubtaskAndMaybeParent(userId, study_block_id, task_id);
    } else if (task_id) {
      await completeTaskDirect(userId, task_id);
    }
  }

  return { ...session, parent_task_completed: parentTaskCompleted };
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
  let sql = `SELECT s.*, t.name as task_name, t.course_id, c.name as course_name, c.color as course_color,
                    sb.topic as study_block_topic
             FROM study_sessions s
             LEFT JOIN tasks t ON s.task_id = t.id
             LEFT JOIN courses c ON t.course_id = c.id
             LEFT JOIN study_blocks sb ON s.study_block_id = sb.id
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

// True only if the user's MOST RECENT session is still open (no end_time) and
// started within the last 12 hours. A session left open by a crashed tab,
// closed browser, or logout without stopping it should not mark someone as
// "studying" forever — this is the single source of truth for that check,
// used both for live presence broadcasts and the Friends list query.
async function hasActiveSession(userId) {
  const row = await db.get(
    `SELECT (end_time IS NULL AND start_time >= NOW() - INTERVAL '12 hours') AS active
     FROM study_sessions WHERE user_id = ? ORDER BY start_time DESC LIMIT 1`,
    [userId]
  );
  return !!row?.active;
}

module.exports = { start, stop, reflect, manual, getAll, getTaskTotal, remove, hasActiveSession };
