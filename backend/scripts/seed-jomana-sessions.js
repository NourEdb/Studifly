'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function q(sql, params = []) {
  let i = 0;
  const { rows } = await pool.query(sql.replace(/\?/g, () => `$${++i}`), params);
  return rows;
}
async function one(sql, params = []) { return (await q(sql, params))[0] || null; }

async function main() {
  // Find jomana's user
  const user = await one(
    `SELECT id, username, email FROM users WHERE username ILIKE '%jomana%' OR email ILIKE '%jomana%'`
  );
  if (!user) {
    console.error('No user matching "jomana" found in users table');
    const all = await q('SELECT id, username, email FROM users ORDER BY id');
    console.log('All users:', all);
    process.exit(1);
  }
  console.log(`Found user: id=${user.id}  username=${user.username}  email=${user.email}`);

  // Check for an existing task to link sessions to (optional — null is fine)
  const task = await one('SELECT id FROM tasks WHERE user_id = ? LIMIT 1', [user.id]);
  const taskId = task?.id || null;
  console.log(taskId ? `Linking sessions to task_id=${taskId}` : 'No tasks found — inserting sessions with task_id=null');

  // Guard: skip if sessions already exist this week
  const existing = await one(
    `SELECT id FROM study_sessions WHERE user_id = ?
     AND start_time >= '2026-06-22T00:00:00Z' AND start_time < '2026-06-29T00:00:00Z'`,
    [user.id]
  );
  if (existing) {
    console.log('Sessions for this week already exist — skipping');
    return;
  }

  // 3 sessions: Mon 90 min, Tue 75 min, Wed 60 min = 225 min ≈ 3h 45m
  const sessions = [
    ['2026-06-22T10:00:00Z', '2026-06-22T11:30:00Z', 90 * 60],
    ['2026-06-23T14:00:00Z', '2026-06-23T15:15:00Z', 75 * 60],
    ['2026-06-24T09:00:00Z', '2026-06-24T10:00:00Z', 60 * 60],
  ];

  for (const [start, end, dur] of sessions) {
    await q(
      `INSERT INTO study_sessions (user_id, task_id, start_time, end_time, duration, is_manual, status)
       VALUES (?, ?, ?, ?, ?, 1, 'completed')`,
      [user.id, taskId, start, end, dur]
    );
  }

  const totalMins = sessions.reduce((s, [,, d]) => s + d / 60, 0);
  console.log(`Inserted ${sessions.length} sessions — ${Math.floor(totalMins / 60)}h ${totalMins % 60}m this week`);
}

main()
  .catch(e => { console.error('Failed:', e.message); process.exit(1); })
  .finally(() => pool.end());
