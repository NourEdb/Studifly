import styles from './ProgressBar.module.css';

export default function ProgressBar({ value, max = 100, color, label }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={styles.wrapper}>
      {label && <span className={styles.label}>{label} <strong>{pct}%</strong></span>}
      <div className={styles.track}>
        <div
          className={styles.fill}
          style={{ width: `${pct}%`, background: color || 'var(--color-purple)' }}
        />
      </div>
    </div>
  );
}
