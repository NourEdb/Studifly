import client from './client';

export const getTasks               = params     => client.get('/tasks', { params }).then(r => r.data);
export const getCustomActivityTypes = ()         => client.get('/tasks/custom-activity-types').then(r => r.data);
export const createTask             = data       => client.post('/tasks', data).then(r => r.data);
export const updateTask             = (id, data) => client.put(`/tasks/${id}`, data).then(r => r.data);
export const deleteTask             = id         => client.delete(`/tasks/${id}`);
