const db = require('../database/db');
const { getISOWeekBounds } = require('../utils/dateHelpers');
const gamification = require('./gamification.service');

const BUILT_IN_ACTIVITY_TYPES = ['reading', 'practice', 'watching', 'other'];

async function getCustomActivityTypes(userId) {
  const placeholders = BUILT_IN_ACTIVITY_TYPES.map(() => '?').join(', ');
  const rows = await db.all(
    `SELECT DISTINCT activity_type FROM tasks
     WHERE user_id = ? AND activity_type NOT IN (${placeholders})
     ORDER BY activity_type ASC`,
    [userId, ...BUILT_IN_ACTIVITY_TYPES]
  );
  return rows.map(r => r.activity_type);
}

async function getOne(userId, id) {
  const task = await db.get(
    `SELECT t.*, c.name as course_name, c.color as course_color
     FROM tasks t LEFT JOIN courses c ON t.course_id = c.id
     WHERE t.id = ? AND t.user_id = ?`,
    [id, userId]
  );
  if (!task) { const e = new Error('Not found'); e.status = 404; throw e; }
  const sessions = await db.get(
    'SELECT SUM(duration) as total_seconds, COUNT(*) as session_count FROM study_sessions WHERE task_id = ? AND duration IS NOT NULL',
    [id]
  );
  const now = new Date().toISOString().slice(0, 10);
  return { ...task, overdue: task.status !== 'completed' && task.due_date && task.due_date < now, sessions };
}

async function getAll(userId, filters = {}) {
  let sql = `SELECT t.*, c.name as course_name, c.color as course_color,
             COALESCE((SELECT SUM(s.duration) FROM study_sessions s WHERE s.task_id = t.id AND s.duration IS NOT NULL), 0)::int AS actual_seconds
             FROM tasks t LEFT JOIN courses c ON t.course_id = c.id
             WHERE t.user_id = ?`;
  const params = [userId];

  if (filters.course_id) { sql += ' AND t.course_id = ?'; params.push(filters.course_id); }
  if (filters.status) { sql += ' AND t.status = ?'; params.push(filters.status); }
  if (filters.week) {
    const { start, end } = getISOWeekBounds(filters.week);
    sql += ' AND t.due_date >= ? AND t.due_date < ?';
    params.push(start.slice(0, 10), end.slice(0, 10));
  }
  // Completed tasks always sink to the bottom, newest-completed first. Among
  // non-completed tasks: callers that want the Tasks page's manual drag order
  // get sort_order first (falling back to the due-date rule for any task that
  // has never been touched by a drag); callers that explicitly ask to ignore
  // that custom order (course detail, task-picker dropdowns, etc.) always get
  // the plain due-date-then-newest rule, regardless of any custom order.
  const dueDateRule = `t.due_date ASC NULLS LAST, t.created_at DESC`;
  sql += filters.ignore_order
    ? ` ORDER BY (t.status = 'completed'),
             CASE WHEN t.status = 'completed' THEN t.completed_at END DESC NULLS LAST,
             ${dueDateRule}`
    : ` ORDER BY (t.status = 'completed'),
             CASE WHEN t.status = 'completed' THEN t.completed_at END DESC NULLS LAST,
             t.sort_order ASC NULLS LAST,
             ${dueDateRule}`;

  const rows = await db.all(sql, params);
  const now = new Date().toISOString().slice(0, 10);
  return rows.map(r => ({ ...r, overdue: r.status !== 'completed' && r.due_date && r.due_date < now }));
}

// Same due-date-then-newest comparator used as the default order, so a brand
// new task can be merged into an existing custom (dragged) order at the spot
// it would occupy under that default rule, instead of at the top or bottom.
function compareByDueDateRule(a, b) {
  const aHasDue = !!a.due_date;
  const bHasDue = !!b.due_date;
  if (aHasDue && bHasDue) {
    if (a.due_date < b.due_date) return -1;
    if (a.due_date > b.due_date) return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  }
  if (aHasDue !== bHasDue) return aHasDue ? -1 : 1;
  return new Date(b.created_at) - new Date(a.created_at);
}

// Called right after a new non-completed task is inserted. If the user has
// never dragged anything, every task's sort_order is still NULL and the
// default due-date rule in getAll() already ranks the new task correctly —
// nothing to do. Otherwise, merge the new task into the existing custom order
// at the position the due-date rule would place it, then re-lock the whole
// arrangement with fresh sequential sort_order values.
async function insertIntoCustomOrder(userId, newTask) {
  const existing = await db.all(
    `SELECT id, due_date, created_at, sort_order FROM tasks
     WHERE user_id = ? AND status != 'completed' AND id != ?
     ORDER BY sort_order ASC NULLS LAST, due_date ASC NULLS LAST, created_at DESC`,
    [userId, newTask.id]
  );
  const hasCustomOrder = existing.some(t => t.sort_order !== null);
  if (!hasCustomOrder) return;

  let insertAt = existing.length;
  for (let i = 0; i < existing.length; i++) {
    if (compareByDueDateRule(newTask, existing[i]) < 0) { insertAt = i; break; }
  }
  const ids = existing.map(t => t.id);
  ids.splice(insertAt, 0, newTask.id);
  for (let i = 0; i < ids.length; i++) {
    await db.run('UPDATE tasks SET sort_order = ? WHERE id = ? AND user_id = ?', [i, ids[i], userId]);
  }
}

const VALID_CATEGORIES = ['exam', 'homework', 'project', 'other'];

async function create(userId, body) {
  const { name, course_id, activity_type, planned_time, due_date, status, category } = body;
  const task = await db.get(
    'INSERT INTO tasks (user_id, course_id, name, activity_type, planned_time, due_date, status, category) VALUES (?,?,?,?,?,?,?,?) RETURNING *',
    [userId, course_id || null, name, activity_type, planned_time || 0, due_date || null, status || 'pending', VALID_CATEGORIES.includes(category) ? category : 'other']
  );
  if (task.status !== 'completed') {
    await insertIntoCustomOrder(userId, task);
  }
  return getOne(userId, task.id);
}

async function update(userId, id, body) {
  const task = await db.get('SELECT id FROM tasks WHERE id = ? AND user_id = ?', [id, userId]);
  if (!task) { const e = new Error('Not found'); e.status = 404; throw e; }

  const fields = [];
  const params = [];
  // status is intentionally excluded — it is derived from session reflections only
  if (body.name !== undefined) { fields.push('name = ?'); params.push(body.name); }
  if ('course_id' in body) { fields.push('course_id = ?'); params.push(body.course_id || null); }
  if (body.activity_type !== undefined) { fields.push('activity_type = ?'); params.push(body.activity_type); }
  if (body.planned_time !== undefined) { fields.push('planned_time = ?'); params.push(body.planned_time); }
  if ('due_date' in body) { fields.push('due_date = ?'); params.push(body.due_date || null); }
  if (body.category !== undefined) { fields.push('category = ?'); params.push(VALID_CATEGORIES.includes(body.category) ? body.category : 'other'); }

  if (fields.length) {
    params.push(id);
    await db.run(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, params);
  }
  return getOne(userId, id);
}

const VALID_STATUSES = ['pending', 'in_progress', 'completed'];

// Separate from update() on purpose: the edit form's status field is intentionally
// excluded there (status is normally derived from session reflections), but the
// timer and the task list's manual complete/un-complete toggle need an explicit,
// narrow way to set it.
async function updateStatus(userId, id, status) {
  if (!VALID_STATUSES.includes(status)) { const e = new Error('Invalid status'); e.status = 400; throw e; }
  const task = await db.get('SELECT id FROM tasks WHERE id = ? AND user_id = ?', [id, userId]);
  if (!task) { const e = new Error('Not found'); e.status = 404; throw e; }
  if (status === 'completed') {
    await db.run('UPDATE tasks SET status = ?, completed_at = NOW() WHERE id = ?', [status, id]);
  } else {
    await db.run('UPDATE tasks SET status = ?, completed_at = NULL WHERE id = ?', [status, id]);
  }
  return getOne(userId, id);
}

async function remove(userId, id) {
  const task = await db.get('SELECT id FROM tasks WHERE id = ? AND user_id = ?', [id, userId]);
  if (!task) { const e = new Error('Not found'); e.status = 404; throw e; }
  await db.run('DELETE FROM tasks WHERE id = ?', [id]);
}

// Called after a drag-and-drop (or move up/down) reorder — ids is the full
// non-completed list in its new order. Assigning every one of them a
// sort_order (rather than just the moved task) is what makes the custom
// order "stick": once set, none of these rows are NULL any more, so the
// due-date fallback in getAll() never applies to them again.
async function reorder(userId, ids) {
  for (let i = 0; i < ids.length; i++) {
    await db.run('UPDATE tasks SET sort_order = ? WHERE id = ? AND user_id = ?', [i, ids[i], userId]);
  }
  return getAll(userId, {});
}

// "Reset to due-date order" — drops the custom order entirely so getAll()'s
// due-date-then-newest fallback takes over again for every task.
async function resetOrder(userId) {
  await db.run('UPDATE tasks SET sort_order = NULL WHERE user_id = ?', [userId]);
  return getAll(userId, {});
}

module.exports = { getAll, getOne, getCustomActivityTypes, create, update, updateStatus, remove, reorder, resetOrder };
