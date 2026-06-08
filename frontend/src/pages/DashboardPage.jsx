import useDashboard from '../hooks/useDashboard';
import StatCard from '../components/dashboard/StatCard';
import WeeklyBarChart from '../components/dashboard/WeeklyBarChart';
import GoalProgress from '../components/dashboard/GoalProgress';
import TaskSummaryList from '../components/dashboard/TaskSummaryList';
import HeatMap from '../components/dashboard/HeatMap';
import styles from './DashboardPage.module.css';

function fmtHours(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function DashboardPage() {
  const { summary, weeklyHours, byCourse, heatmap, loading } = useDashboard();

  if (loading || !summary) return <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>;

  return (
    <div className={styles.page}>
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
        <WeeklyBarChart data={weeklyHours} />
        <div className={styles.right}>
          <GoalProgress summary={summary} />
          <TaskSummaryList byCourse={byCourse} />
        </div>
      </div>

      <HeatMap data={heatmap} />
    </div>
  );
}
