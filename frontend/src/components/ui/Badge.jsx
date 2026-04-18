import styles from './Badge.module.css';

const ACTIVITY_COLORS = {
  reading: 'blue',
  practice: 'purple',
  watching: 'pink',
  other: 'gold',
};

export default function Badge({ label, type }) {
  const color = ACTIVITY_COLORS[type] || 'gold';
  return <span className={[styles.badge, styles[color]].join(' ')}>{label}</span>;
}
