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

// Varied session patterns so peer stats aren't identical
// [startISO, endISO, durationSecs]
const PEER_SESSIONS = {
  peer1_demo: [
    ['2026-06-22T09:00:00Z', '2026-06-22T10:00:00Z', 60 * 60],
    ['2026-06-23T14:00:00Z', '2026-06-23T15:00:00Z', 60 * 60],
  ],
  peer2_demo: [
    ['2026-06-22T10:00:00Z', '2026-06-22T11:30:00Z', 90 * 60],
    ['2026-06-23T09:00:00Z', '2026-06-23T10:15:00Z', 75 * 60],
    ['2026-06-24T14:00:00Z', '2026-06-24T15:00:00Z', 60 * 60],
  ],
  peer3_demo: [
    ['2026-06-22T13:00:00Z', '2026-06-22T14:30:00Z', 90 * 60],
    ['2026-06-24T10:00:00Z', '2026-06-24T11:00:00Z', 60 * 60],
  ],
  peer4_demo: [
    ['2026-06-22T08:00:00Z', '2026-06-22T09:30:00Z', 90 * 60],
    ['2026-06-23T13:00:00Z', '2026-06-23T14:00:00Z', 60 * 60],
    ['2026-06-24T09:00:00Z', '2026-06-24T10:30:00Z', 90 * 60],
  ],
};

async function main() {
  for (const [username, sessions] of Object.entries(PEER_SESSIONS)) {
    const user = await one('SELECT id FROM users WHERE username = ?', [username]);
    if (!user) {
      console.log(`  ${username}: not found — skipping`);
      continue;
    }

    const existing = await one(
      `SELECT id FROM study_sessions WHERE user_id = ?
       AND start_time >= '2026-06-22T00:00:00Z' AND start_time < '2026-06-29T00:00:00Z'`,
      [user.id]
    );
    if (existing) {
      console.log(`  ${username} (id=${user.id}): already has sessions this week — skipping`);
      continue;
    }

    const task = await one('SELECT id FROM tasks WHERE user_id = ? LIMIT 1', [user.id]);
    const taskId = task?.id || null;

    for (const [start, end, dur] of sessions) {
      await q(
        `INSERT INTO study_sessions (user_id, task_id, start_time, end_time, duration, is_manual, status)
         VALUES (?, ?, ?, ?, ?, 1, 'completed')`,
        [user.id, taskId, start, end, dur]
      );
    }

    const totalMins = sessions.reduce((s, [,, d]) => s + d / 60, 0);
    console.log(`  ${username} (id=${user.id}): inserted ${sessions.length} sessions — ${Math.floor(totalMins / 60)}h ${totalMins % 60}m`);
  }

  console.log('\n✅ Peer sessions seeded for Jun 22–24 2026');
}

main()
  .catch(e => { console.error('Failed:', e.message); process.exit(1); })
  .finally(() => pool.end());
