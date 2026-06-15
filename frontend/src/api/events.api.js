import client from './client';

export const getEvents  = ()       => client.get('/events').then(r => r.data);
export const createEvent = (data)  => client.post('/events', data).then(r => r.data);
export const deleteEvent = (id)    => client.delete(`/events/${id}`);
