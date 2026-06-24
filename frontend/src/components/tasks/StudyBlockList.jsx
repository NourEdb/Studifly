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

export default function StudyBlockList({ blocks, onEdit, onDelete }) {
  if (!blocks || blocks.length === 0) return null;

  return (
    <div className={styles.container}>
      {blocks.map(b => (
        <div key={b.id} className={styles.block}>
          <div className={styles.left}>
            <span className={styles.date}>{fmtDate(b.plan_date)}</span>
            <span className={styles.time}>{fmt(b.start_time)} – {fmt(b.end_time)}</span>
            {b.topic && <span className={styles.topic}>{b.topic}</span>}
          </div>
          <div className={styles.right}>
            {b.completion_pct != null && (
              <span className={[styles.pct, b.completion_pct === 100 && styles.pctDone].filter(Boolean).join(' ')}>
                {b.completion_pct}%
              </span>
            )}
            <button className={styles.iconBtn} onClick={() => onEdit(b)} title="Edit block">✎</button>
            <button className={styles.iconBtn + ' ' + styles.del} onClick={() => onDelete(b.id)} title="Delete block">✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}
