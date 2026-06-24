import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTimerContext } from '../../context/TimerContext';
import { useTheme } from '../../context/ThemeContext';
import logo from '../../assets/studifly-logo.png';
import styles from './Sidebar.module.css';

const BADGE_ICONS = {
  first_task:   { icon: '🎯', name: 'First Task' },
  week_streak:  { icon: '🔥', name: 'Week Streak' },
  goal_crusher: { icon: '💪', name: 'Goal Crusher' },
  night_owl:    { icon: '🦉', name: 'Night Owl' },
  early_bird:   { icon: '🐦', name: 'Early Bird' },
};

const NAV = [
  { to: '/dashboard',    icon: '📊', label: 'Dashboard' },
  { to: '/courses',      icon: '📚', label: 'Courses' },
  { to: '/tasks',        icon: '✅', label: 'Tasks' },
  { to: '/tracker',      icon: '⏱️', label: 'Tracker' },
  { to: '/planner',      icon: '📅', label: 'Planner' },
  { to: '/achievements', icon: '🏆', label: 'Achievements' },
  { to: '/ai-coach',     icon: '🧠', label: 'AI Coach' },
  { to: '/settings',     icon: '⚙️', label: 'Settings' },
];

export default function Sidebar({ isOpen, onClose }) {
  const { logoutUser, user } = useAuth();
  const { isRunning } = useTimerContext();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  function handleLogout() {
    onClose?.();
    logoutUser();
    navigate('/login');
  }

  return (
    <>
      {/* Overlay — only visible on mobile when sidebar is open */}
      <div
        className={[styles.overlay, isOpen && styles.overlayVisible].filter(Boolean).join(' ')}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className={[styles.sidebar, isOpen && styles.open].filter(Boolean).join(' ')}>
        <div className={styles.brand}>
          <img src={logo} alt="Studifly" className={styles.logoImg} />
          <p className={styles.tagline}>Learn, grow, and fly.</p>
        </div>

        <nav className={styles.nav}>
          {NAV.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) => [styles.link, isActive && styles.active].filter(Boolean).join(' ')}
            >
              <span className={styles.icon}>{icon}</span>
              <span>{label}</span>
              {to === '/tracker' && isRunning && <span className={styles.timerDot} />}
            </NavLink>
          ))}
        </nav>

        <div className={styles.bottom}>
          <button className={styles.themeToggle} onClick={toggleTheme}>
            {theme === 'dark' ? '☀️' : '🌙'}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <div className={styles.user}>
            <div className={styles.avatar}>{user?.username?.[0]?.toUpperCase()}</div>
            <span className={styles.username}>{user?.username}</span>
            {user?.pinned_badge && BADGE_ICONS[user.pinned_badge] && (
              <span className={styles.pinnedBadge} title={BADGE_ICONS[user.pinned_badge].name}>
                {BADGE_ICONS[user.pinned_badge].icon}
              </span>
            )}
          </div>
          <button className={styles.logout} onClick={handleLogout}>Sign out</button>
        </div>
      </aside>
    </>
  );
}
