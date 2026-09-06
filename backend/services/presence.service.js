const db       = require('../database/db');
const { getIO } = require('../socket');

/**
 * Emit an event to every accepted friend of userId.
 * Fire-and-forget safe — caller should .catch() the returned promise.
 */
async function emitToBuddies(userId, event, payload) {
  const io = getIO();
  if (!io) return;

  const rows = await db.all(
    `SELECT CASE
       WHEN requester_id = ? THEN addressee_id
       ELSE requester_id
     END AS friend_id
     FROM friendships
     WHERE (requester_id = ? OR addressee_id = ?)
       AND status = 'accepted'`,
    [userId, userId, userId]
  );

  for (const { friend_id } of rows) {
    io.to(`user:${friend_id}`).emit(event, payload);
  }
}

/**
 * Like emitToBuddies, but suppressed while the user has "Appear offline" enabled.
 * Use this for routine study-session start/stop broadcasts. For an explicit
 * one-off correction (e.g. right when the Settings toggle itself is flipped),
 * call emitToBuddies directly so the message isn't swallowed by this same check.
 */
async function emitPresenceEvent(userId, username, event) {
  const user = await db.get('SELECT appear_offline FROM users WHERE id = ?', [userId]);
  if (user?.appear_offline) return;
  return emitToBuddies(userId, event, { userId, username });
}

/** Emit an event to a single user's room. */
function emitToUser(userId, event, payload) {
  const io = getIO();
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}

module.exports = { emitToBuddies, emitPresenceEvent, emitToUser };
