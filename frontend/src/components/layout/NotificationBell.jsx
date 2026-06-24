import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getEvents } from '../../api/events.api';
import { getRequests, acceptRequest, rejectRequest } from '../../api/friends.api';
import { useSocket } from '../../context/SocketContext';
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
  const socket = useSocket();

  const [events,         setEvents]         = useState([]);
  const [seenIds,        setSeenIds]        = useState(loadSeen);
  const [friendRequests, setFriendRequests] = useState([]);
  const [open,           setOpen]           = useState(false);
  const ref = useRef(null);

  // ── Data loading ─────────────────────────────────────────────
  useEffect(() => { getEvents().then(setEvents).catch(() => {}); }, []);

  const loadRequests = useCallback(() => {
    getRequests().then(setFriendRequests).catch(() => {});
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  // ── Real-time: new friend request ────────────────────────────
  useEffect(() => {
    if (!socket) return;
    // Re-fetch the full list so we get display_name + all fields correctly
    function onFriendRequestReceived() { loadRequests(); }
    socket.on('friend_request_received', onFriendRequestReceived);
    return () => socket.off('friend_request_received', onFriendRequestReceived);
  }, [socket, loadRequests]);

  // ── Close on outside click ───────────────────────────────────
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ── Derived counts ───────────────────────────────────────────
  const upcoming    = filterUpcoming(events);
  const unreadCount = upcoming.filter(e => !seenIds.has(e.id)).length;
  const totalBadge  = unreadCount + friendRequests.length;

  // ── Handlers ─────────────────────────────────────────────────
  function markSeen(id) {
    setSeenIds(prev => {
      const next = new Set(prev);
      next.add(id);
      saveSeen(next);
      return next;
    });
  }

  async function handleAccept(friendshipId) {
    try {
      await acceptRequest(friendshipId);
      setFriendRequests(prev => prev.filter(r => r.friendship_id !== friendshipId));
      toast.success('Friend request accepted!');
    } catch {
      toast.error('Failed to accept request');
    }
  }

  async function handleDecline(friendshipId) {
    try {
      await rejectRequest(friendshipId);
      setFriendRequests(prev => prev.filter(r => r.friendship_id !== friendshipId));
    } catch {
      toast.error('Failed to decline request');
    }
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className={styles.wrapper} ref={ref}>
      <button
        className={[styles.bell, open && styles.bellOpen].filter(Boolean).join(' ')}
        onClick={() => setOpen(o => !o)}
        aria-label="Notifications"
      >
        🔔
        {totalBadge > 0 && (
          <span className={styles.badge}>{totalBadge > 9 ? '9+' : totalBadge}</span>
        )}
      </button>

      {open && (
        <div className={styles.dropdown}>

          {/* ── Friend Requests section ──────────────────────── */}
          {friendRequests.length > 0 && (
            <>
              <div className={styles.dropHeader}>
                <span className={styles.dropTitle}>Friend Requests</span>
                <span className={styles.dropSub}>{friendRequests.length} pending</span>
              </div>
              <ul className={styles.list}>
                {friendRequests.map(req => (
                  <li key={req.friendship_id} className={styles.requestItem}>
                    <div className={styles.reqAvatar}>
                      {(req.username?.[0] ?? '?').toUpperCase()}
                    </div>
                    <div className={styles.info}>
                      <span className={styles.evTitle}>{req.username}</span>
                      {req.display_name && req.display_name !== req.username && (
                        <span className={styles.meta}>{req.display_name}</span>
                      )}
                    </div>
                    <div className={styles.reqActions}>
                      <button
                        className={styles.btnAccept}
                        onClick={() => handleAccept(req.friendship_id)}
                        title="Accept"
                      >✓</button>
                      <button
                        className={styles.btnDecline}
                        onClick={() => handleDecline(req.friendship_id)}
                        title="Decline"
                      >✕</button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* ── Upcoming Events section ──────────────────────── */}
          <div className={[styles.dropHeader, friendRequests.length > 0 && styles.dropHeaderBorder].filter(Boolean).join(' ')}>
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
