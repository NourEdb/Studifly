import { useState, useEffect, useCallback } from 'react';
import { getSessions, deleteSession } from '../api/sessions.api';
import toast from 'react-hot-toast';

export default function useSessions(filters = {}) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(filters);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSessions(filters);
      setSessions(data);
    } catch {
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetch(); }, [fetch]);

  async function remove(id) {
    await deleteSession(id);
    setSessions(prev => prev.filter(s => s.id !== id));
  }

  return { sessions, loading, remove, refresh: fetch };
}
