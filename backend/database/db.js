const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

const MIGRATIONS = [
  path.join(__dirname, 'migrations/001_initial_schema.sql'),
  path.join(__dirname, 'migrations/002_gamification.sql'),
  path.join(__dirname, 'migrations/003_events.sql'),
];

async function initDb() {
  for (const file of MIGRATIONS) {
    const sql = fs.readFileSync(file, 'utf8');
    await pool.query(sql);
  }
  console.log('Database ready');
}

// Converts ? placeholders to $1, $2, ... for PostgreSQL
function pg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function all(sql, params = []) {
  const { rows } = await pool.query(pg(sql), params);
  return rows;
}

async function get(sql, params = []) {
  const rows = await all(sql, params);
  return rows[0] || null;
}

async function run(sql, params = []) {
  const result = await pool.query(pg(sql), params);
  return { rowCount: result.rowCount, rows: result.rows };
}

module.exports = { initDb, all, get, run };
