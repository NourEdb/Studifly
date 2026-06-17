import { useState, useEffect, useCallback } from 'react';
import { getEvents, createEvent, updateEvent, deleteEvent } from '../api/events.api';

export default function useEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEvents()
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const addEvent = useCallback(async (data) => {
    const created = await createEvent(data);
    setEvents(prev => [...prev, created].sort((a, b) =>
      a.event_date.localeCompare(b.event_date) || (a.event_time || '').localeCompare(b.event_time || '')
    ));
    return created;
  }, []);

  const editEvent = useCallback(async (id, data) => {
    const updated = await updateEvent(id, data);
    setEvents(prev =>
      prev.map(e => e.id === id ? updated : e)
        .sort((a, b) => a.event_date.localeCompare(b.event_date) || (a.event_time || '').localeCompare(b.event_time || ''))
    );
    return updated;
  }, []);

  const removeEvent = useCallback(async (id) => {
    await deleteEvent(id);
    setEvents(prev => prev.filter(e => e.id !== id));
  }, []);

  return { events, loading, addEvent, editEvent, removeEvent };
}
