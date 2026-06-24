import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import NotificationBell from './NotificationBell';
import MoodCheckinModal, { wasSkippedToday } from '../mood/MoodCheckinModal';
import { getTodayCheckin } from '../../api/mood.api';
import { useAuth } from '../../context/AuthContext';
import styles from './Layout.module.css';

const PAGE_TITLES = {
  '/dashboard':    'Dashboard',
  '/courses':      'My Courses',
  '/tasks':        'Tasks',
  '/tracker':      'Study Tracker',
  '/planner':      'Weekly Planner',
};

export default function Layout() {
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] || 'Studifly';
  const [sidebarOpen,    setSidebarOpen]    = useState(false);
  const [showMoodModal,  setShowMoodModal]  = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    if (wasSkippedToday()) return;
    const timer = setTimeout(async () => {
      try {
        const existing = await getTodayCheckin();
        if (!existing) setShowMoodModal(true);
      } catch { /* ignore */ }
    }, 2000);
    return () => clearTimeout(timer);
  }, [user?.id]);

  return (
    <div className={styles.layout}>
      {showMoodModal && <MoodCheckinModal onClose={() => setShowMoodModal(false)} />}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className={styles.main}>
        <header className={styles.topbar}>
          <button
            className={styles.hamburger}
            onClick={() => setSidebarOpen(o => !o)}
            aria-label="Toggle menu"
          >
            ☰
          </button>
          <h1 className={styles.pageTitle}>{title}</h1>
          <NotificationBell />
        </header>
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
