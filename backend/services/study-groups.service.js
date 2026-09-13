const db = require('../database/db');
const { getISOWeekBounds, currentISOWeek } = require('../utils/dateHelpers');

function err(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

async function areFriends(userId, otherId) {
  const row = await db.get(
    `SELECT 1 FROM friendships
     WHERE status = 'accepted'
       AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))`,
    [userId, otherId, otherId, userId]
  );
  return !!row;
}

async function isMember(groupId, userId) {
  const row = await db.get(
    'SELECT 1 FROM study_group_members WHERE group_id = ? AND user_id = ?',
    [groupId, userId]
  );
  return !!row;
}

async function getGroupOrThrow(groupId) {
  const group = await db.get('SELECT * FROM study_groups WHERE id = ?', [groupId]);
  if (!group) throw err(404, 'Study group not found');
  return group;
}

// POST /api/study-groups — create a group from a subset of the creator's
// accepted friends. The creator is always added as a member too, so their
// own hours count on the leaderboard of a group they're actively part of.
async function createGroup(userId, name, memberUserIds = []) {
  const trimmedName = (name || '').trim();
  if (!trimmedName) throw err(400, 'Group name is required');

  // De-dupe and drop the creator if they included themselves — they're added
  // automatically below regardless.
  const candidateIds = [...new Set((memberUserIds || []).map(id => parseInt(id, 10)))]
    .filter(id => Number.isInteger(id) && id !== userId);

  for (const memberId of candidateIds) {
    if (!(await areFriends(userId, memberId))) {
      throw err(400, `User ${memberId} is not one of your accepted friends`);
    }
  }

  const group = await db.get(
    'INSERT INTO study_groups (name, created_by) VALUES (?, ?) RETURNING *',
    [trimmedName, userId]
  );

  const allMemberIds = [userId, ...candidateIds];
  for (const memberId of allMemberIds) {
    await db.run(
      'INSERT INTO study_group_members (group_id, user_id) VALUES (?, ?)',
      [group.id, memberId]
    );
  }

  return { ...group, member_count: allMemberIds.length };
}

// GET /api/study-groups — every group the user currently belongs to
async function listMyGroups(userId) {
  return db.all(
    `SELECT
       g.id, g.name, g.created_by, g.created_at,
       (g.created_by = ?) AS is_creator,
       (SELECT COUNT(*)::int FROM study_group_members WHERE group_id = g.id) AS member_count
     FROM study_groups g
     JOIN study_group_members m ON m.group_id = g.id AND m.user_id = ?
     ORDER BY g.created_at DESC`,
    [userId, userId]
  );
}

// POST /api/study-groups/:id/members — creator-only, target must already be
// an accepted friend of the creator (same rule as at creation time).
async function addMember(userId, groupId, newMemberId) {
  const group = await getGroupOrThrow(groupId);
  if (group.created_by !== userId) throw err(403, 'Only the group creator can add members');
  if (newMemberId === userId) throw err(400, 'Creator is already a member');
  if (!(await areFriends(userId, newMemberId))) throw err(400, 'That user is not one of your accepted friends');
  if (await isMember(groupId, newMemberId)) throw err(409, 'That user is already a member of this group');

  await db.run(
    'INSERT INTO study_group_members (group_id, user_id) VALUES (?, ?)',
    [groupId, newMemberId]
  );
  return { ok: true };
}

// DELETE /api/study-groups/:id/members/:userId — creator-only
async function removeMember(userId, groupId, targetUserId) {
  const group = await getGroupOrThrow(groupId);
  if (group.created_by !== userId) throw err(403, 'Only the group creator can remove members');

  const result = await db.run(
    'DELETE FROM study_group_members WHERE group_id = ? AND user_id = ?',
    [groupId, targetUserId]
  );
  if (result.rowCount === 0) throw err(404, 'That user is not a member of this group');
  return { ok: true };
}

// DELETE /api/study-groups/:id — creator-only, permanent. study_group_members
// rows are removed via the ON DELETE CASCADE FK on group_id (027_study_groups.sql),
// not a second query here. This is the only way to get rid of a group once its
// creator has left via /leave — otherwise it would sit there unmanageable forever.
async function deleteGroup(userId, groupId) {
  const group = await getGroupOrThrow(groupId);
  if (group.created_by !== userId) throw err(403, 'Only the group creator can delete this group');

  await db.run('DELETE FROM study_groups WHERE id = ?', [groupId]);
  return { ok: true };
}

// POST /api/study-groups/:id/leave — any member (including the creator)
// removes themselves. Once gone, they immediately stop appearing on this
// group's leaderboard — the leaderboard query only ever looks at current
// study_group_members rows, never a historical snapshot.
async function leaveGroup(userId, groupId) {
  await getGroupOrThrow(groupId);
  const result = await db.run(
    'DELETE FROM study_group_members WHERE group_id = ? AND user_id = ?',
    [groupId, userId]
  );
  if (result.rowCount === 0) throw err(404, 'You are not a member of this group');
  return { ok: true };
}

// GET /api/study-groups/:id/leaderboard — total study hours THIS WEEK per
// current member, most hours first. Same week-bounds + duration rule used
// everywhere else "this week" is computed live (dashboard.service.js,
// gamification.service.js): getISOWeekBounds(currentISOWeek()), and only
// sessions with duration IS NOT NULL (i.e. actually stopped/logged) count.
async function getLeaderboard(userId, groupId) {
  const group = await getGroupOrThrow(groupId);
  if (!(await isMember(groupId, userId))) throw err(403, 'You are not a member of this group');

  const { start, end } = getISOWeekBounds(currentISOWeek());

  const rows = await db.all(
    `SELECT
       u.id AS user_id,
       u.username,
       u.display_name,
       COALESCE(SUM(s.duration), 0)::int AS total_seconds
     FROM study_group_members m
     JOIN users u ON u.id = m.user_id
     LEFT JOIN study_sessions s
       ON s.user_id = u.id
      AND s.start_time >= ? AND s.start_time < ?
      AND s.duration IS NOT NULL
     WHERE m.group_id = ?
     GROUP BY u.id, u.username, u.display_name
     ORDER BY total_seconds DESC, u.username ASC`,
    [start, end, groupId]
  );

  const leaderboard = rows.map((row, i) => ({
    rank:          i + 1,
    user_id:       row.user_id,
    username:      row.username,
    display_name:  row.display_name,
    total_seconds: row.total_seconds,
    total_hours:   parseFloat((row.total_seconds / 3600).toFixed(1)),
  }));

  return { group: { id: group.id, name: group.name }, leaderboard };
}

module.exports = { createGroup, listMyGroups, addMember, removeMember, deleteGroup, leaveGroup, getLeaderboard };
