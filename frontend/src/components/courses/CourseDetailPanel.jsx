import { useState } from 'react';
import useCourseDetail from '../../hooks/useCourseDetail';
import { getCourseInsight } from '../../api/ai-coach.api';
import PlanVsActualChart from '../dashboard/PlanVsActualChart';
import TaskStatusBadge from '../tasks/TaskStatusBadge';
import styles from './CourseDetailPanel.module.css';

function fmtDate(dateStr) {
  if (!dateStr) return null;
  const [, mo, d] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(mo, 10) - 1]} ${parseInt(d, 10)}`;
}

function StatItem({ value, label }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

export default function CourseDetailPanel({ courseId, courseName }) {
  const { data, loading, error } = useCourseDetail(courseId);
  const [insight, setInsight]   = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError]   = useState(null);

  async function handleInsight() {
    if (!data) return;
    setAiLoading(true);
    setAiError(null);
    setInsight(null);
    try {
      const result = await getCourseInsight({
        course_name: courseName,
        stats: data.stats,
        task_names: data.tasks.map(t => t.name),
      });
      setInsight(result.insight);
    } catch {
      setAiError('Failed to get AI insight. Try again.');
    } finally {
      setAiLoading(false);
    }
  }

  if (loading) return <div className={styles.loading}>Loading…</div>;
  if (error)   return <div className={styles.error}>{error}</div>;
  if (!data)   return null;

  const { stats, tasks, blocks_comparison } = data;

  return (
    <div className={styles.panel}>
      {/* Stats bar */}
      <div className={styles.statsBar}>
        <StatItem value={stats.total_tasks}     label="Tasks" />
        <StatItem value={stats.completed_tasks} label="Completed" />
        <StatItem value={`${stats.completion_pct}%`} label="Done" />
        <StatItem value={`${stats.planned_hours}h`}  label="Planned" />
        <StatItem value={`${stats.actual_hours}h`}   label="Actual" />
      </div>

      {/* Plan vs Actual chart — only when this week has blocks */}
      {blocks_comparison.length > 0 && (
        <div className={styles.chartWrap}>
          <PlanVsActualChart data={blocks_comparison} />
        </div>
      )}

      {/* Task list */}
      {tasks.length > 0 && (
        <div className={styles.section}>
          <p className={styles.sectionTitle}>Tasks</p>
          <div className={styles.tasks}>
            {tasks.map(t => (
              <div key={t.id} className={styles.taskRow}>
                <TaskStatusBadge status={t.status} />
                <span className={[styles.taskName, t.status === 'completed' && styles.done].filter(Boolean).join(' ')}>
                  {t.name}
                </span>
                {t.due_date && (
                  <span className={[styles.taskDue, t.overdue && styles.overdue].filter(Boolean).join(' ')}>
                    {t.overdue ? '⚠ ' : ''}{fmtDate(t.due_date)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Insight */}
      <div className={styles.section}>
        <button
          className={styles.insightBtn}
          onClick={handleInsight}
          disabled={aiLoading}
        >
          {aiLoading ? '✨ Thinking…' : insight ? '✨ Refresh AI Insight' : '✨ Get AI Insight'}
        </button>
        {aiError && <p className={styles.aiError}>{aiError}</p>}
        {insight && <p className={styles.insight}>{insight}</p>}
      </div>
    </div>
  );
}
