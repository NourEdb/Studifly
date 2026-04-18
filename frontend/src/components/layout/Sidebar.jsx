import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTimerContext } from '../../context/TimerContext';
import logo from '../../assets/studifly-logo.png';
import styles from './Sidebar.module.css';

const NAV = [
  { to: '/dashboard', icon: '📊', label: 'Dashboard' },
  { to: '/courses', icon: '📚', label: 'Courses' },
  { to: '/tasks', icon: '✅', label: 'Tasks' },
  { to: '/tracker', icon: '⏱️', label: 'Tracker' },
  { to: '/planner', icon: '📅', label: 'Planner' },
];

export default function Sidebar() {
  const { logoutUser, user } = useAuth();
  const { isRunning } = useTimerContext();
  const navigate = useNavigate();

  function handleLogout() {
    logoutUser();
    navigate('/login');
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <img src={logo} alt="Studifly" className={styles.logo} />
        <p className={styles.tagline}>Learn, grow, and fly.</p>
      </div>

      <nav className={styles.nav}>
        {NAV.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => [styles.link, isActive && styles.active].filter(Boolean).join(' ')}
          >
            <span className={styles.icon}>{icon}</span>
            <span>{label}</span>
            {to === '/tracker' && isRunning && <span className={styles.timerDot} />}
          </NavLink>
        ))}
      </nav>

      <div className={styles.bottom}>
        <div className={styles.user}>
          <div className={styles.avatar}>{user?.username?.[0]?.toUpperCase()}</div>
          <span className={styles.username}>{user?.username}</span>
        </div>
        <button className={styles.logout} onClick={handleLogout}>Sign out</button>
      </div>
    </aside>
  );
}
