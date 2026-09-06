import Button from '../ui/Button';
import styles from './StudyBlockList.module.css';

function fmt(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'pm' : 'am';
  const h12 = hour % 12 || 12;
  return `${h12}:${m}${ampm}`;
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const [y, mo, d] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(mo, 10) - 1]} ${parseInt(d, 10)}`;
}

function fmtMinutes(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtSeconds(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function StudyBlockList({ blocks, onEdit, onDelete, onStartTimer, onToggleComplete }) {
  if (!blocks || blocks.length === 0) return null;

  return (
    <div className={styles.container}>
      {blocks.map(b => {
        const isDone = b.status === 'completed';
        const plannedLabel = b.planned_time > 0 ? fmtMinutes(b.planned_time) : null;
        const actualSeconds = b.actual_seconds ?? 0;

        return (
          <div key={b.id} className={[styles.block, isDone && styles.done].filter(Boolean).join(' ')}>
            <button
              type="button"
              className={styles.check}
              onClick={() => onToggleComplete?.(b)}
              aria-label={isDone ? 'Mark subtask incomplete' : 'Mark subtask complete'}
              title={isDone ? 'Mark as not completed' : 'Mark as completed'}
            >
              <span className={[styles.checkIcon, isDone && styles.checked].filter(Boolean).join(' ')}>
                {isDone ? '✓' : ''}
              </span>
            </button>

            <div className={styles.left}>
              {b.plan_date ? (
                <>
                  <span className={styles.date}>{fmtDate(b.plan_date)}</span>
                  {b.start_time && b.end_time
                    ? <span className={styles.time}>{fmt(b.start_time)} – {fmt(b.end_time)}</span>
                    : <span className={styles.time}>No time set</span>}
                </>
              ) : (
                <span className={styles.time}>Not scheduled</span>
              )}
              {b.topic && <span className={styles.topic}>{b.topic}</span>}
              {plannedLabel && <span className={styles.plannedActual}>Planned: {plannedLabel}</span>}
              <span className={styles.plannedActual}>Actual: {fmtSeconds(actualSeconds)}</span>
            </div>

            <div className={styles.right}>
              {b.completion_pct != null && (
                <span className={[styles.pct, b.completion_pct === 100 && styles.pctDone].filter(Boolean).join(' ')}>
                  {b.completion_pct}%
                </span>
              )}
              {onStartTimer && !isDone && (
                <Button variant="ghost" size="sm" onClick={() => onStartTimer(b)}>▶ Start</Button>
              )}
              <button className={styles.iconBtn} onClick={() => onEdit(b)} title="Edit block">✎</button>
              <button className={styles.iconBtn + ' ' + styles.del} onClick={() => onDelete(b.id)} title="Delete block">✕</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
