const db = require('../database/db');

function err(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// POST /api/mood — submit or update today's check-in
async function submitCheckin(userId, { mood_score, energy_score, note }) {
  if (!mood_score || !energy_score)           throw err(400, 'mood_score and energy_score are required');
  if (mood_score   < 1 || mood_score   > 5)   throw err(400, 'mood_score must be between 1 and 5');
  if (energy_score < 1 || energy_score > 5)   throw err(400, 'energy_score must be between 1 and 5');

  return db.get(
    `INSERT INTO mood_checkins (user_id, mood_score, energy_score, note, checkin_date)
     VALUES (?, ?, ?, ?, CURRENT_DATE)
     ON CONFLICT (user_id, checkin_date)
     DO UPDATE SET mood_score = EXCLUDED.mood_score,
                   energy_score = EXCLUDED.energy_score,
                   note = EXCLUDED.note,
                   created_at = NOW()
     RETURNING *`,
    [userId, mood_score, energy_score, note || null]
  );
}

// GET /api/mood — all check-ins for the user, newest first
async function getCheckins(userId) {
  return db.all(
    `SELECT * FROM mood_checkins WHERE user_id = ? ORDER BY checkin_date DESC`,
    [userId]
  );
}

// GET /api/mood/today — today's check-in or null
async function getTodayCheckin(userId) {
  return db.get(
    `SELECT * FROM mood_checkins WHERE user_id = ? AND checkin_date = CURRENT_DATE`,
    [userId]
  );
}

// GET /api/mood/correlation — daily mood + energy + study_minutes for chart
async function getCorrelation(userId) {
  return db.all(
    `SELECT
       mc.checkin_date,
       mc.mood_score,
       mc.energy_score,
       COALESCE(SUM(ss.duration) / 60, 0)::INTEGER AS study_minutes
     FROM mood_checkins mc
     LEFT JOIN study_sessions ss
       ON ss.user_id = mc.user_id
      AND (ss.start_time AT TIME ZONE 'UTC')::DATE = mc.checkin_date
      AND ss.duration IS NOT NULL
     WHERE mc.user_id = ?
     GROUP BY mc.checkin_date, mc.mood_score, mc.energy_score
     ORDER BY mc.checkin_date ASC`,
    [userId]
  );
}

module.exports = { submitCheckin, getCheckins, getTodayCheckin, getCorrelation };
