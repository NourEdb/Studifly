import styles from './Input.module.css';

export default function Input({ label, error, id, ...props }) {
  return (
    <div className={styles.wrapper}>
      {label && <label htmlFor={id} className={styles.label}>{label}</label>}
      <input id={id} className={[styles.input, error && styles.error].filter(Boolean).join(' ')} {...props} />
      {error && <span className={styles.errorMsg}>{error}</span>}
    </div>
  );
}
