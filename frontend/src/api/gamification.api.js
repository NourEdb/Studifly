import client from './client';

export const getProfile = () => client.get('/gamification/profile').then(r => r.data);
