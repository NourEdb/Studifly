const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/studifly.db');
const MIGRATION_PATH = path.join(__dirname, 'migrations/001_initial_schema.sql');

let db;

function getDb() {
  if (!db) {
    const dir = path.dirname(path.resolve(DB_PATH));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    db = new DatabaseSync(path.resolve(DB_PATH));
    const migration = fs.readFileSync(MIGRATION_PATH, 'utf8');
    db.exec(migration);
  }
  return db;
}

module.exports = { getDb };
