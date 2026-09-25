import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import Card from '../components/ui/Card';
import useFriends from '../hooks/useFriends';
import useStudyGroups from '../hooks/useStudyGroups';
import { useAuth } from '../context/AuthContext';
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
  const { friends, requests, loading, accept, reject, remove, sendRequest, sendStudyInvite } = useFriends();
  const { user } = useAuth();
  const {
    groups, loading: groupsLoading,
    leaderboards, leaderboardLoading,
    loadLeaderboard, createGroup, leaveGroup, deleteGroup, addMember, removeMember,
  } = useStudyGroups();

  const [query, setQuery]         = useState('');
  const [results, setResults]     = useState([]);
  const [searching, setSearching] = useState(false);

  const [groupFormOpen, setGroupFormOpen]         = useState(false);
  const [groupName, setGroupName]                 = useState('');
  const [selectedFriendIds, setSelectedFriendIds] = useState([]);
  const [creatingGroup, setCreatingGroup]         = useState(false);
  const [expandedGroupId, setExpandedGroupId]     = useState(null);
  const [addMemberChoice, setAddMemberChoice]     = useState({}); // { [groupId]: userId }

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

  // Sender-only: opens MY OWN meeting link right after the invite goes out —
  // the recipient's side is untouched (they still just get the toast with a
  // manual Join button, see useFriends.js's study_invite listener).
  //
  // The tab is opened synchronously, in direct response to the click, and
  // only filled in once the invite is confirmed sent — opening it *after*
  // awaiting the API call risks browsers' popup blockers treating window.open
  // as no longer tied to a user gesture. The button is only enabled when
  // user.meeting_link is set, so it's always defined here.
  async function handleStudyTogether(friendId, friendUsername) {
    const tab = window.open('', '_blank', 'noopener,noreferrer');
    const sent = await sendStudyInvite(friendId, friendUsername);
    if (!tab) return; // popup blocked outright — nothing more we can do
    if (sent) {
      tab.location.href = user.meeting_link;
    } else {
      tab.close();
    }
  }

  function toggleFriendSelection(friendId) {
    setSelectedFriendIds(prev =>
      prev.includes(friendId) ? prev.filter(id => id !== friendId) : [...prev, friendId]
    );
  }

  async function handleCreateGroup(e) {
    e.preventDefault();
    if (!groupName.trim()) return;
    setCreatingGroup(true);
    const ok = await createGroup(groupName.trim(), selectedFriendIds);
    setCreatingGroup(false);
    if (ok) {
      setGroupName('');
      setSelectedFriendIds([]);
      setGroupFormOpen(false);
    }
  }

  function cancelCreateGroup() {
    setGroupFormOpen(false);
    setGroupName('');
    setSelectedFriendIds([]);
  }

  async function toggleExpandGroup(groupId) {
    const opening = expandedGroupId !== groupId;
    setExpandedGroupId(opening ? groupId : null);
    if (opening && !leaderboards[groupId]) {
      await loadLeaderboard(groupId);
    }
  }

  async function handleAddMember(groupId) {
    const userId = addMemberChoice[groupId];
    if (!userId) return;
    await addMember(groupId, parseInt(userId, 10));
    setAddMemberChoice(prev => ({ ...prev, [groupId]: '' }));
  }

  function handleDeleteGroup(groupId) {
    if (!confirm('Delete this group for all members?')) return;
    deleteGroup(groupId);
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
                  className={styles.btnStudyTogether}
                  onClick={() => handleStudyTogether(f.id, f.username)}
                  disabled={!user?.meeting_link}
                  title={user?.meeting_link
                    ? `Invite ${f.username} to study together`
                    : 'Add your study call link in Settings first'}
                >
                  🎥 Study Together
                </button>
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

      {/* ── Study groups ─────────────────────────────────────── */}
      <Card className={styles.section}>
        <h2 className={styles.sectionTitle}>
          Study groups
          {groups.length > 0 && (
            <span className={styles.countBadge}>{groups.length}</span>
          )}
        </h2>

        {!groupFormOpen ? (
          <button
            className={styles.btnAdd}
            onClick={() => setGroupFormOpen(true)}
            disabled={friends.length === 0}
            title={friends.length === 0 ? 'Add friends first to create a group' : undefined}
          >
            + Create group
          </button>
        ) : (
          <form onSubmit={handleCreateGroup} className={styles.groupForm}>
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Group name…"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              maxLength={50}
              autoFocus
            />
            <p className={styles.groupFormHint}>Pick friends to add:</p>
            <div className={styles.checkboxList}>
              {friends.map(f => (
                <label key={f.id} className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={selectedFriendIds.includes(f.id)}
                    onChange={() => toggleFriendSelection(f.id)}
                  />
                  <Avatar name={f.username} />
                  <PersonName username={f.username} display_name={f.display_name} />
                </label>
              ))}
            </div>
            <div className={styles.groupFormActions}>
              <button type="button" className={styles.btnDecline} onClick={cancelCreateGroup}>
                Cancel
              </button>
              <button type="submit" className={styles.btnAccept} disabled={creatingGroup || !groupName.trim()}>
                {creatingGroup ? 'Creating…' : 'Create group'}
              </button>
            </div>
          </form>
        )}

        {groupsLoading ? (
          <p className={styles.emptyText}>Loading…</p>
        ) : groups.length === 0 ? (
          <p className={styles.emptyText}>
            No study groups yet — create one from your friends above.
          </p>
        ) : (
          <div className={styles.list}>
            {groups.map(g => {
              const isExpanded = expandedGroupId === g.id;
              const board = leaderboards[g.id];
              const memberIdsInGroup = board ? board.map(row => row.user_id) : [];
              const addableFriends = friends.filter(f => !memberIdsInGroup.includes(f.id));

              return (
                <div key={g.id} className={styles.groupCard}>
                  <div className={styles.groupHeader} onClick={() => toggleExpandGroup(g.id)}>
                    <div className={styles.groupHeaderInfo}>
                      <span className={styles.groupName}>{g.name}</span>
                      <span className={styles.groupMeta}>
                        {g.member_count} member{g.member_count !== 1 ? 's' : ''}
                        {g.is_creator && ' · you created this'}
                      </span>
                    </div>
                    <span className={styles.groupChevron}>{isExpanded ? '▲' : '▼'}</span>
                  </div>

                  {isExpanded && (
                    <div className={styles.groupBody}>
                      {leaderboardLoading[g.id] ? (
                        <p className={styles.emptyText}>Loading leaderboard…</p>
                      ) : (
                        <>
                          <p className={styles.leaderboardCaption}>This week's study hours</p>
                          <div className={styles.leaderboardList}>
                            {(board || []).map(row => (
                              <div key={row.user_id} className={styles.leaderboardRow}>
                                <span className={styles.leaderboardRank}>#{row.rank}</span>
                                <Avatar name={row.username} />
                                <PersonName username={row.username} display_name={row.display_name} />
                                <span className={styles.leaderboardHours}>{row.total_hours}h</span>
                                {g.is_creator && row.user_id !== g.created_by && (
                                  <button
                                    className={styles.btnRemove}
                                    title="Remove from group"
                                    onClick={() => removeMember(g.id, row.user_id)}
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>

                          {g.is_creator && addableFriends.length > 0 && (
                            <div className={styles.addMemberRow}>
                              <select
                                className={styles.groupSelect}
                                value={addMemberChoice[g.id] || ''}
                                onChange={e => setAddMemberChoice(prev => ({ ...prev, [g.id]: e.target.value }))}
                              >
                                <option value="">Add a friend…</option>
                                {addableFriends.map(f => (
                                  <option key={f.id} value={f.id}>{f.display_name || f.username}</option>
                                ))}
                              </select>
                              <button
                                className={styles.btnAdd}
                                disabled={!addMemberChoice[g.id]}
                                onClick={() => handleAddMember(g.id)}
                              >
                                Add
                              </button>
                            </div>
                          )}

                          <div className={styles.groupFooterActions}>
                            <button className={styles.btnLeaveGroup} onClick={() => leaveGroup(g.id)}>
                              Leave group
                            </button>
                            {g.is_creator && (
                              <button className={styles.btnDeleteGroup} onClick={() => handleDeleteGroup(g.id)}>
                                Delete group
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
