import styles from './TopBar.module.css';

export default function TopBar({ title }) {
  return (
    <header className={styles.topbar}>
      <h1 className={styles.title}>{title}</h1>
    </header>
  );
}
