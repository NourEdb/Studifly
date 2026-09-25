import { useState, useEffect, useCallback, createElement } from 'react';
import toast from 'react-hot-toast';
import * as api from '../api/friends.api';
import { useSocket } from '../context/SocketContext';

// This file is plain .js (no JSX), so the invite toast's clickable "Join"
// button is built with createElement instead — same visual result as JSX,
// just without the transform. Nothing auto-opens; the recipient must click.
function renderStudyInviteToast(fromUsername, meetingLink, t) {
  return createElement(
    'span',
    { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
    createElement('span', null, `🎥 ${fromUsername} wants to study together!`),
    createElement(
      'button',
      {
        onClick: () => {
          window.open(meetingLink, '_blank', 'noopener,noreferrer');
          toast.dismiss(t.id);
        },
        style: {
          background: 'var(--color-purple)',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          padding: '4px 12px',
          fontWeight: 700,
          fontSize: '0.8rem',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        },
      },
      'Join'
    )
  );
}

export default function useFriends() {
  const socket = useSocket();
  const [friends, setFriends]   = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [f, r] = await Promise.all([api.getFriends(), api.getRequests()]);
      setFriends(f);
      setRequests(r);
    } catch {
      toast.error('Failed to load friends');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Real-time: a new incoming friend request — refresh so this page's own
  // "Friend requests" card updates immediately too, matching NotificationBell's
  // existing behavior (both listen on the same socket for the same event; the
  // bell already reacted live, this hook just never picked it up before).
  useEffect(() => {
    if (!socket) return;
    function onFriendRequestReceived() { load(); }
    socket.on('friend_request_received', onFriendRequestReceived);
    return () => socket.off('friend_request_received', onFriendRequestReceived);
  }, [socket, load]);

  // Real-time presence — update dots when a buddy starts or stops studying
  useEffect(() => {
    if (!socket) return;

    function onBuddyStarted({ userId, username, label }) {
      setFriends(prev =>
        // `label` is only ever present when that friend has opted in (see
        // presence.service.js) — absent/undefined just means "studying now"
        // with no subject, same as a friend who never opted in at all.
        prev.map(f => f.id === userId ? { ...f, is_studying: true, studying_label: label ?? null } : f)
      );
      toast(`🟢 ${username} started studying!`, { duration: 4000 });
    }

    function onBuddyStopped({ userId }) {
      setFriends(prev =>
        prev.map(f => f.id === userId ? { ...f, is_studying: false, studying_label: null } : f)
      );
    }

    socket.on('buddy_started_studying', onBuddyStarted);
    socket.on('buddy_stopped_studying', onBuddyStopped);

    return () => {
      socket.off('buddy_started_studying', onBuddyStarted);
      socket.off('buddy_stopped_studying', onBuddyStopped);
    };
  }, [socket]);

  // Real-time "Study Together" invites — nothing persisted, purely a live
  // nudge (see friends.controller.js), so it's a toast with a Join action,
  // not an entry in NotificationBell (which only re-fetches persisted data).
  useEffect(() => {
    if (!socket) return;

    function onStudyInvite({ fromUsername, meetingLink }) {
      toast(
        (t) => renderStudyInviteToast(fromUsername, meetingLink, t),
        { duration: 20000 }
      );
    }

    socket.on('study_invite', onStudyInvite);
    return () => socket.off('study_invite', onStudyInvite);
  }, [socket]);

  async function accept(friendshipId) {
    try {
      await api.acceptRequest(friendshipId);
      toast.success('Friend request accepted!');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to accept request');
    }
  }

  async function reject(friendshipId) {
    try {
      await api.rejectRequest(friendshipId);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reject request');
    }
  }

  async function remove(friendshipId) {
    try {
      await api.removeFriend(friendshipId);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove friend');
    }
  }

  async function sendRequest(userId) {
    await api.sendRequest(userId);
    toast.success('Friend request sent!');
  }

  // Returns whether the invite actually went out — the caller (FriendsPage.jsx)
  // uses this to decide whether to open the sender's own meeting link, same
  // boolean-result pattern as useStudyGroups.js's createGroup.
  async function sendStudyInvite(userId, username) {
    try {
      await api.sendStudyInvite(userId);
      toast.success(`Invite sent to ${username}!`);
      return true;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send invite');
      return false;
    }
  }

  return { friends, requests, loading, refresh: load, accept, reject, remove, sendRequest, sendStudyInvite };
}
