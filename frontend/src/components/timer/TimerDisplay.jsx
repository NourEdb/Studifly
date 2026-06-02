import styles from './TimerDisplay.module.css';

function fmt(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

export default function TimerDisplay({ seconds, size = 'lg' }) {
  return <div className={[styles.display, styles[size]].join(' ')}>{fmt(seconds)}</div>;
}
