'use strict';
/**
 * Demo seed for the final presentation.
 *
 * Fills the DB so the `studifly_demo` dashboard shows a real peer comparison
 * and a live study streak. Only ADDS data — no app logic or schema changes.
 *
 *   npm run seed:demo                  # seed / refresh (idempotent)
 *   npm run seed:demo -- --dry-run     # do everything, print results, ROLLBACK
 *   npm run seed:demo -- --clean       # remove all demo seed data
 *   npm run seed:demo -- --streak-days=10
 *
 * What it creates:
 *   - 18 fake students with realistic usernames (maya_levi, noa.cohen, ...) and
 *     email `demo_peer_01..18@demo.studifly` (the marker — peers are keyed on it),
 *     each with 2 courses, 5–10 tasks (varied completion) and study sessions for
 *     the current week + the previous 4 weeks.
 *   - Friendships between `studifly_demo` and a few peers (5 accepted, 1 pending).
 *   - For `studifly_demo` only: one study session on every day of the last N
 *     days (Israel time, ending today) that has no real session, so the streak
 *     is >= N. These sessions are fingerprinted with is_manual = 1 and a
 *     start_time of hh:mm:17.777 — invisible in the UI (it shows hh:mm) and
 *     never produced by the real app — so they can be found and replaced.
 *
 * Re-running first wipes everything above, then re-creates it relative to
 * "now", so run it again on the morning of the demo to keep the streak and the
 * current-week numbers fresh. Real users' data is never touched.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { getISOWeekBounds, currentISOWeek } = require('../utils/dateHelpers');

// ── Config ───────────────────────────────────────────────────────────────────

const DEMO_USERNAME   = 'studifly_demo';
const MARKER_DOMAIN   = '@demo.studifly';
const TZ              = 'Asia/Jerusalem';
const PAST_WEEKS      = 4;
const PEER_PASSWORD   = process.env.DEMO_PEER_PASSWORD || 'DemoPeer2026!';
const SEED_SECONDS    = 17;   // fingerprint for seeded studifly_demo sessions:
const SEED_MS         = 777;  //   start_time = hh:mm:17.777, is_manual = 1
const FINGERPRINT_SQL = `is_manual = 1 AND EXTRACT(MILLISECONDS FROM start_time) = ${SEED_SECONDS * 1000 + SEED_MS}`;

const args        = process.argv.slice(2);
const CLEAN       = args.includes('--clean');
const DRY_RUN     = args.includes('--dry-run');
const streakArg   = args.find(a => a.startsWith('--streak-days='));
const STREAK_DAYS = streakArg ? Math.max(1, parseInt(streakArg.split('=')[1], 10) || 7) : 7;

// username, display name, weekly study hours baseline, task completion rate.
// Peers are identified by their email (demo_peer_NN@demo.studifly, by position
// in this list), never by username — usernames can be renamed freely, as long
// as they stay unique. Rates are low-ish on purpose: real users (~61% avg) are
// in the peer average too, and this pulls the overall to ~40% so studifly_demo
// (47%) shows above it.
const PEERS = [
  ['maya_levi',      'Maya Levi',        9.5, 0.50],
  ['omar_haddad',    'Omar Haddad',      4.0, 0.15],
  ['noa.cohen',      'Noa Cohen',       11.0, 0.60],
  ['yousef.k',       'Yousef Khalil',    2.5, 0.10],
  ['danielmizrahi',  'Daniel Mizrahi',   6.5, 0.25],
  ['lina_nassar',    'Lina Nassar',      8.0, 0.40],
  ['itai.peretz',    'Itai Peretz',      3.0, 0.10],
  ['rana_s',         'Rana Saleh',       7.0, 0.30],
  ['tamar.friedman', 'Tamar Friedman',   5.5, 0.20],
  ['ahmad_jaber',    'Ahmad Jaber',      1.5, 0.10],
  ['shira_bd',       'Shira Ben-David', 10.0, 0.45],
  ['karim.awad',     'Karim Awad',       5.0, 0.15],
  ['yaelshapiro',    'Yael Shapiro',     6.0, 0.25],
  ['hiba.mansour',   'Hiba Mansour',     8.5, 0.35],
  ['eitan_rosen',    'Eitan Rosen',      3.5, 0.10],
  ['dana.azoulay',   'Dana Azoulay',     7.5, 0.20],
  ['sami_odeh',      'Sami Odeh',        2.0, 0.10],
  ['lior.katz',      'Lior Katz',       12.0, 0.55],
].map(([username, display_name, baseHours, completionRate], i) => ({
  username,
  email: `demo_peer_${String(i + 1).padStart(2, '0')}${MARKER_DOMAIN}`,
  display_name, baseHours, completionRate,
}));

// Current-week hours of each peer as a multiple of studifly_demo's current-week
// hours. 6 of 18 are > 1, so studifly_demo ranks 7th of 19 (~top 35%) and sits
// ~13% above the peer average. Index-aligned with PEERS (shuffled on purpose).
const CURRENT_WEEK_FACTORS = [
  1.25, 0.45, 1.45, 0.25, 0.78, 1.08, 0.35, 0.90, 0.65,
  0.50, 1.35, 0.60, 0.85, 1.15, 0.70, 0.95, 0.98, 1.60,
];

const FRIENDS_ACCEPTED = 5; // first N peers become accepted friends
const FRIENDS_PENDING  = 1; // next N peers send studifly_demo a pending request

const COURSE_POOL = [
  ['Calculus II', '#6C4DC4'], ['Data Structures', '#2E86DE'], ['Linear Algebra', '#10AC84'],
  ['Physics I', '#EE5253'], ['Statistics', '#FF9F43'], ['Organic Chemistry', '#5F27CD'],
  ['Intro to Psychology', '#FECA57'], ['Algorithms', '#0ABDE3'], ['Microeconomics', '#576574'],
  ['English Literature', '#FF6B6B'],
];
const TASK_TEMPLATES = [
  ['Read chapter %n', 'reading', 'homework'], ['Problem set %n', 'practice', 'homework'],
  ['Lecture %n recording', 'watching', 'other'], ['Midterm review', 'practice', 'exam'],
  ['Lab report %n', 'other', 'project'], ['Summarize notes week %n', 'reading', 'other'],
  ['Practice exam %n', 'practice', 'exam'], ['Group project milestone %n', 'other', 'project'],
];

// ── Helpers ──────────────────────────────────────────────────────────────────

// Deterministic PRNG so every run produces the same "personalities".
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const randInt = (rnd, min, max) => min + Math.floor(rnd() * (max - min + 1));

const DAY_MS = 86_400_000;

// YYYY-MM-DD of a Date in Israel time (same method the dashboard uses).
function israelDate(d) {
  return d.toLocaleDateString('en-CA', { timeZone: TZ });
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// Offset (ms) of Israel time vs UTC at a given instant.
function tzOffsetMs(instant) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TZ, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(instant).map(p => [p.type, p.value])
  );
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

// Israel wall-clock time → UTC Date (DST-safe).
function israelTime(dateStr, hour, minute = 0, second = 0, ms = 0) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, hour, minute, second, ms);
  let t = guess - tzOffsetMs(new Date(guess));
  t = guess - tzOffsetMs(new Date(t));
  return new Date(t);
}

// Splits `totalMin` into session lengths of 30–150 minutes.
function splitMinutes(rnd, totalMin) {
  const out = [];
  let left = Math.round(totalMin);
  while (left > 0) {
    if (left <= 150) { out.push(left); break; }
    const chunk = randInt(rnd, 45, 150);
    if (left - chunk < 30) { out.push(left); break; }
    out.push(chunk);
    left -= chunk;
  }
  return out;
}

// Places sessions totalling `totalMin` inside [winStart, winEnd), using up to
// three non-overlapping Israel-time slots per day (09:xx, 14:xx, 19:xx).
function scheduleSessions(rnd, totalMin, winStart, winEnd) {
  if (totalMin < 10 || winEnd - winStart < 15 * 60_000) return [];

  const slots = [];
  for (let day = israelDate(winStart); day <= israelDate(winEnd); day = addDays(day, 1)) {
    for (const hour of [9, 14, 19]) {
      const start = israelTime(day, hour, randInt(rnd, 0, 50), randInt(rnd, 0, 59));
      if (start >= winStart && start.getTime() + 30 * 60_000 <= winEnd.getTime()) {
        slots.push({ start, cap: Math.min(150, Math.floor((winEnd - start) / 60_000) - 5) });
      }
    }
  }
  // Window too short for regular slots (e.g. run right after the week starts):
  // one session squeezed in at the beginning.
  if (slots.length === 0) {
    slots.push({ start: new Date(winStart.getTime() + 60_000), cap: Math.floor((winEnd - winStart) / 60_000) - 5 });
  }

  // Shuffle slots, then fill each with one chunk while capacity allows.
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  const sessions = [];
  for (const minutes of splitMinutes(rnd, totalMin)) {
    const slot = slots.shift();
    if (!slot) break;
    const dur = Math.min(minutes, slot.cap);
    if (dur < 10) continue;
    sessions.push({ start: slot.start, durSec: dur * 60 });
  }
  return sessions;
}

// ── Steps ────────────────────────────────────────────────────────────────────

async function removeDemoData(c, demoUserId) {
  let seededSessions = 0;
  if (demoUserId) {
    const r = await c.query(`DELETE FROM study_sessions WHERE user_id = $1 AND ${FINGERPRINT_SQL}`, [demoUserId]);
    seededSessions = r.rowCount;
  }
  // ON DELETE CASCADE removes their courses, tasks, sessions, friendships, etc.
  const users = await c.query(`DELETE FROM users WHERE email LIKE $1`, [`%${MARKER_DOMAIN}`]);
  return { seededSessions, peers: users.rowCount };
}

async function upsertPeers(c, passwordHash) {
  // A peer username must never collide with a real account (case-insensitive,
  // so "Maya_Levi" can't sit next to "maya_levi" either).
  const { rows: clashes } = await c.query(
    `SELECT username FROM users WHERE email NOT LIKE $1 AND lower(username) = ANY($2)`,
    [`%${MARKER_DOMAIN}`, PEERS.map(p => p.username.toLowerCase())]
  );
  if (clashes.length) {
    throw new Error(`Username(s) already used by real accounts: ${clashes.map(r => r.username).join(', ')} — aborting, nothing changed.`);
  }

  // Drop marker users that are no longer in the list (e.g. PEERS was shortened).
  await c.query(
    `DELETE FROM users WHERE email LIKE $1 AND NOT (email = ANY($2))`,
    [`%${MARKER_DOMAIN}`, PEERS.map(p => p.email)]
  );

  // Keyed on the marker email, so a renamed username updates the same row
  // (same id) instead of creating a second user.
  for (const [i, p] of PEERS.entries()) {
    const { rows } = await c.query(
      `INSERT INTO users (username, email, password_hash, display_name, weekly_goal_hours,
                          email_reminders_enabled, created_at)
       VALUES ($1, $2, $3, $4, $5, false, NOW() - INTERVAL '75 days')
       ON CONFLICT (email) DO UPDATE
         SET username = EXCLUDED.username,
             display_name = EXCLUDED.display_name,
             weekly_goal_hours = EXCLUDED.weekly_goal_hours,
             email_reminders_enabled = false
       RETURNING id`,
      [p.username, p.email, passwordHash, p.display_name, 8 + (i % 8)]
    );
    p.id = rows[0].id;
  }

  // Fresh slate for their child data (users themselves keep stable ids).
  const ids = PEERS.map(p => p.id);
  await c.query('DELETE FROM friendships WHERE requester_id = ANY($1) OR addressee_id = ANY($1)', [ids]);
  await c.query('DELETE FROM study_sessions WHERE user_id = ANY($1)', [ids]);
  await c.query('DELETE FROM tasks WHERE user_id = ANY($1)', [ids]);
  await c.query('DELETE FROM courses WHERE user_id = ANY($1)', [ids]);
}

async function seedPeerTasks(c) {
  const today = israelDate(new Date());
  for (const [i, p] of PEERS.entries()) {
    const rnd = mulberry32(1000 + i);
    const courseIds = [];
    for (const k of [0, 1]) {
      const [name, color] = COURSE_POOL[(i * 3 + k * 5) % COURSE_POOL.length];
      const { rows } = await c.query(
        'INSERT INTO courses (user_id, name, color, created_at) VALUES ($1, $2, $3, NOW() - INTERVAL \'70 days\') RETURNING id',
        [p.id, name, color]
      );
      courseIds.push(rows[0].id);
    }

    const n = randInt(rnd, 5, 10);
    const completed = Math.round(n * p.completionRate);
    p.taskIds = [];
    for (let t = 0; t < n; t++) {
      const [tpl, activity, category] = TASK_TEMPLATES[(t + i) % TASK_TEMPLATES.length];
      const status = t < completed ? 'completed' : (t % 2 === 0 ? 'in_progress' : 'pending');
      const due = addDays(today, status === 'completed' ? -randInt(rnd, 1, 25) : randInt(rnd, 1, 21));
      const { rows } = await c.query(
        `INSERT INTO tasks (user_id, course_id, name, activity_type, planned_time, due_date, status,
                            category, completed_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() - INTERVAL '35 days')
         RETURNING id`,
        [p.id, courseIds[t % 2], tpl.replace('%n', String(randInt(rnd, 1, 9))), activity,
         randInt(rnd, 2, 8) * 30, due, status, category,
         status === 'completed' ? israelTime(due, 18) : null]
      );
      p.taskIds.push(rows[0].id);
    }
  }
}

async function insertSession(c, userId, taskId, start, durSec, isManual) {
  const end = new Date(start.getTime() + durSec * 1000);
  await c.query(
    `INSERT INTO study_sessions (user_id, task_id, start_time, end_time, duration, is_manual, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $4)`,
    [userId, taskId, start.toISOString(), end.toISOString(), durSec, isManual]
  );
}

async function weekSeconds(c, userId, start, end) {
  const { rows } = await c.query(
    `SELECT COALESCE(SUM(duration), 0)::int AS s FROM study_sessions
     WHERE user_id = $1 AND start_time >= $2 AND start_time < $3 AND duration IS NOT NULL`,
    [userId, start, end]
  );
  return rows[0].s;
}

async function seedDemoStreak(c, demoUserId) {
  const now = new Date();
  const today = israelDate(now);
  const rnd = mulberry32(42);

  const { rows: realDays } = await c.query(
    `SELECT DISTINCT (start_time AT TIME ZONE $2)::date::text AS d FROM study_sessions
     WHERE user_id = $1 AND duration IS NOT NULL AND start_time >= NOW() - INTERVAL '60 days'`,
    [demoUserId, TZ]
  );
  const studied = new Set(realDays.map(r => r.d));

  const { rows: tasks } = await c.query(
    `SELECT id FROM tasks WHERE user_id = $1 AND course_id IS NOT NULL ORDER BY id`,
    [demoUserId]
  );

  const added = [];
  for (let i = STREAK_DAYS - 1; i >= 0; i--) {
    const day = addDays(today, -i);
    if (studied.has(day)) continue;

    const durMin = randInt(rnd, 45, 95);
    let start = israelTime(day, [10, 13, 16, 18][randInt(rnd, 0, 3)], randInt(rnd, 0, 3) * 15, SEED_SECONDS, SEED_MS);
    let durSec = durMin * 60;

    if (i === 0) {
      // Today: the session must already be over.
      const latestEnd = now.getTime() - 10 * 60_000;
      if (start.getTime() + durSec * 1000 > latestEnd) {
        const midnight = israelTime(day, 0, 1, SEED_SECONDS, SEED_MS);
        const startMs = Math.max(midnight.getTime(), latestEnd - durSec * 1000);
        start = new Date(Math.floor(startMs / 60_000) * 60_000 + SEED_SECONDS * 1000 + SEED_MS);
        durSec = Math.floor((latestEnd - start.getTime()) / 60_000) * 60;
      }
      if (durSec < 15 * 60) {
        console.warn(`  ! Too early in the day to add a session for today (${day}); yesterday keeps the streak alive.`);
        continue;
      }
    }

    const taskId = tasks.length ? tasks[added.length % tasks.length].id : null;
    await insertSession(c, demoUserId, taskId, start, durSec, 1);
    added.push(`${day} ${Math.round(durSec / 60)}m`);
  }
  return added;
}

async function seedPeerSessions(c, demoUserId) {
  const now = new Date();
  const { start, end } = getISOWeekBounds(currentISOWeek());
  const weekStart = new Date(start);
  const weekEnd = new Date(end);

  const demoWeekSec = await weekSeconds(c, demoUserId, start, end);
  let count = 0;

  for (const [i, p] of PEERS.entries()) {
    const rnd = mulberry32(2000 + i);
    const pickTask = () => p.taskIds[randInt(rnd, 0, p.taskIds.length - 1)];

    for (let w = 0; w <= PAST_WEEKS; w++) {
      const winStart = new Date(weekStart.getTime() - w * 7 * DAY_MS);
      const winEnd = w === 0
        ? new Date(Math.min(weekEnd.getTime(), now.getTime() - 15 * 60_000))
        : new Date(weekEnd.getTime() - w * 7 * DAY_MS);

      let hours;
      if (w === 0) {
        // Relative to studifly_demo so the comparison lands where we want it
        // no matter which day of the week the script runs.
        hours = Math.min(12, (demoWeekSec / 3600) * CURRENT_WEEK_FACTORS[i]);
        hours = Math.max(hours, 0.25);
      } else {
        hours = Math.min(12, Math.max(1, p.baseHours * (0.75 + rnd() * 0.5)));
      }

      for (const s of scheduleSessions(rnd, hours * 60, winStart, winEnd)) {
        await insertSession(c, p.id, pickTask(), s.start, s.durSec, rnd() < 0.2 ? 1 : 0);
        count++;
      }
    }
  }
  return { count, demoWeekSec };
}

async function seedFriendships(c, demoUserId) {
  for (let i = 0; i < FRIENDS_ACCEPTED + FRIENDS_PENDING; i++) {
    const p = PEERS[i];
    const accepted = i < FRIENDS_ACCEPTED;
    // Accepted ones alternate who sent the request; pending ones come TO studifly_demo.
    const [requester, addressee] = accepted && i % 2 === 0 ? [demoUserId, p.id] : [p.id, demoUserId];
    await c.query(
      `INSERT INTO friendships (requester_id, addressee_id, status, created_at)
       VALUES ($1, $2, $3, NOW() - make_interval(days => $4))
       ON CONFLICT (requester_id, addressee_id) DO NOTHING`,
      [requester, addressee, accepted ? 'accepted' : 'pending', accepted ? 30 - i * 4 : 1]
    );
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set (backend/.env).');
  const host = (process.env.DATABASE_URL.match(/@([^/:?]+)/) || [])[1] || '?';
  console.log(`DB host: ${host}`);
  console.log(`Mode: ${CLEAN ? 'CLEAN' : 'SEED'}${DRY_RUN ? ' (dry run — will ROLLBACK)' : ''}`);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
  });
  const passwordHash = CLEAN ? null : bcrypt.hashSync(PEER_PASSWORD, 10);
  const c = await pool.connect();
  let demoUserId;

  try {
    await c.query('BEGIN');

    const { rows } = await c.query('SELECT id FROM users WHERE username = $1', [DEMO_USERNAME]);
    demoUserId = rows[0]?.id;

    if (CLEAN) {
      const r = await removeDemoData(c, demoUserId);
      console.log(`Removed ${r.peers} demo peers (with all their data) and ${r.seededSessions} seeded ${DEMO_USERNAME} sessions.`);
    } else {
      if (!demoUserId) throw new Error(`User "${DEMO_USERNAME}" not found — nothing seeded.`);
      console.log(`${DEMO_USERNAME} id = ${demoUserId}`);

      const old = await c.query(`DELETE FROM study_sessions WHERE user_id = $1 AND ${FINGERPRINT_SQL}`, [demoUserId]);
      if (old.rowCount) console.log(`  replaced ${old.rowCount} previously seeded ${DEMO_USERNAME} sessions`);

      const streak = await seedDemoStreak(c, demoUserId);
      console.log(`  streak sessions added: ${streak.length ? streak.join(', ') : 'none needed'}`);

      await upsertPeers(c, passwordHash);
      await seedPeerTasks(c);
      const { count, demoWeekSec } = await seedPeerSessions(c, demoUserId);
      await seedFriendships(c, demoUserId);
      console.log(`  ${PEERS.length} peers, ${count} peer sessions, ${FRIENDS_ACCEPTED} friends + ${FRIENDS_PENDING} pending request`);
      console.log(`  ${DEMO_USERNAME} this week (${currentISOWeek()}): ${Math.floor(demoWeekSec / 3600)}h ${Math.round((demoWeekSec % 3600) / 60)}m`);

      const { start, end } = getISOWeekBounds(currentISOWeek());
      const { rows: ranking } = await c.query(
        `SELECT user_id, SUM(duration)::int AS s FROM study_sessions
         WHERE start_time >= $1 AND start_time < $2 AND duration IS NOT NULL
         GROUP BY user_id ORDER BY s DESC`,
        [start, end]
      );
      const rank = ranking.findIndex(r => r.user_id === demoUserId) + 1;
      console.log(`  rank this week: #${rank} of ${ranking.length} active students (top ${Math.round(rank / ranking.length * 100)}%)`);
    }

    await c.query(DRY_RUN ? 'ROLLBACK' : 'COMMIT');
    console.log(DRY_RUN ? 'Rolled back (dry run).' : 'Committed.');
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    c.release();
    await pool.end();
  }

  // Verify with the app's own dashboard logic (reads committed data).
  if (!CLEAN && !DRY_RUN) {
    const dashboard = require('../services/dashboard.service');
    const s = await dashboard.getSummary(demoUserId, TZ);
    const h = sec => `${(sec / 3600).toFixed(1)}h`;
    console.log('\nDashboard summary for', DEMO_USERNAME);
    console.log(`  streak:          ${s.streak} days`);
    console.log(`  this week:       ${h(s.weekly_seconds)}  (completion ${s.completion_rate}%)`);
    console.log(`  peers:           enough_data=${s.peers.enough_data}, ${s.peers.peer_count} active, ` +
                `avg ${s.peers.avg_weekly_seconds != null ? h(s.peers.avg_weekly_seconds) : '—'}, ` +
                `avg completion ${s.peers.avg_completion_rate ?? '—'}%`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error('\nFAILED:', e.message); process.exit(1); });
