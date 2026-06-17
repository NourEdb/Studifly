const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { sendPasswordResetEmail } = require('./email.service');

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

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
  return db.get(
    'SELECT id, username, email, display_name, weekly_goal_hours, email_reminders_enabled, pinned_badge, created_at FROM users WHERE id = ?',
    [userId]
  );
}

async function updateMe(userId, body) {
  const fields = [];
  const params = [];

  if ('username' in body && body.username)        { fields.push('username = ?');                params.push(body.username); }
  if ('email' in body && body.email)              { fields.push('email = ?');                   params.push(body.email); }
  if ('display_name' in body)                     { fields.push('display_name = ?');            params.push(body.display_name || null); }
  if ('weekly_goal_hours' in body)                { fields.push('weekly_goal_hours = ?');       params.push(parseInt(body.weekly_goal_hours, 10) || 10); }
  if ('email_reminders_enabled' in body)          { fields.push('email_reminders_enabled = ?'); params.push(!!body.email_reminders_enabled); }

  if ('pinned_badge' in body) {
    if (body.pinned_badge) {
      const earned = await db.get(
        'SELECT 1 FROM user_badges WHERE user_id = ? AND badge_key = ?',
        [userId, body.pinned_badge]
      );
      if (!earned) {
        const err = new Error('Badge not earned');
        err.status = 400;
        throw err;
      }
      fields.push('pinned_badge = ?');
      params.push(body.pinned_badge);
    } else {
      fields.push('pinned_badge = ?');
      params.push(null);
    }
  }

  if (fields.length) {
    params.push(userId);
    await db.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
  }
  return getMe(userId);
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await db.get('SELECT password_hash FROM users WHERE id = ?', [userId]);
  if (!user) { const e = new Error('User not found'); e.status = 404; throw e; }
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    const err = new Error('Current password is incorrect');
    err.status = 400;
    throw err;
  }
  if (!newPassword || newPassword.length < 8) {
    const err = new Error('New password must be at least 8 characters');
    err.status = 400;
    throw err;
  }
  await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [bcrypt.hashSync(newPassword, 10), userId]);
  return { ok: true };
}

async function deleteAccount(userId, { password }) {
  const user = await db.get('SELECT password_hash FROM users WHERE id = ?', [userId]);
  if (!user) { const e = new Error('User not found'); e.status = 404; throw e; }
  if (!bcrypt.compareSync(password, user.password_hash)) {
    const err = new Error('Password is incorrect');
    err.status = 400;
    throw err;
  }
  await db.run('DELETE FROM users WHERE id = ?', [userId]);
  return { ok: true };
}

async function requestPasswordReset(email) {
  const user = await db.get('SELECT id, email FROM users WHERE email = ?', [email]);

  if (!user) {
    // Timing-safe: delay to match the time taken when a user is found
    await new Promise(r => setTimeout(r, 400 + Math.random() * 200));
    return { ok: true };
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = sha256(rawToken);
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.run(
    'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
    [hashedToken, expires.toISOString(), user.id]
  );

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}`;
  await sendPasswordResetEmail(user.email, resetUrl);

  return { ok: true };
}

async function resetPassword(token, newPassword) {
  if (!newPassword || newPassword.length < 8) {
    const err = new Error('Password must be at least 8 characters');
    err.status = 400;
    throw err;
  }

  const hashedToken = sha256(token);
  const user = await db.get(
    "SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > NOW()",
    [hashedToken]
  );

  if (!user) {
    const err = new Error('Reset link is invalid or has expired');
    err.status = 400;
    throw err;
  }

  await db.run(
    'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
    [bcrypt.hashSync(newPassword, 10), user.id]
  );

  return { ok: true };
}

module.exports = { register, login, getMe, updateMe, changePassword, deleteAccount, requestPasswordReset, resetPassword };
