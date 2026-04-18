import client from './client';

export const getCourses = () => client.get('/courses').then(r => r.data);
export const createCourse = data => client.post('/courses', data).then(r => r.data);
export const updateCourse = (id, data) => client.put(`/courses/${id}`, data).then(r => r.data);
export const deleteCourse = id => client.delete(`/courses/${id}`);
