import client from './client';

export const getFriends    = ()       => client.get('/friends').then(r => r.data);
export const getRequests   = ()       => client.get('/friends/requests').then(r => r.data);
export const searchUsers   = (q)      => client.get('/friends/search', { params: { q } }).then(r => r.data);
export const sendRequest   = (userId) => client.post(`/friends/request/${userId}`).then(r => r.data);
export const acceptRequest = (id)     => client.patch(`/friends/${id}/accept`).then(r => r.data);
export const rejectRequest = (id)     => client.patch(`/friends/${id}/reject`).then(r => r.data);
export const removeFriend  = (id)     => client.delete(`/friends/${id}`).then(r => r.data);
