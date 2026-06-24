import client from './client';

export const submitCheckin   = (data) => client.post('/mood', data).then(r => r.data);
export const getCheckins     = ()     => client.get('/mood').then(r => r.data);
export const getTodayCheckin = ()     => client.get('/mood/today').then(r => r.data);
export const getCorrelation  = ()     => client.get('/mood/correlation').then(r => r.data);
