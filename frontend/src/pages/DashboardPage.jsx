import { useState, useRef } from 'react';
import useDashboard from '../hooks/useDashboard';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/dashboard/StatCard';
import WeeklyBarChart from '../components/dashboard/WeeklyBarChart';
import GoalProgress from '../components/dashboard/GoalProgress';
import TaskSummaryList from '../components/dashboard/TaskSummaryList';
import HeatMap from '../components/dashboard/HeatMap';
import CourseComparisonCharts from '../components/dashboard/CourseComparisonCharts';
import { generateDashboardPdf } from '../utils/generatePdf';
import styles from './DashboardPage.module.css';

function fmtHours(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function DashboardPage() {
  const { summary, weeklyHours, byCourse, heatmap, courseComparison, loading } = useDashboard();
  const { user } = useAuth();
  const chartRef   = useRef(null);
  const heatmapRef = useRef(null);
  const [exporting, setExporting] = useState(false);

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
        {summary.overdue_count > 0 && (
          <StatCard
            icon="⚠️"
            label="Overdue tasks"
            value={summary.overdue_count}
            color="var(--color-error)"
          />
        )}
      </div>

      <div className={styles.charts}>
        <div ref={chartRef}>
          <WeeklyBarChart data={weeklyHours} />
        </div>
        <div className={styles.right}>
          <GoalProgress summary={summary} />
          <TaskSummaryList byCourse={byCourse} />
        </div>
      </div>

      <div ref={heatmapRef}>
        <HeatMap data={heatmap} />
      </div>

      <CourseComparisonCharts data={courseComparison} />
    </div>
  );
}
