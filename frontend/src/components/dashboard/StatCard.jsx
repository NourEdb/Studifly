import Card from '../ui/Card';
import styles from './StatCard.module.css';

export default function StatCard({ label, value, sub, color, icon }) {
  return (
    <Card className={styles.card}>
      <div className={styles.icon} style={{ background: color + '1a', color }}>{icon}</div>
      <div>
        <p className={styles.value}>{value}</p>
        <p className={styles.label}>{label}</p>
        {sub && <p className={styles.sub}>{sub}</p>}
      </div>
    </Card>
  );
}
