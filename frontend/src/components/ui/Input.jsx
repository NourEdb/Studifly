import styles from './Input.module.css';

const DATE_TYPES = ['date', 'time', 'datetime-local', 'month', 'week'];

export default function Input({ label, error, id, ...props }) {
  const isDateType = DATE_TYPES.includes(props.type);
  return (
    <div className={styles.wrapper}>
      {label && <label htmlFor={id} className={styles.label}>{label}</label>}
      <input
        id={id}
        className={[styles.input, error && styles.error].filter(Boolean).join(' ')}
        {...props}
        {...(isDateType && { lang: 'en' })}
      />
      {error && <span className={styles.errorMsg}>{error}</span>}
    </div>
  );
}
