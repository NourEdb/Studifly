import client from './client';

export const getMyGroups     = ()                     => client.get('/study-groups').then(r => r.data);
export const createGroup     = (name, memberIds)       => client.post('/study-groups', { name, member_ids: memberIds }).then(r => r.data);
export const getLeaderboard  = (groupId)               => client.get(`/study-groups/${groupId}/leaderboard`).then(r => r.data);
export const addMember       = (groupId, userId)       => client.post(`/study-groups/${groupId}/members`, { user_id: userId }).then(r => r.data);
export const removeMember    = (groupId, userId)       => client.delete(`/study-groups/${groupId}/members/${userId}`).then(r => r.data);
export const deleteGroup     = (groupId)               => client.delete(`/study-groups/${groupId}`).then(r => r.data);
export const leaveGroup      = (groupId)               => client.post(`/study-groups/${groupId}/leave`).then(r => r.data);
