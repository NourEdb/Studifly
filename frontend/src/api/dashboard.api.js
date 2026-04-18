import client from './client';

export const getSummary = () => client.get('/dashboard/summary').then(r => r.data);
export const getWeeklyHours = (weeks = 4) => client.get('/dashboard/weekly-hours', { params: { weeks } }).then(r => r.data);
export const getByCourse = () => client.get('/dashboard/by-course').then(r => r.data);
