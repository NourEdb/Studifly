import styles from './XpToast.module.css';

export default function XpToast({ visible }) {
  return (
    <div className={[styles.toast, visible ? styles.enter : styles.leave].join(' ')}>
      <span className={styles.icon}>🎉</span>
      <span className={styles.label}>Task complete!</span>
      <span className={styles.xp}>+50 XP</span>
    </div>
  );
}
