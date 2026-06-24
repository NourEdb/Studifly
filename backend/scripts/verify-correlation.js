'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

pool.query(`
  SELECT TO_CHAR(mc.checkin_date, 'YYYY-MM-DD') AS checkin_date,
         mc.mood_score, mc.energy_score,
         COALESCE(SUM(ss.duration) / 60, 0)::INTEGER AS study_minutes
  FROM mood_checkins mc
  LEFT JOIN study_sessions ss
    ON ss.user_id = mc.user_id
   AND (ss.start_time AT TIME ZONE 'UTC')::DATE = mc.checkin_date
   AND ss.duration IS NOT NULL
  WHERE mc.user_id = 4
  GROUP BY mc.checkin_date, mc.mood_score, mc.energy_score
  ORDER BY mc.checkin_date ASC
`, []).then(r => {
  console.log(`rows: ${r.rows.length}`);
  r.rows.forEach(row =>
    console.log(`  type=${typeof row.checkin_date}  date=${row.checkin_date}  mood=${row.mood_score}  mins=${row.study_minutes}`)
  );
}).finally(() => pool.end());
