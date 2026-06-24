import client from './client';

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

export const getSummary    = ()           => client.get('/dashboard/summary', { params: { tz: TZ } }).then(r => r.data);
export const getWeeklyHours = (weeks = 4) => client.get('/dashboard/weekly-hours', { params: { weeks } }).then(r => r.data);
export const getByCourse   = ()           => client.get('/dashboard/by-course').then(r => r.data);
export const getHeatmap          = ()  => client.get('/dashboard/heatmap').then(r => r.data);
export const getCourseComparison = ()  => client.get('/dashboard/course-comparison').then(r => r.data);
export const getPrediction        = ()  => client.get('/dashboard/prediction').then(r => r.data);
export const getBlocksComparison  = ()  => client.get('/dashboard/blocks-comparison').then(r => r.data);
