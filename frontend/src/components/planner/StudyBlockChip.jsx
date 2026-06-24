import styles from './StudyBlockChip.module.css';

function fmt(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'pm' : 'am';
  const h12  = hour % 12 || 12;
  return `${h12}:${m}${ampm}`;
}

export default function StudyBlockChip({ block, onEdit, onDelete }) {
  const color = block.course_color || 'var(--color-purple)';

  return (
    <div className={styles.chip} style={{ '--block-color': color }}>
      <div className={styles.body}>
        <span className={styles.taskName}>{block.task_name}</span>
        <span className={styles.time}>{fmt(block.start_time)} – {fmt(block.end_time)}</span>
        {block.topic && <span className={styles.topic}>{block.topic}</span>}
      </div>
      <div className={styles.right}>
        {block.completion_pct != null && (
          <span className={[styles.pct, block.completion_pct === 100 && styles.pctDone].filter(Boolean).join(' ')}>
            {block.completion_pct}%
          </span>
        )}
        <button className={styles.iconBtn} onClick={() => onEdit(block)} title="Edit block">✎</button>
        <button className={[styles.iconBtn, styles.del].join(' ')} onClick={() => onDelete(block.id)} title="Delete block">×</button>
      </div>
    </div>
  );
}
