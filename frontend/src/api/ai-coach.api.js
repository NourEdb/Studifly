import client from './client';

export const getCoachContext = () =>
  client.get('/ai-coach/context').then(r => r.data);

export const getChatHistory = () =>
  client.get('/ai-coach/history').then(r => r.data);

export const sendChatMessage = (message) =>
  client.post('/ai-coach/chat', { message }).then(r => r.data);

export const clearChatHistory = () =>
  client.delete('/ai-coach/history').then(r => r.data);
