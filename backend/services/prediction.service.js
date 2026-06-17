const db = require('../database/db');

async function getAvgWeeklyPace(userId) {
  const row = await db.get(
    `SELECT AVG(week_seconds)::int AS avg_weekly_seconds
     FROM (
       SELECT DATE_TRUNC('week', start_time) AS week_start,
              SUM(duration)::int             AS week_seconds
       FROM study_sessions
       WHERE user_id = ?
         AND start_time >= NOW() - INTERVAL '4 weeks'
         AND duration IS NOT NULL
       GROUP BY week_start
     ) weeks`,
    [userId]
  );
  return row?.avg_weekly_seconds || 0;
}

async function getTaskPredictions(userId) {
  const today = new Date().toISOString().slice(0, 10);

  const [tasks, avgWeeklySeconds] = await Promise.all([
    db.all(
      `SELECT t.id, t.name, t.due_date, t.planned_time,
              COALESCE(
                (SELECT SUM(s.duration) FROM study_sessions s
                 WHERE s.task_id = t.id AND s.duration IS NOT NULL),
                0
              )::int AS actual_seconds
       FROM tasks t
       WHERE t.user_id = ?
         AND t.status != 'completed'
         AND t.due_date IS NOT NULL
       ORDER BY t.due_date ASC`,
      [userId]
    ),
    getAvgWeeklyPace(userId),
  ]);

  const dailyPace = avgWeeklySeconds / 7;

  const classified = tasks.map(t => {
    const remaining_seconds = Math.max((t.planned_time || 0) - (t.actual_seconds || 0), 0);
    const due = new Date(t.due_date);
    const todayDate = new Date(today);
    const days_remaining = Math.round((due - todayDate) / (1000 * 60 * 60 * 24));

    let status;
    if (days_remaining < 0) {
      status = 'overdue';
    } else if (avgWeeklySeconds === 0) {
      // No study history — benefit of the doubt, don't alarm the user
      status = 'on_track';
    } else if (dailyPace === 0) {
      status = 'at_risk';
    } else {
      const required_days = remaining_seconds / dailyPace;
      status = required_days <= days_remaining ? 'on_track' : 'at_risk';
    }

    return {
      id: t.id,
      name: t.name,
      due_date: t.due_date,
      days_remaining,
      remaining_seconds,
      status,
    };
  });

  const on_track_count = classified.filter(t => t.status === 'on_track').length;
  const at_risk_count = classified.filter(t => t.status !== 'on_track').length;

  return {
    tasks: classified,
    summary: { on_track_count, at_risk_count, total_count: classified.length },
  };
}

module.exports = { getAvgWeeklyPace, getTaskPredictions };
