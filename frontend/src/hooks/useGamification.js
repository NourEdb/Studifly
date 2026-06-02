import { useState, useEffect, useCallback } from 'react';
import { getProfile } from '../api/gamification.api';
import toast from 'react-hot-toast';

export default function useGamification() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    getProfile()
      .then(setProfile)
      .catch(() => toast.error('Failed to load achievements'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { profile, loading, refresh };
}
