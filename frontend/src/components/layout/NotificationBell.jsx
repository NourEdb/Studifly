import { useState, useEffect, useRef } from 'react';
import { getEvents } from '../../api/events.api';
import styles from './NotificationBell.module.css';

const TYPE_ICONS = {
  exam:     '📝',
  deadline: '⏰',
  meeting:  '👥',
  reminder: '🔔',
  other:    '📌',
};

const STORAGE_KEY = 'studifly_seen_event_ids';

function loadSeen() {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); }
  catch { return new Set(); }
}
function saveSeen(set) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}

function daysLabel(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  const diff = Math.round((target - today) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return `In ${diff} days`;
}

function filterUpcoming(events) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const limit = new Date(today); limit.setDate(limit.getDate() + 3);
  const todayStr = today.toISOString().slice(0, 10);
  const limitStr = limit.toISOString().slice(0, 10);
  return events
    .filter(e => e.event_date >= todayStr && e.event_date <= limitStr)
    .sort((a, b) => a.event_date.localeCompare(b.event_date) || (a.event_time || '').localeCompare(b.event_time || ''));
}

export default function NotificationBell() {
  const [events,  setEvents]  = useState([]);
  const [seenIds, setSeenIds] = useState(loadSeen);
  const [open,    setOpen]    = useState(false);
  const ref = useRef(null);

  useEffect(() => { getEvents().then(setEvents).catch(() => {}); }, []);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const upcoming = filterUpcoming(events);
  const unreadCount = upcoming.filter(e => !seenIds.has(e.id)).length;

  function markSeen(id) {
    setSeenIds(prev => {
      const next = new Set(prev);
      next.add(id);
      saveSeen(next);
      return next;
    });
  }

  return (
    <div className={styles.wrapper} ref={ref}>
      <button
        className={[styles.bell, open && styles.bellOpen].filter(Boolean).join(' ')}
        onClick={() => setOpen(o => !o)}
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span className={styles.badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.dropHeader}>
            <span className={styles.dropTitle}>Upcoming Events</span>
            <span className={styles.dropSub}>Next 3 days</span>
          </div>

          {upcoming.length === 0 ? (
            <p className={styles.empty}>No events in the next 3 days</p>
          ) : (
            <ul className={styles.list}>
              {upcoming.map(ev => {
                const seen = seenIds.has(ev.id);
                return (
                  <li
                    key={ev.id}
                    className={[styles.item, seen && styles.seen].filter(Boolean).join(' ')}
                    onClick={() => markSeen(ev.id)}
                  >
                    <span className={styles.typeIcon}>{TYPE_ICONS[ev.type] || '📌'}</span>
                    <div className={styles.info}>
                      <span className={styles.evTitle}>{ev.title}</span>
                      <span className={styles.meta}>
                        {daysLabel(ev.event_date)}
                        {ev.event_time ? ` · ${ev.event_time}` : ''}
                      </span>
                    </div>
                    {!seen && <span className={styles.unreadDot} />}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
