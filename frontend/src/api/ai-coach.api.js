import client from './client';

export const getCoachContext = () =>
  client.get('/ai-coach/context').then(r => r.data);

export const sendChatMessage = (messages) =>
  client.post('/ai-coach/chat', { messages }).then(r => r.data);
