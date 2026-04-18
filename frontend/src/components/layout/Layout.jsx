import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import styles from './Layout.module.css';

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/courses': 'My Courses',
  '/tasks': 'Tasks',
  '/tracker': 'Study Tracker',
  '/planner': 'Weekly Planner',
};

export default function Layout() {
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] || 'Studifly';

  return (
    <div className={styles.layout}>
      <Sidebar />
      <div className={styles.main}>
        <header className={styles.topbar}>
          <h1 className={styles.pageTitle}>{title}</h1>
        </header>
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
