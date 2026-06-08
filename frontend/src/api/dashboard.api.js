import client from './client';

export const getSummary    = ()           => client.get('/dashboard/summary').then(r => r.data);
export const getWeeklyHours = (weeks = 4) => client.get('/dashboard/weekly-hours', { params: { weeks } }).then(r => r.data);
export const getByCourse   = ()           => client.get('/dashboard/by-course').then(r => r.data);
export const getHeatmap          = ()  => client.get('/dashboard/heatmap').then(r => r.data);
export const getCourseComparison = ()  => client.get('/dashboard/course-comparison').then(r => r.data);
