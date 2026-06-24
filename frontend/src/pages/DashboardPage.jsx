import { useState, useRef, useEffect } from 'react';
import useDashboard from '../hooks/useDashboard';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/dashboard/StatCard';
import WeeklyBarChart from '../components/dashboard/WeeklyBarChart';
import GoalProgress from '../components/dashboard/GoalProgress';
import TaskSummaryList from '../components/dashboard/TaskSummaryList';
import HeatMap from '../components/dashboard/HeatMap';
import CourseComparisonCharts from '../components/dashboard/CourseComparisonCharts';
import PlanVsActualChart from '../components/dashboard/PlanVsActualChart';
import PredictionCard from '../components/dashboard/PredictionCard';
import MoodCorrelationChart from '../components/dashboard/MoodCorrelationChart';
import { getCorrelation } from '../api/mood.api';
import { generateDashboardPdf } from '../utils/generatePdf';
import styles from './DashboardPage.module.css';

function PeerBanner({ peers, weeklySeconds, completionRate }) {
  if (!peers.enough_data) {
    return (
      <p className={styles.peerNote}>
        📊 Not enough data from other students yet to compare — check back later.
      </p>
    );
  }

  const { avg_weekly_seconds, avg_completion_rate, peer_count } = peers;

  let hoursMark, hoursClass;
  if (!avg_weekly_seconds) {
    hoursMark = 'right around average';
    hoursClass = styles.peerNeutral;
  } else {
    const pct = Math.round(Math.abs(weeklySeconds - avg_weekly_seconds) / avg_weekly_seconds * 100);
    if (pct <= 5) { hoursMark = 'right around average'; hoursClass = styles.peerNeutral; }
    else if (weeklySeconds > avg_weekly_seconds) { hoursMark = `${pct}% more`; hoursClass = styles.peerUp; }
    else { hoursMark = `${pct}% less`; hoursClass = styles.peerDown; }
  }

  let rateMark, rateClass;
  const diff = completionRate - avg_completion_rate;
  if (Math.abs(diff) <= 5) { rateMark = `on par (avg ${avg_completion_rate}%)`; rateClass = styles.peerNeutral; }
  else if (diff > 0) { rateMark = `${Math.abs(diff)}% above avg (${avg_completion_rate}%)`; rateClass = styles.peerUp; }
  else { rateMark = `${Math.abs(diff)}% below avg (${avg_completion_rate}%)`; rateClass = styles.peerDown; }

  return (
    <div className={styles.peerBanner}>
      <span className={styles.peerStat}>
        📊 This week you&apos;re studying{' '}
        <span className={hoursClass}>{hoursMark}</span>
        {' '}than {peer_count} active peers
      </span>
      <span className={styles.peerDivider} />
      <span className={styles.peerStat}>
        🎯 Task completion: <span className={rateClass}>{rateMark}</span>
      </span>
    </div>
  );
}

function fmtHours(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function DashboardPage() {
  const { summary, weeklyHours, byCourse, heatmap, courseComparison, prediction, blocksComparison, loading } = useDashboard();
  const { user } = useAuth();
  const chartRef   = useRef(null);
  const heatmapRef = useRef(null);
  const [exporting,    setExporting]    = useState(false);
  const [moodData,     setMoodData]     = useState([]);

  useEffect(() => {
    getCorrelation().then(setMoodData).catch(() => {});
  }, []);

  async function handleExport() {
    if (exporting || !summary) return;
    setExporting(true);
    try {
      await generateDashboardPdf({
        user,
        summary,
        chartEl:   chartRef.current,
        heatmapEl: heatmapRef.current,
      });
    } finally {
      setExporting(false);
    }
  }

  if (loading || !summary) return <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Dashboard</h2>
        <button className={styles.exportBtn} onClick={handleExport} disabled={exporting}>
          {exporting ? 'Generating…' : '📄 Export PDF'}
        </button>
      </div>

      <div className={styles.stats}>
        <StatCard
          icon="⏱️"
          label="This week"
          value={fmtHours(summary.weekly_seconds)}
          sub={summary.week}
          color="var(--color-purple)"
        />
        <StatCard
          icon="✅"
          label="Completed tasks"
          value={summary.task_counts.completed}
          sub={`of ${summary.total_tasks} total`}
          color="var(--color-success)"
        />
        <StatCard
          icon="🎯"
          label="Completion rate"
          value={`${summary.completion_rate}%`}
          color="var(--color-blue)"
        />
        <StatCard
          icon="🔥"
          label="Current streak"
          value={`${summary.streak} day${summary.streak !== 1 ? 's' : ''}`}
          sub={summary.streak === 0 ? 'Study today to start one!' : summary.streak >= 7 ? 'On fire! 🎉' : 'Keep it up!'}
          color="var(--color-warning)"
        />
        {summary.overdue_count > 0 && (
          <StatCard
            icon="⚠️"
            label="Overdue tasks"
            value={summary.overdue_count}
            color="var(--color-error)"
          />
        )}
      </div>

      {summary.peers && <PeerBanner peers={summary.peers} weeklySeconds={summary.weekly_seconds} completionRate={summary.completion_rate} />}

      <PredictionCard prediction={prediction} />

      <div className={styles.charts}>
        <div ref={chartRef}>
          <WeeklyBarChart data={weeklyHours} />
        </div>
        <div className={styles.right}>
          <GoalProgress summary={summary} />
          <TaskSummaryList byCourse={byCourse} />
        </div>
      </div>

      <PlanVsActualChart data={blocksComparison} />

      <div ref={heatmapRef}>
        <HeatMap data={heatmap} />
      </div>

      <MoodCorrelationChart data={moodData} />

      <CourseComparisonCharts data={courseComparison} />
    </div>
  );
}
