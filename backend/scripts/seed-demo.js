'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

function pgify(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function q(sql, params = []) {
  const { rows } = await pool.query(pgify(sql), params);
  return rows;
}

async function one(sql, params = []) {
  return (await q(sql, params))[0] || null;
}

function daysAgo(n) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

function sessionTime(daysBack, hour, minute = 0) {
  const base = daysAgo(daysBack);
  return new Date(base.getTime() + hour * 3_600_000 + minute * 60_000).toISOString();
}

function daysFromNow(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function currentISOWeek() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dow = jan4.getUTCDay() || 7;
  const weekOneMonday = new Date(jan4.getTime() - (dow - 1) * 86_400_000);
  const diff = now - weekOneMonday;
  const week = Math.floor(diff / (7 * 86_400_000)) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

async function main() {
  const existing = await one('SELECT id FROM users WHERE username = ?', ['demo_student']);
  if (existing) {
    console.log('Demo account already exists (demo_student) — skipping. Delete the user first to re-seed.');
    return;
  }

  console.log('Seeding demo account...');

  // 1. Demo user
  const passwordHash = bcrypt.hashSync('StudiflyDemo2026!', 10);
  const demoUser = await one(
    `INSERT INTO users (username, email, password_hash, display_name)
     VALUES (?, ?, ?, ?) RETURNING id`,
    ['demo_student', 'demo@studifly.local', passwordHash, 'Demo Student']
  );
  const userId = demoUser.id;
  console.log(`  Created demo user id=${userId}`);

  // 2. Courses
  const courseData = [
    { name: 'Linear Algebra',     color: '#6C4DC4' }, // 0
    { name: 'Machine Learning',   color: '#4A9FE0' }, // 1
    { name: 'Web Development',    color: '#34C68A' }, // 2
    { name: 'Research Methods',   color: '#E87AB0' }, // 3
    { name: 'History of Science', color: '#F5C842' }, // 4
  ];
  const courseIds = [];
  for (const c of courseData) {
    const row = await one(
      'INSERT INTO courses (user_id, name, color) VALUES (?, ?, ?) RETURNING id',
      [userId, c.name, c.color]
    );
    courseIds.push(row.id);
  }
  console.log(`  Created ${courseIds.length} courses`);

  // 3. Tasks
  // [courseIdx, name, activityType, plannedSecs, status, dueDaysFromNow|null]
  const taskData = [
    // Completed (indices 0–9)
    [0, 'Chapter 5 Exercises',          'practice', 3600,  'completed', null],
    [0, 'Midterm Review Notes',         'reading',  5400,  'completed', null],
    [1, 'Implement Linear Regression',  'practice', 7200,  'completed', null],
    [1, 'Read Bishop Ch.3',             'reading',  4500,  'completed', null],
    [1, 'Andrew Ng Lecture Series',     'watching', 5400,  'completed', null],
    [2, 'Build REST API',               'practice', 9000,  'completed', null],
    [2, 'CSS Responsive Layout',        'practice', 3600,  'completed', null],
    [3, 'Literature Review Draft',      'reading',  7200,  'completed', null],
    [4, 'Ancient Astronomy Essay',      'reading',  5400,  'completed', null],
    [0, 'Practice Problems Set 3',      'practice', 2700,  'completed', null],
    // In-progress (indices 10–11)
    [1, 'Neural Networks Deep Dive',    'practice', 10800, 'in_progress', null],
    [2, 'Frontend Dashboard Project',   'practice', 7200,  'in_progress', null],
    // Pending with due dates (indices 12–14, triggers prediction card)
    [3, 'Final Research Proposal',      'other',    9000,  'pending', 5],
    [0, 'Final Exam Preparation',       'practice', 14400, 'pending', 8],
    [4, 'Final History Paper',          'reading',  10800, 'pending', 12],
    // Pending no due date (indices 15–17)
    [2, 'Deploy to Production',         'other',    5400,  'pending', null],
    [1, 'Kaggle Competition Entry',     'practice', 7200,  'pending', null],
    [4, 'Supplementary Reading List',   'reading',  3600,  'pending', null],
  ];

  const taskIds = [];
  for (const [ci, name, actType, planned, status, due] of taskData) {
    const dueDate = due !== null ? daysFromNow(due) : null;
    const row = await one(
      `INSERT INTO tasks (user_id, course_id, name, activity_type, planned_time, status, due_date)
       VALUES (?,?,?,?,?,?,?) RETURNING id`,
      [userId, courseIds[ci], name, actType, planned, status, dueDate]
    );
    taskIds.push(row.id);
  }
  console.log(`  Created ${taskIds.length} tasks`);

  // 4. Study sessions
  // [taskIdx|null, daysBack, hourUTC, durationMins, focusScore, difficulty, completionAnswer, taskMarkedDone]
  // Days 0–6 form a 7-day consecutive streak; days 8–24 add heatmap variety + badge triggers
  const sessionData = [
    [2,    0,  9,  70, 4, 3, 'yes', 1],  // Implement Linear Regression — today
    [3,    0, 14,  50, 5, 2, 'yes', 1],  // Read Bishop Ch.3 — today
    [5,    1, 10,  90, 4, 4, 'yes', 1],  // Build REST API — yesterday
    [0,    2,  8,  60, 3, 3, 'yes', 1],  // Chapter 5 Exercises
    [1,    2, 15,  75, 4, 2, 'yes', 1],  // Midterm Review Notes
    [4,    3, 19,  60, 5, 1, 'yes', 1],  // Andrew Ng Lectures
    [6,    4,  9,  45, 3, 2, 'yes', 1],  // CSS Responsive Layout
    [7,    4, 14,  80, 4, 3, 'yes', 1],  // Literature Review Draft
    [8,    5, 16,  65, 4, 2, 'yes', 1],  // Ancient Astronomy Essay
    [9,    6, 10,  45, 5, 1, 'yes', 1],  // Practice Problems Set 3
    // Older sessions — heatmap and badge coverage
    [null, 8,  22,  40, 3, 3, null, 0],  // Night session (night_owl: hour >= 22)
    [null, 10,  7,  35, 4, 2, null, 0],  // Early morning (early_bird: hour < 8)
    [null, 12, 13,  50, 4, 3, null, 0],
    [null, 14, 17,  45, 3, 4, null, 0],
    [null, 16, 11,  60, 5, 2, null, 0],
    [null, 18, 15,  55, 4, 3, null, 0],
    [null, 20,  8,  70, 3, 3, null, 0],
    [null, 22, 20,  45, 4, 2, null, 0],
    [null, 24, 10,  50, 5, 1, null, 0],
  ];

  const sessionIds = [];
  for (const [ti, dBack, hour, dur, focus, diff, compAns, tmd] of sessionData) {
    const taskId = ti !== null ? taskIds[ti] : null;
    const start = sessionTime(dBack, hour);
    const end = new Date(new Date(start).getTime() + dur * 60_000).toISOString();
    const durSecs = dur * 60;
    const status = compAns === 'yes' ? 'completed' : null;
    const row = await one(
      `INSERT INTO study_sessions
         (user_id, task_id, start_time, end_time, duration, is_manual,
          focus_score, difficulty_rating, completion_answer, task_marked_done, status)
       VALUES (?,?,?,?,?,1,?,?,?,?,?) RETURNING id`,
      [userId, taskId, start, end, durSecs, focus, diff, compAns, tmd, status]
    );
    sessionIds.push(row.id);
  }
  console.log(`  Created ${sessionIds.length} sessions (7-day streak days 0–6)`);

  // 5. Peer users (4 peers so peer_count >= 3 threshold is met)
  const peerDefs = [
    {
      username: 'peer1_demo',
      tasks: [['completed', 2700, 'practice'], ['pending', 3600, 'reading']],
      sessionMins: [55, 30],
    },
    {
      username: 'peer2_demo',
      tasks: [['completed', 3600, 'practice'], ['completed', 4500, 'reading'], ['pending', 5400, 'other']],
      sessionMins: [90, 30],
    },
    {
      username: 'peer3_demo',
      tasks: [['completed', 3600, 'practice'], ['completed', 2700, 'reading']],
      sessionMins: [60],
    },
    {
      username: 'peer4_demo',
      tasks: [['completed', 5400, 'practice'], ['completed', 3600, 'reading'], ['pending', 7200, 'other'], ['pending', 4500, 'practice']],
      sessionMins: [60, 45, 45],
    },
  ];

  let peerSessionCount = 0;
  for (const p of peerDefs) {
    const pRow = await one(
      `INSERT INTO users (username, email, password_hash)
       VALUES (?, ?, ?)
       ON CONFLICT (username) DO NOTHING RETURNING id`,
      [p.username, `${p.username}@studifly.local`, bcrypt.hashSync('x', 4)]
    );
    if (!pRow) continue;
    const pid = pRow.id;

    const pTaskIds = [];
    for (const [status, planned, actType] of p.tasks) {
      const pt = await one(
        `INSERT INTO tasks (user_id, name, activity_type, planned_time, status)
         VALUES (?,?,?,?,?) RETURNING id`,
        [pid, 'Sample Task', actType, planned, status]
      );
      pTaskIds.push(pt.id);
    }

    for (let i = 0; i < p.sessionMins.length; i++) {
      const dur = p.sessionMins[i];
      const start = sessionTime(0, 9 + i * 3, i * 10);
      const end = new Date(new Date(start).getTime() + dur * 60_000).toISOString();
      await q(
        `INSERT INTO study_sessions (user_id, task_id, start_time, end_time, duration, is_manual)
         VALUES (?,?,?,?,?,1)`,
        [pid, pTaskIds[0] || null, start, end, dur * 60]
      );
      peerSessionCount++;
    }
  }
  console.log(`  Created 4 peer users with ${peerSessionCount} sessions this week`);

  // 6. XP log + badges for demo user
  let totalXp = 0;

  // Task completions: 50 XP each for tasks 0–9
  for (let i = 0; i < 10; i++) {
    await q(
      `INSERT INTO xp_log (user_id, amount, ref_type, ref_id)
       VALUES (?,50,'task',?)
       ON CONFLICT (user_id, ref_type, ref_id) DO NOTHING`,
      [userId, String(taskIds[i])]
    );
    totalXp += 50;
  }

  // Session time: +10 per 30 min
  for (let i = 0; i < sessionIds.length; i++) {
    const dur = sessionData[i][3]; // durationMins
    const units = Math.floor(dur / 30);
    if (units > 0) {
      await q(
        `INSERT INTO xp_log (user_id, amount, ref_type, ref_id)
         VALUES (?,?,'session',?)
         ON CONFLICT (user_id, ref_type, ref_id) DO NOTHING`,
        [userId, units * 10, String(sessionIds[i])]
      );
      totalXp += units * 10;
    }
  }

  // Weekly goal achievement
  const weekKey = currentISOWeek();
  await q(
    `INSERT INTO xp_log (user_id, amount, ref_type, ref_id)
     VALUES (?,100,'weekly_goal',?)
     ON CONFLICT (user_id, ref_type, ref_id) DO NOTHING`,
    [userId, weekKey]
  );
  totalXp += 100;

  await q(
    `INSERT INTO user_xp (user_id, total_xp)
     VALUES (?,?)
     ON CONFLICT (user_id) DO UPDATE SET total_xp = ?, updated_at = NOW()`,
    [userId, totalXp, totalXp]
  );

  // Badges
  const badges = ['first_task', 'week_streak', 'goal_crusher', 'night_owl'];
  for (const b of badges) {
    await q(
      `INSERT INTO user_badges (user_id, badge_key)
       VALUES (?,?)
       ON CONFLICT (user_id, badge_key) DO NOTHING`,
      [userId, b]
    );
  }

  // Pin a badge so the sidebar looks nice
  await q('UPDATE users SET pinned_badge = ? WHERE id = ?', ['week_streak', userId]);

  const level = Math.floor(totalXp / 200) + 1;
  console.log(`  ${totalXp} XP, Level ${level}, ${badges.length} badges awarded`);
  console.log('');
  console.log('✅ Demo account ready!');
  console.log('   Login: demo_student / StudiflyDemo2026!');
  console.log(`   ${taskData.length} tasks · ${sessionData.length} sessions · ${badges.length} badges · ${totalXp} XP (Level ${level})`);
}

main()
  .catch(e => { console.error('Seed failed:', e.message); process.exit(1); })
  .finally(() => pool.end());
