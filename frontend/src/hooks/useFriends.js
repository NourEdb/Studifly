import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import * as api from '../api/friends.api';
import { useSocket } from '../context/SocketContext';

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

  // Real-time presence — update dots when a buddy starts or stops studying
  useEffect(() => {
    if (!socket) return;

    function onBuddyStarted({ userId, username }) {
      setFriends(prev =>
        prev.map(f => f.id === userId ? { ...f, is_studying: true } : f)
      );
      toast(`🟢 ${username} started studying!`, { duration: 4000 });
    }

    function onBuddyStopped({ userId }) {
      setFriends(prev =>
        prev.map(f => f.id === userId ? { ...f, is_studying: false } : f)
      );
    }

    socket.on('buddy_started_studying', onBuddyStarted);
    socket.on('buddy_stopped_studying', onBuddyStopped);

    return () => {
      socket.off('buddy_started_studying', onBuddyStarted);
      socket.off('buddy_stopped_studying', onBuddyStopped);
    };
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

  return { friends, requests, loading, refresh: load, accept, reject, remove, sendRequest };
}
