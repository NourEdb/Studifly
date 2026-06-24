'use strict';
/**
 * Adds mood_checkins and study_blocks demo data for the demo_student account.
 * Run AFTER seed-demo.js has created the demo_student user.
 *
 *   node backend/scripts/seed-demo-data.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

function pgify(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}
async function q(sql, params = [])   { const { rows } = await pool.query(pgify(sql), params); return rows; }
async function one(sql, params = []) { return (await q(sql, params))[0] || null; }

// ── Date helpers ─────────────────────────────────────────────────────────────

function todayUTC() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// YYYY-MM-DD string for today minus N days (UTC midnight)
function dateStr(daysBack) {
  const d = new Date(todayUTC());
  d.setUTCDate(d.getUTCDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

// Monday of the ISO week that is `weeksBack` weeks ago
function isoWeekMonday(weeksBack = 0) {
  const today = todayUTC();
  const dow = today.getUTCDay() || 7; // 1=Mon … 7=Sun
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - (dow - 1) - weeksBack * 7);
  return monday;
}

// YYYY-MM-DD for day `dayIndex` (0=Mon … 6=Sun) of week `weeksBack` ago
function weekDate(weeksBack, dayIndex) {
  const monday = isoWeekMonday(weeksBack);
  const d = new Date(monday);
  d.setUTCDate(monday.getUTCDate() + dayIndex);
  return d.toISOString().slice(0, 10);
}

// True if a YYYY-MM-DD date has already passed (or is today)
function isPast(dateStr_) {
  return dateStr_ <= new Date().toISOString().slice(0, 10);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const demo = await one('SELECT id FROM users WHERE username = ?', ['demo_student']);
  if (!demo) {
    console.error('demo_student not found — run seed-demo.js first');
    process.exit(1);
  }
  const userId = demo.id;
  console.log(`Found demo_student id=${userId}`);

  // ── 1. mood_checkins ───────────────────────────────────────────────────────
  //
  // 14 days of data designed to show a positive correlation between study
  // activity and mood/energy (cross-referenced with the sessions from seed-demo.js).
  //
  // Study activity reference (from seed-demo.js):
  //   Day 0: 120 min  Day 1: 90 min  Day 2: 135 min  Day 3: 60 min
  //   Day 4: 125 min  Day 5: 65 min  Day 6: 45 min   Day 7: 0 min
  //   Day 8: 40 min   Day 9:  0 min  Day 10: 35 min  Day 11: 0 min
  //   Day 12: 50 min  Day 13: 0 min

  // [daysBack, mood_score, energy_score, note]
  const moodRows = [
    [0,  5, 4, 'Crushed two sessions today — everything just clicked 🎉'],
    [1,  4, 4, 'Good momentum building the REST API'],
    [2,  5, 5, 'Most productive day in weeks, deep focus all morning'],
    [3,  3, 3, 'Lecture series helped but ran out of steam by evening'],
    [4,  4, 4, null],
    [5,  4, 3, null],
    [6,  3, 3, 'Short session but kept the streak alive'],
    [7,  2, 2, 'Rest day — needed it, but felt a bit unproductive'],
    [8,  3, 3, null],
    [9,  2, 1, 'Felt off today, hard to focus on anything'],
    [10, 3, 2, 'Getting back on track slowly'],
    [11, 3, 3, 'Weekend recharge, light reading only'],
    [12, 3, 3, 'Managed a session despite low energy'],
    [13, 4, 4, 'Relaxed Sunday, feeling refreshed and ready for the week'],
  ];

  const existingMood = await one('SELECT id FROM mood_checkins WHERE user_id = ?', [userId]);
  if (existingMood) {
    console.log('  mood_checkins already seeded — skipping');
  } else {
    for (const [daysBack, mood, energy, note] of moodRows) {
      await q(
        `INSERT INTO mood_checkins (user_id, mood_score, energy_score, note, checkin_date)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (user_id, checkin_date) DO NOTHING`,
        [userId, mood, energy, note, dateStr(daysBack)]
      );
    }
    console.log(`  Inserted ${moodRows.length} mood check-ins (days 0–13)`);
  }

  // ── 2. study_blocks ────────────────────────────────────────────────────────
  //
  // Builds the "Study Plan vs Reality" chart on Dashboard (current week only).
  // Last week blocks provide historical context.
  //
  // Task lookup by name — these all exist in seed-demo.js.

  const taskNames = [
    'Chapter 5 Exercises',
    'Midterm Review Notes',
    'Implement Linear Regression',
    'Read Bishop Ch.3',
    'Andrew Ng Lecture Series',
    'Build REST API',
    'CSS Responsive Layout',
    'Literature Review Draft',
    'Ancient Astronomy Essay',
    'Practice Problems Set 3',
    'Neural Networks Deep Dive',
    'Frontend Dashboard Project',
    'Final Research Proposal',
    'Final Exam Preparation',
    'Final History Paper',
    'Deploy to Production',
    'Kaggle Competition Entry',
    'Supplementary Reading List',
  ];

  const taskMap = {};
  for (const name of taskNames) {
    const row = await one('SELECT id FROM tasks WHERE user_id = ? AND name = ?', [userId, name]);
    if (row) taskMap[name] = row.id;
  }
  console.log(`  Resolved ${Object.keys(taskMap).length}/${taskNames.length} task IDs`);

  const existingBlocks = await one('SELECT id FROM study_blocks WHERE user_id = ?', [userId]);
  if (existingBlocks) {
    console.log('  study_blocks already seeded — skipping');
  } else {
    // [weeksBack, dayIndex(0=Mon), taskName, startHH:MM, endHH:MM, topic, completionPctWhenPast]
    //
    // completionPctWhenPast is inserted as-is if the block date is past/today,
    // or as NULL if the block is in the future (no actual data yet).
    const blockDefs = [
      // ── This week ───────────────────────────────────────────────────────
      // Mon — Linear Algebra review session + ML deep dive
      [0, 0, 'Final Exam Preparation',    '09:00', '11:00', 'Chapters 1–4 review',             100],
      [0, 0, 'Neural Networks Deep Dive', '14:00', '15:30', 'Backpropagation walkthrough',       85],
      // Tue — Web Dev + Research
      [0, 1, 'Frontend Dashboard Project','10:00', '12:00', 'Chart components & layout',         75],
      [0, 1, 'Final Research Proposal',   '15:00', '16:00', 'Outline and introduction draft',    60],
      // Wed — ML + Kaggle (likely future)
      [0, 2, 'Neural Networks Deep Dive', '09:30', '11:00', 'CNNs & pooling layers',             90],
      [0, 2, 'Kaggle Competition Entry',  '14:00', '15:00', 'Feature engineering experiments',   70],
      // Thu — Linear Algebra + Web Dev (future)
      [0, 3, 'Final Exam Preparation',    '10:00', '11:30', 'Problem sets Ch.5–7',              null],
      [0, 3, 'Frontend Dashboard Project','15:00', '16:30', 'Auth flow & user settings',        null],
      // Fri — Research + History (future)
      [0, 4, 'Final Research Proposal',   '10:00', '12:00', 'Related work & citations',         null],
      [0, 4, 'Supplementary Reading List','14:00', '15:00', 'Newton & Galileo primary sources', null],

      // ── Last week (all past, varied completion) ──────────────────────────
      // Mon
      [1, 0, 'Chapter 5 Exercises',       '09:00', '10:00', 'Row reduction & determinants',     100],
      [1, 0, 'Implement Linear Regression','14:00', '15:30', 'Gradient descent implementation',  90],
      // Tue
      [1, 1, 'Build REST API',            '10:00', '12:30', 'CRUD endpoints & middleware',        80],
      [1, 1, 'Read Bishop Ch.3',          '15:00', '16:15', 'Bayesian inference & priors',        65],
      // Wed
      [1, 2, 'CSS Responsive Layout',     '09:00', '10:00', 'Mobile breakpoints & grid',         100],
      [1, 2, 'Literature Review Draft',   '14:00', '15:30', 'Annotating key sources',             75],
      // Thu
      [1, 3, 'Midterm Review Notes',      '10:00', '11:30', 'Key theorems summary sheet',         85],
      [1, 3, 'Andrew Ng Lecture Series',  '15:00', '16:30', 'CNN lecture series 7–9',             70],
      // Fri
      [1, 4, 'Ancient Astronomy Essay',   '09:00', '10:30', 'Ptolemy vs Copernicus argument',     90],
      [1, 4, 'Practice Problems Set 3',   '14:00', '14:45', 'Eigenvalues & eigenvectors',        100],
    ];

    let inserted = 0;
    for (const [wBack, dayIdx, taskName, start, end, topic, completionWhenPast] of blockDefs) {
      const taskId = taskMap[taskName];
      if (!taskId) {
        console.warn(`  WARNING: task "${taskName}" not found — skipping block`);
        continue;
      }

      const planDate = weekDate(wBack, dayIdx);
      const completion = isPast(planDate) ? completionWhenPast : null;

      await q(
        `INSERT INTO study_blocks (user_id, task_id, plan_date, start_time, end_time, topic, completion_pct)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, taskId, planDate, start, end, topic, completion]
      );
      inserted++;
    }

    // Print a summary of what the PlanVsActual chart will show
    const thisWeekBlocks = blockDefs.filter(([wBack]) => wBack === 0);
    const summary = {};
    for (const [, dayIdx, taskName, start, end, , completionWhenPast] of thisWeekBlocks) {
      const planDate = weekDate(0, dayIdx);
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      const plannedMins = (eh * 60 + em) - (sh * 60 + sm);
      const actualMins  = isPast(planDate) && completionWhenPast != null
        ? Math.round(plannedMins * completionWhenPast / 100)
        : 0;
      const label = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][dayIdx];
      if (!summary[label]) summary[label] = { planned: 0, actual: 0 };
      summary[label].planned += plannedMins;
      summary[label].actual  += actualMins;
    }

    console.log(`  Inserted ${inserted} study blocks`);
    console.log('  This-week Plan vs Reality:');
    for (const [day, { planned, actual }] of Object.entries(summary)) {
      const bar = actual > 0 ? `${actual}m / ${planned}m planned` : `${planned}m planned (future)`;
      console.log(`    ${day}: ${bar}`);
    }
  }

  // ── 3. This-week study sessions (Jun 22–24, 2026) ────────────────────────
  //
  // seed-demo.js used relative daysAgo() so those sessions are now weeks old.
  // These hardcoded sessions land in the current ISO week so the Dashboard
  // "This week" stat, Prediction Card, and Peer Comparison all show real data.
  //
  // [taskName, startISO, endISO, durationSecs, focusScore, difficultyRating]
  const weekSessions = [
    // Mon Jun 22
    ['Final Exam Preparation',    '2026-06-22T09:00:00Z', '2026-06-22T10:30:00Z', 90 * 60, 4, 3],
    ['Neural Networks Deep Dive', '2026-06-22T14:00:00Z', '2026-06-22T15:15:00Z', 75 * 60, 5, 4],
    // Tue Jun 23
    ['Frontend Dashboard Project','2026-06-23T10:00:00Z', '2026-06-23T11:30:00Z', 90 * 60, 4, 3],
    ['Final Research Proposal',   '2026-06-23T15:30:00Z', '2026-06-23T16:30:00Z', 60 * 60, 3, 3],
    // Wed Jun 24
    ['Neural Networks Deep Dive', '2026-06-24T09:00:00Z', '2026-06-24T10:15:00Z', 75 * 60, 4, 4],
    ['Final Exam Preparation',    '2026-06-24T13:00:00Z', '2026-06-24T14:00:00Z', 60 * 60, 5, 3],
  ];

  const existingWeekSessions = await one(
    `SELECT id FROM study_sessions WHERE user_id = ?
     AND start_time >= '2026-06-22T00:00:00Z' AND start_time < '2026-06-29T00:00:00Z'`,
    [userId]
  );

  if (existingWeekSessions) {
    console.log('  this-week sessions already seeded — skipping');
  } else {
    let sessionCount = 0;
    let totalMins = 0;
    for (const [taskName, start, end, durSecs, focus, diff] of weekSessions) {
      const taskId = taskMap[taskName] || null;
      await q(
        `INSERT INTO study_sessions
           (user_id, task_id, start_time, end_time, duration, is_manual,
            focus_score, difficulty_rating, completion_answer, task_marked_done, status)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?, 'yes', 0, 'completed')`,
        [userId, taskId, start, end, durSecs, focus, diff]
      );
      sessionCount++;
      totalMins += durSecs / 60;
    }
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    console.log(`  Inserted ${sessionCount} sessions for Jun 22–24 → ${h}h ${m}m this week`);
  }

  console.log('');
  console.log('✅ Demo data ready!');
  console.log('   Mood check-ins: 14 days (shows correlation with study activity)');
  console.log('   Study blocks: current week + last week (feeds Plan vs Reality chart)');
  console.log('   This-week sessions: Jun 22–24, 2026 (fixes Dashboard, Prediction, Peers)');
}

main()
  .catch(e => { console.error('Seed failed:', e.message); process.exit(1); })
  .finally(() => pool.end());
