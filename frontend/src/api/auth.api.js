import client from './client';

export const register = data => client.post('/auth/register', data).then(r => r.data);
export const login = data => client.post('/auth/login', data).then(r => r.data);
export const getMe = () => client.get('/auth/me').then(r => r.data);
export const updateMe = data => client.put('/auth/me', data).then(r => r.data);
