import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import Card from '../components/ui/Card';
import useFriends from '../hooks/useFriends';
import { searchUsers } from '../api/friends.api';
import styles from './FriendsPage.module.css';

function Avatar({ name }) {
  return (
    <div className={styles.avatar}>
      {(name?.[0] ?? '?').toUpperCase()}
    </div>
  );
}

function PersonName({ username, display_name }) {
  return (
    <div className={styles.personInfo}>
      <span className={styles.username}>{username}</span>
      {display_name && display_name !== username && (
        <span className={styles.displayName}>{display_name}</span>
      )}
    </div>
  );
}

export default function FriendsPage() {
  const { friends, requests, loading, accept, reject, remove, sendRequest } = useFriends();

  const [query, setQuery]         = useState('');
  const [results, setResults]     = useState([]);
  const [searching, setSearching] = useState(false);

  // Debounced search — fires 350 ms after the user stops typing
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await searchUsers(q);
        setResults(data);
      } catch {
        toast.error('Search failed');
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  async function handleSendRequest(userId) {
    try {
      await sendRequest(userId);
      // Optimistically update the result row so the button changes immediately
      setResults(prev =>
        prev.map(r =>
          r.id === userId
            ? { ...r, friendship_status: 'pending', direction: 'sent', friendship_id: null }
            : r
        )
      );
    } catch (err) {
      // toast already shown by useFriends.sendRequest on error path,
      // but sendRequest in useFriends re-throws — catch silently here
      // since the toast is already fired inside the hook
    }
  }

  async function handleAcceptFromSearch(friendshipId) {
    await accept(friendshipId);
    // Update result row
    setResults(prev =>
      prev.map(r =>
        r.friendship_id === friendshipId
          ? { ...r, friendship_status: 'accepted' }
          : r
      )
    );
  }

  function renderSearchAction(result) {
    const { id, friendship_status, direction, friendship_id } = result;

    if (friendship_status === 'accepted') {
      return (
        <span className={styles.alreadyFriends}>Friends</span>
      );
    }
    if (friendship_status === 'pending' && direction === 'sent') {
      return (
        <span className={styles.requestSent}>Request sent</span>
      );
    }
    if (friendship_status === 'pending' && direction === 'received') {
      return (
        <button
          className={styles.btnAccept}
          onClick={() => handleAcceptFromSearch(friendship_id)}
        >
          Accept
        </button>
      );
    }
    // null or rejected — show Add Friend
    return (
      <button
        className={styles.btnAdd}
        onClick={() => handleSendRequest(id)}
      >
        Add friend
      </button>
    );
  }

  const showResults = query.trim().length >= 2;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Friends</h1>

      {/* ── Search ───────────────────────────────────────────── */}
      <Card className={styles.section}>
        <h2 className={styles.sectionTitle}>Find people</h2>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search by username (min 2 characters)…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoComplete="off"
          />
          {searching && <span className={styles.searchSpinner}>…</span>}
        </div>

        {showResults && (
          <div className={styles.resultsList}>
            {results.length === 0 && !searching && (
              <p className={styles.emptyText}>No users found matching "{query.trim()}".</p>
            )}
            {results.map(r => (
              <div key={r.id} className={styles.personRow}>
                <Avatar name={r.username} />
                <PersonName username={r.username} display_name={r.display_name} />
                <div className={styles.rowActions}>
                  {renderSearchAction(r)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Incoming requests ────────────────────────────────── */}
      {(loading || requests.length > 0) && (
        <Card className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Friend requests
            {requests.length > 0 && (
              <span className={styles.countBadge}>{requests.length}</span>
            )}
          </h2>

          {loading ? (
            <p className={styles.emptyText}>Loading…</p>
          ) : requests.length === 0 ? (
            <p className={styles.emptyText}>No pending requests.</p>
          ) : (
            <div className={styles.list}>
              {requests.map(r => (
                <div key={r.friendship_id} className={styles.personRow}>
                  <Avatar name={r.username} />
                  <PersonName username={r.username} display_name={r.display_name} />
                  <div className={styles.rowActions}>
                    <button
                      className={styles.btnAccept}
                      onClick={() => accept(r.friendship_id)}
                    >
                      Accept
                    </button>
                    <button
                      className={styles.btnDecline}
                      onClick={() => reject(r.friendship_id)}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ── Friends list ─────────────────────────────────────── */}
      <Card className={styles.section}>
        <h2 className={styles.sectionTitle}>
          My study buddies
          {friends.length > 0 && (
            <span className={styles.countBadge}>{friends.length}</span>
          )}
        </h2>

        {loading ? (
          <p className={styles.emptyText}>Loading…</p>
        ) : friends.length === 0 ? (
          <p className={styles.emptyText}>
            No study buddies yet — search for users above to add friends.
          </p>
        ) : (
          <div className={styles.list}>
            {friends.map(f => (
              <div key={f.friendship_id} className={[styles.personRow, styles.friendRow].join(' ')}>
                <Avatar name={f.username} />
                <PersonName username={f.username} display_name={f.display_name} />
                <div className={styles.studyStatus}>
                  <span
                    className={[styles.dot, f.is_studying && styles.dotActive].filter(Boolean).join(' ')}
                    title={f.is_studying ? 'Currently studying' : 'Not studying'}
                  />
                  {f.is_studying && (
                    <span className={styles.studyingLabel}>studying now</span>
                  )}
                </div>
                <button
                  className={styles.btnRemove}
                  onClick={() => remove(f.friendship_id)}
                  title="Remove friend"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
