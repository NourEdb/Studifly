import { useState, useEffect } from 'react';
import { getSummary, getWeeklyHours, getByCourse, getHeatmap } from '../api/dashboard.api';
import toast from 'react-hot-toast';

export default function useDashboard() {
  const [summary, setSummary] = useState(null);
  const [weeklyHours, setWeeklyHours] = useState([]);
  const [byCourse, setByCourse] = useState([]);
  const [heatmap, setHeatmap] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getSummary(), getWeeklyHours(6), getByCourse(), getHeatmap()])
      .then(([s, w, c, h]) => { setSummary(s); setWeeklyHours(w); setByCourse(c); setHeatmap(h); })
      .catch(() => toast.error('Failed to load dashboard data'))
      .finally(() => setLoading(false));
  }, []);

  return { summary, weeklyHours, byCourse, heatmap, loading };
}
