import styles from './TimerDisplay.module.css';

function fmt(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v, i) => i === 0 && v === 0 ? null : String(v).padStart(2, '0')).filter(Boolean).join(':') || '0:00';
}

export default function TimerDisplay({ seconds, size = 'lg' }) {
  return <div className={[styles.display, styles[size]].join(' ')}>{fmt(seconds)}</div>;
}
