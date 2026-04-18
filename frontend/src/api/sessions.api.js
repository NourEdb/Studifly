import client from './client';

export const startSession = data => client.post('/sessions/start', data).then(r => r.data);
export const stopSession = id => client.patch(`/sessions/${id}/stop`).then(r => r.data);
export const manualSession = data => client.post('/sessions/manual', data).then(r => r.data);
export const getSessions = params => client.get('/sessions', { params }).then(r => r.data);
export const deleteSession = id => client.delete(`/sessions/${id}`);
