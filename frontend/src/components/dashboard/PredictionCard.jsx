import { useState } from 'react';
import Card from '../ui/Card';
import styles from './PredictionCard.module.css';

const MAX_VISIBLE = 5;

function fmtSeconds(s) {
  if (!s) return '0m';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function fmtDate(dateStr) {
  return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', timeZone: 'UTC',
  });
}

export default function PredictionCard({ prediction }) {
  const [showAll, setShowAll] = useState(false);

  if (!prediction) return null;

  const { tasks, summary } = prediction;
  const { on_track_count, at_risk_count, total_count } = summary;

  if (total_count === 0) {
    return (
      <Card className={styles.card}>
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>📅</span>
          <p className={styles.emptyText}>No upcoming deadlines — nothing to predict yet!</p>
        </div>
      </Card>
    );
  }

  const atRiskTasks = tasks.filter(t => t.status !== 'on_track');
  const visible = showAll ? atRiskTasks : atRiskTasks.slice(0, MAX_VISIBLE);
  const hiddenCount = atRiskTasks.length - MAX_VISIBLE;

  const allGood = at_risk_count === 0;

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <div className={styles.headline}>
          <span className={allGood ? styles.dotGreen : styles.dotAmber} />
          <h3 className={styles.title}>
            {on_track_count} of {total_count} tasks on track
          </h3>
        </div>
        <span className={styles.sub}>Based on your avg study pace</span>
      </div>

      {allGood ? (
        <div className={styles.allGood}>
          🎉 All caught up! Every task with a deadline is on track.
        </div>
      ) : (
        <div className={styles.riskSection}>
          <p className={styles.riskLabel}>Needs attention ({at_risk_count})</p>
          <ul className={styles.taskList}>
            {visible.map(t => (
              <li key={t.id} className={styles.taskRow}>
                <span className={styles.taskName} title={t.name}>{t.name}</span>
                <span className={styles.taskMeta}>
                  <span className={styles.dueDate}>{fmtDate(t.due_date)}</span>
                  {t.days_remaining < 0 ? (
                    <span className={styles.tagOverdue}>{Math.abs(t.days_remaining)}d overdue</span>
                  ) : t.days_remaining === 0 ? (
                    <span className={styles.tagToday}>Due today</span>
                  ) : (
                    <span className={styles.tagAtRisk}>{t.days_remaining}d left</span>
                  )}
                  <span className={styles.timeLeft}>{fmtSeconds(t.remaining_seconds)} left</span>
                </span>
              </li>
            ))}
          </ul>
          {hiddenCount > 0 && !showAll && (
            <button className={styles.showMore} onClick={() => setShowAll(true)}>
              Show {hiddenCount} more
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
