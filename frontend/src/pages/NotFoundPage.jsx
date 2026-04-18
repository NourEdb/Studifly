import { Link } from 'react-router-dom';
import styles from './NotFoundPage.module.css';

export default function NotFoundPage() {
  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <div className={styles.emoji}>🦋</div>
        <h1>404</h1>
        <p>This page flew away.</p>
        <Link to="/dashboard" className={styles.link}>Go to Dashboard</Link>
      </div>
    </div>
  );
}
