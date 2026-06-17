import { useState, useEffect } from 'react';
import { getSummary, getWeeklyHours, getByCourse, getHeatmap, getCourseComparison, getPrediction } from '../api/dashboard.api';
import toast from 'react-hot-toast';

export default function useDashboard() {
  const [summary, setSummary] = useState(null);
  const [weeklyHours, setWeeklyHours] = useState([]);
  const [byCourse, setByCourse] = useState([]);
  const [heatmap, setHeatmap] = useState([]);
  const [courseComparison, setCourseComparison] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getSummary(), getWeeklyHours(6), getByCourse(), getHeatmap(), getCourseComparison(), getPrediction()])
      .then(([s, w, c, h, cc, p]) => { setSummary(s); setWeeklyHours(w); setByCourse(c); setHeatmap(h); setCourseComparison(cc); setPrediction(p); })
      .catch(() => toast.error('Failed to load dashboard data'))
      .finally(() => setLoading(false));
  }, []);

  return { summary, weeklyHours, byCourse, heatmap, courseComparison, prediction, loading };
}
