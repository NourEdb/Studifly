const db = require('../database/db');

function toCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = v => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return (s.includes(',') || s.includes('"') || s.includes('\n'))
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n');
}

async function exportCourses(userId) {
  const rows = await db.all(
    'SELECT id, name, color, created_at FROM courses WHERE user_id = ? ORDER BY name ASC',
    [userId]
  );
  return toCsv(rows);
}

async function exportTasks(userId) {
  const rows = await db.all(
    `SELECT t.id, t.name, t.activity_type, t.planned_time, t.due_date, t.status,
            c.name AS course_name, t.created_at
     FROM tasks t LEFT JOIN courses c ON c.id = t.course_id
     WHERE t.user_id = ? ORDER BY t.created_at DESC`,
    [userId]
  );
  return toCsv(rows);
}

async function exportSessions(userId) {
  const rows = await db.all(
    `SELECT s.id, s.start_time, s.end_time, s.duration, s.is_manual,
            s.completion_answer, s.focus_score, s.difficulty_rating, s.notes,
            t.name AS task_name
     FROM study_sessions s LEFT JOIN tasks t ON t.id = s.task_id
     WHERE s.user_id = ? ORDER BY s.start_time DESC`,
    [userId]
  );
  return toCsv(rows);
}

async function exportEvents(userId) {
  const rows = await db.all(
    'SELECT id, title, type, event_date, event_time, notes, reminder_sent, created_at FROM events WHERE user_id = ? ORDER BY event_date ASC',
    [userId]
  );
  return toCsv(rows);
}

module.exports = { exportCourses, exportTasks, exportSessions, exportEvents };
