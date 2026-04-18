import Card from '../ui/Card';
import ColorDot from '../ui/ColorDot';
import styles from './TaskSummaryList.module.css';

function fmtH(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function TaskSummaryList({ byCourse }) {
  if (!byCourse?.length) return null;
  return (
    <Card>
      <h3 className={styles.title}>This week by course</h3>
      <div className={styles.list}>
        {byCourse.map(c => (
          <div key={c.course_name} className={styles.row}>
            <div className={styles.name}>
              <ColorDot color={c.color} size={10} />
              <span>{c.course_name}</span>
            </div>
            <span className={styles.hours}>{fmtH(c.total_seconds)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
