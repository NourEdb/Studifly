const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../database/db');

function register({ username, email, password }) {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
  if (existing) {
    const err = new Error('Username or email already taken');
    err.status = 409;
    throw err;
  }
  const password_hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)'
  ).run(username, email, password_hash);
  return { id: Number(result.lastInsertRowid), username, email };
}

function login({ username, password }) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    const err = new Error('Invalid credentials');
    err.status = 401;
    throw err;
  }
  const token = jwt.sign(
    { id: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  return { token, user: { id: user.id, username: user.username, email: user.email } };
}

function getMe(userId) {
  const db = getDb();
  return db.prepare('SELECT id, username, email, created_at FROM users WHERE id = ?').get(userId);
}

function updateMe(userId, { username, email }) {
  const db = getDb();
  db.prepare('UPDATE users SET username = COALESCE(?, username), email = COALESCE(?, email) WHERE id = ?')
    .run(username || null, email || null, userId);
  return getMe(userId);
}

module.exports = { register, login, getMe, updateMe };
