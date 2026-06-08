import { useState, useEffect } from 'react';
import { getSummary, getWeeklyHours, getByCourse, getHeatmap, getCourseComparison } from '../api/dashboard.api';
import toast from 'react-hot-toast';

export default function useDashboard() {
  const [summary, setSummary] = useState(null);
  const [weeklyHours, setWeeklyHours] = useState([]);
  const [byCourse, setByCourse] = useState([]);
  const [heatmap, setHeatmap] = useState([]);
  const [courseComparison, setCourseComparison] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getSummary(), getWeeklyHours(6), getByCourse(), getHeatmap(), getCourseComparison()])
      .then(([s, w, c, h, cc]) => { setSummary(s); setWeeklyHours(w); setByCourse(c); setHeatmap(h); setCourseComparison(cc); })
      .catch(() => toast.error('Failed to load dashboard data'))
      .finally(() => setLoading(false));
  }, []);

  return { summary, weeklyHours, byCourse, heatmap, courseComparison, loading };
}
