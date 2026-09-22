const db       = require('../database/db');
const { getIO } = require('../socket');

/**
 * io.to(room).emit(...) is fire-and-forget — if nobody is actually connected
 * in that room, it silently no-ops with no error and no log, indistinguishable
 * from a successful delivery. This wrapper logs that case explicitly so a
 * "recipient didn't get it" report shows up in server logs instead of nothing
 * (this is exactly what happened in production when the frontend's socket
 * wasn't reaching this server at all — every emit looked identical to success).
 */
function emitToRoom(io, room, event, payload) {
  const size = io.sockets.adapter.rooms.get(room)?.size || 0;
  if (size === 0) {
    console.warn(`[presence] emit "${event}" to ${room} — no connected sockets, message not delivered to anyone`);
  }
  io.to(room).emit(event, payload);
}

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
    emitToRoom(io, `user:${friend_id}`, event, payload);
  }
}

/**
 * Like emitToBuddies, but suppressed while the user has "Appear offline" enabled.
 * Use this for routine study-session start/stop broadcasts. For an explicit
 * one-off correction (e.g. right when the Settings toggle itself is flipped),
 * call emitToBuddies directly so the message isn't swallowed by this same check.
 *
 * `taskId` (only meaningful on 'buddy_started_studying') is looked up against
 * the user's CURRENT share_studying_activity value at emit time — so flipping
 * that setting off takes effect on the very next session start, with no need
 * to correct anything already sent over the socket.
 */
async function emitPresenceEvent(userId, username, event, { taskId } = {}) {
  const user = await db.get('SELECT appear_offline, share_studying_activity FROM users WHERE id = ?', [userId]);
  if (user?.appear_offline) return;

  const payload = { userId, username };
  if (event === 'buddy_started_studying' && user?.share_studying_activity && taskId) {
    const task = await db.get('SELECT name FROM tasks WHERE id = ?', [taskId]);
    if (task) payload.label = task.name;
  }

  return emitToBuddies(userId, event, payload);
}

/** Emit an event to a single user's room. */
function emitToUser(userId, event, payload) {
  const io = getIO();
  if (!io) return;
  emitToRoom(io, `user:${userId}`, event, payload);
}

module.exports = { emitToBuddies, emitPresenceEvent, emitToUser };
