'use strict';
// One-off: delete and re-seed mood_checkins for demo_student (user_id=4)
// with hardcoded Jun 11–24 2026 dates that align with the Jun 22-24 sessions.
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

// Study activity reference used to design scores:
//   Jun 11: 0 min (rest)      Jun 12: 50 min (seed-demo day 12)
//   Jun 13: 0 min (weekend)   Jun 14: 35 min (seed-demo day 10)
//   Jun 15: 0 min             Jun 16: 40 min (seed-demo day 8)
//   Jun 17: 0 min (rest)      Jun 18: 45 min (seed-demo day 6)
//   Jun 19: 65 min            Jun 20: 125 min
//   Jun 21: 60 min            Jun 22: 165 min (new sessions Mon)
//   Jun 23: 150 min (new Tue) Jun 24: 135 min (new Wed)
//
// [date, mood_score, energy_score, note]
const ROWS = [
  ['2026-06-11', 4, 4, 'Relaxed Sunday, feeling refreshed and ready for the week'],
  ['2026-06-12', 3, 3, 'Managed a session despite low energy'],
  ['2026-06-13', 3, 3, 'Weekend recharge, light reading only'],
  ['2026-06-14', 3, 2, 'Getting back on track slowly'],
  ['2026-06-15', 2, 1, 'Felt off today, hard to focus on anything'],
  ['2026-06-16', 3, 3, null],
  ['2026-06-17', 2, 2, 'Rest day — needed it, but felt a bit unproductive'],
  ['2026-06-18', 3, 3, 'Short session but kept the streak alive'],
  ['2026-06-19', 4, 3, null],
  ['2026-06-20', 4, 4, null],
  ['2026-06-21', 3, 3, 'Lecture series helped but ran out of steam by evening'],
  ['2026-06-22', 5, 5, 'Most productive day in weeks — deep focus all morning'],
  ['2026-06-23', 4, 4, 'Good momentum on the REST API and research proposal'],
  ['2026-06-24', 5, 4, 'Crushing it this week — great focus sessions today 🎉'],
];

async function main() {
  const USER_ID = 4;

  const [{ count }] = await q('SELECT COUNT(*)::int AS count FROM mood_checkins WHERE user_id = ?', [USER_ID]);
  console.log(`Deleting ${count} existing mood_checkins for user_id=${USER_ID}…`);
  await q('DELETE FROM mood_checkins WHERE user_id = ?', [USER_ID]);

  for (const [date, mood, energy, note] of ROWS) {
    await q(
      `INSERT INTO mood_checkins (user_id, mood_score, energy_score, note, checkin_date)
       VALUES (?, ?, ?, ?, ?)`,
      [USER_ID, mood, energy, note, date]
    );
  }

  console.log(`Inserted ${ROWS.length} mood_checkins (Jun 11–24 2026)`);
  console.log('');
  console.log('Dates with study sessions:');
  console.log('  Jun 22 → mood=5 energy=5  (165 min studied)');
  console.log('  Jun 23 → mood=4 energy=4  (150 min studied)');
  console.log('  Jun 24 → mood=5 energy=4  (135 min studied)');
}

main()
  .catch(e => { console.error('Failed:', e.message); process.exit(1); })
  .finally(() => pool.end());
