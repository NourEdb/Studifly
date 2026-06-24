const db = require('../database/db');

function err(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// GET /api/friends — accepted friends with live "is studying" flag
async function getFriends(userId) {
  return db.all(
    `SELECT
       f.id            AS friendship_id,
       u.id,
       u.username,
       u.display_name,
       EXISTS (
         SELECT 1 FROM study_sessions
         WHERE user_id = u.id AND end_time IS NULL
       )               AS is_studying,
       f.created_at
     FROM friendships f
     JOIN users u ON u.id = CASE
       WHEN f.requester_id = ? THEN f.addressee_id
       ELSE f.requester_id
     END
     WHERE (f.requester_id = ? OR f.addressee_id = ?)
       AND f.status = 'accepted'
     ORDER BY u.username`,
    [userId, userId, userId]
  );
}

// GET /api/friends/requests — pending incoming requests
async function getRequests(userId) {
  return db.all(
    `SELECT
       f.id AS friendship_id,
       f.created_at,
       u.id,
       u.username,
       u.display_name
     FROM friendships f
     JOIN users u ON u.id = f.requester_id
     WHERE f.addressee_id = ? AND f.status = 'pending'
     ORDER BY f.created_at DESC`,
    [userId]
  );
}

// GET /api/friends/search?q= — search users by username
async function searchUsers(userId, q) {
  if (!q || q.trim().length < 2) throw err(400, 'Query must be at least 2 characters');

  return db.all(
    `SELECT
       u.id,
       u.username,
       u.display_name,
       f.id     AS friendship_id,
       f.status AS friendship_status,
       CASE
         WHEN f.requester_id = ? THEN 'sent'
         WHEN f.addressee_id = ? THEN 'received'
         ELSE NULL
       END       AS direction
     FROM users u
     LEFT JOIN friendships f
       ON (f.requester_id = ? AND f.addressee_id = u.id)
       OR (f.addressee_id = ? AND f.requester_id = u.id)
     WHERE u.id <> ?
       AND u.username ILIKE ?
     ORDER BY u.username
     LIMIT 20`,
    [userId, userId, userId, userId, userId, `%${q.trim()}%`]
  );
}

// POST /api/friends/request/:userId — send a friend request
async function sendRequest(requesterId, addresseeId) {
  if (requesterId === addresseeId) throw err(400, 'Cannot add yourself');

  const addressee = await db.get('SELECT id FROM users WHERE id = ?', [addresseeId]);
  if (!addressee) throw err(404, 'User not found');

  // Check both directions for an existing record
  const existing = await db.get(
    `SELECT id, status, requester_id FROM friendships
     WHERE (requester_id = ? AND addressee_id = ?)
        OR (requester_id = ? AND addressee_id = ?)`,
    [requesterId, addresseeId, addresseeId, requesterId]
  );

  if (existing) {
    if (existing.status === 'accepted') throw err(409, 'Already friends');
    if (existing.status === 'pending')  throw err(409, 'A friend request is already pending');
    // status = 'rejected': allow re-requesting — update back to pending
    return db.get(
      `UPDATE friendships
       SET requester_id = ?, addressee_id = ?, status = 'pending', created_at = NOW()
       WHERE id = ?
       RETURNING *`,
      [requesterId, addresseeId, existing.id]
    );
  }

  return db.get(
    `INSERT INTO friendships (requester_id, addressee_id) VALUES (?, ?) RETURNING *`,
    [requesterId, addresseeId]
  );
}

// PATCH /api/friends/:id/accept
async function acceptRequest(userId, friendshipId) {
  const f = await db.get('SELECT * FROM friendships WHERE id = ?', [friendshipId]);
  if (!f) throw err(404, 'Request not found');
  if (f.addressee_id !== userId) throw err(403, 'Not authorized');
  if (f.status !== 'pending')    throw err(400, 'Request is not pending');

  return db.get(
    `UPDATE friendships SET status = 'accepted' WHERE id = ? RETURNING *`,
    [friendshipId]
  );
}

// PATCH /api/friends/:id/reject
async function rejectRequest(userId, friendshipId) {
  const f = await db.get('SELECT * FROM friendships WHERE id = ?', [friendshipId]);
  if (!f) throw err(404, 'Request not found');
  if (f.addressee_id !== userId) throw err(403, 'Not authorized');
  if (f.status !== 'pending')    throw err(400, 'Request is not pending');

  return db.get(
    `UPDATE friendships SET status = 'rejected' WHERE id = ? RETURNING *`,
    [friendshipId]
  );
}

// DELETE /api/friends/:id — remove friend or cancel/delete any friendship record
async function removeFriend(userId, friendshipId) {
  const f = await db.get('SELECT * FROM friendships WHERE id = ?', [friendshipId]);
  if (!f) throw err(404, 'Friendship not found');
  if (f.requester_id !== userId && f.addressee_id !== userId) throw err(403, 'Not authorized');

  await db.run('DELETE FROM friendships WHERE id = ?', [friendshipId]);
}

module.exports = { getFriends, getRequests, searchUsers, sendRequest, acceptRequest, rejectRequest, removeFriend };
