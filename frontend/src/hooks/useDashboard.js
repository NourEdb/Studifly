import { useState, useEffect } from 'react';
import { getSummary, getWeeklyHours, getByCourse } from '../api/dashboard.api';
import toast from 'react-hot-toast';

export default function useDashboard() {
  const [summary, setSummary] = useState(null);
  const [weeklyHours, setWeeklyHours] = useState([]);
  const [byCourse, setByCourse] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getSummary(), getWeeklyHours(6), getByCourse()])
      .then(([s, w, c]) => { setSummary(s); setWeeklyHours(w); setByCourse(c); })
      .catch(() => toast.error('Failed to load dashboard data'))
      .finally(() => setLoading(false));
  }, []);

  return { summary, weeklyHours, byCourse, loading };
}
