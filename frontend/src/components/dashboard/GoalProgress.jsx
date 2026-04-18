import Card from '../ui/Card';
import ProgressBar from '../ui/ProgressBar';
import styles from './GoalProgress.module.css';

export default function GoalProgress({ summary }) {
  const { task_counts, completion_rate, total_tasks, overdue_count } = summary;

  return (
    <Card>
      <h3 className={styles.title}>Task Progress</h3>
      <ProgressBar value={completion_rate} max={100} label="Completion rate" color="var(--color-success)" />
      <div className={styles.counts}>
        <div className={styles.count}><span>{task_counts.completed}</span><p>Done</p></div>
        <div className={styles.count}><span>{task_counts.in_progress}</span><p>In Progress</p></div>
        <div className={styles.count}><span>{task_counts.pending}</span><p>Pending</p></div>
        {overdue_count > 0 && <div className={[styles.count, styles.overdue].join(' ')}><span>{overdue_count}</span><p>Overdue</p></div>}
      </div>
    </Card>
  );
}
