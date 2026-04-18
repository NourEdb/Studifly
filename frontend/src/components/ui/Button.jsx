import styles from './Button.module.css';

export default function Button({ children, variant = 'primary', size = 'md', disabled, onClick, type = 'button', fullWidth, ...props }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={[styles.btn, styles[variant], styles[size], fullWidth && styles.fullWidth].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </button>
  );
}
