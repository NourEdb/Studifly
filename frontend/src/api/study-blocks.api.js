import client from './client';

export const getStudyBlocks    = (params)   => client.get('/study-blocks', { params }).then(r => r.data);
export const createStudyBlock  = (data)     => client.post('/study-blocks', data).then(r => r.data);
export const updateStudyBlock  = (id, data) => client.put(`/study-blocks/${id}`, data).then(r => r.data);
export const deleteStudyBlock  = (id)       => client.delete(`/study-blocks/${id}`);
export const logActualProgress = (id, data) => client.patch(`/study-blocks/${id}/actual`, data).then(r => r.data);
