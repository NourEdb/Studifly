const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');

async function register({ username, email, password }) {
  const existing = await db.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
  if (existing) {
    const err = new Error('Username or email already taken');
    err.status = 409;
    throw err;
  }
  const password_hash = bcrypt.hashSync(password, 10);
  return db.get(
    'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?) RETURNING id, username, email',
    [username, email, password_hash]
  );
}

async function login({ username, password }) {
  const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
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

async function getMe(userId) {
  return db.get('SELECT id, username, email, created_at FROM users WHERE id = ?', [userId]);
}

async function updateMe(userId, { username, email }) {
  await db.run(
    'UPDATE users SET username = COALESCE(?, username), email = COALESCE(?, email) WHERE id = ?',
    [username || null, email || null, userId]
  );
  return getMe(userId);
}

module.exports = { register, login, getMe, updateMe };
