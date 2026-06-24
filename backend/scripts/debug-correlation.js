'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

const USER_ID = 4;

async function run() {
  // 1. Raw mood_checkins
  const checkins = await pool.query(
    `SELECT checkin_date, mood_score, energy_score FROM mood_checkins WHERE user_id = $1 ORDER BY checkin_date`,
    [USER_ID]
  );
  console.log(`\nmood_checkins rows: ${checkins.rows.length}`);
  checkins.rows.forEach(r => console.log(`  ${r.checkin_date} → mood=${r.mood_score} energy=${r.energy_score}`));

  // 2. Raw study_sessions for this range
  const sessions = await pool.query(
    `SELECT start_time, end_time, duration,
            (start_time AT TIME ZONE 'UTC')::DATE AS utc_date
     FROM study_sessions
     WHERE user_id = $1
       AND start_time >= '2026-06-11' AND start_time < '2026-06-25'
       AND duration IS NOT NULL
     ORDER BY start_time`,
    [USER_ID]
  );
  console.log(`\nstudy_sessions rows (Jun 11-24, duration not null): ${sessions.rows.length}`);
  sessions.rows.forEach(r =>
    console.log(`  ${r.start_time.toISOString().slice(0,10)} utc_date=${r.utc_date} dur=${r.duration}s`)
  );

  // 3. The current getCorrelation query
  const current = await pool.query(
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
     WHERE mc.user_id = $1
     GROUP BY mc.checkin_date, mc.mood_score, mc.energy_score
     ORDER BY mc.checkin_date ASC`,
    [USER_ID]
  );
  console.log(`\ngetCorrelation result rows: ${current.rows.length}`);
  current.rows.forEach(r =>
    console.log(`  ${r.checkin_date} mood=${r.mood_score} energy=${r.energy_score} study_minutes=${r.study_minutes}`)
  );

  // 4. Check checkin_date type
  const typeCheck = await pool.query(
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_name = 'mood_checkins' AND column_name = 'checkin_date'`
  );
  console.log(`\ncheckin_date column type: ${typeCheck.rows[0]?.data_type}`);
}

run()
  .catch(e => console.error('Error:', e.message))
  .finally(() => pool.end());
