import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import * as api from '../api/study-groups.api';

export default function useStudyGroups() {
  const [groups, setGroups]   = useState([]);
  const [loading, setLoading] = useState(true);

  // Leaderboards are fetched on demand (when a group is expanded), keyed by group id,
  // so opening five groups doesn't mean firing five requests up front.
  const [leaderboards, setLeaderboards]     = useState({}); // { [groupId]: [...] }
  const [leaderboardLoading, setLLoading]   = useState({}); // { [groupId]: bool }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setGroups(await api.getMyGroups());
    } catch {
      toast.error('Failed to load study groups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function loadLeaderboard(groupId) {
    setLLoading(prev => ({ ...prev, [groupId]: true }));
    try {
      const { leaderboard } = await api.getLeaderboard(groupId);
      setLeaderboards(prev => ({ ...prev, [groupId]: leaderboard }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load leaderboard');
    } finally {
      setLLoading(prev => ({ ...prev, [groupId]: false }));
    }
  }

  async function createGroup(name, memberIds) {
    try {
      await api.createGroup(name, memberIds);
      toast.success(`"${name}" created!`);
      await load();
      return true;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create group');
      return false;
    }
  }

  async function leaveGroup(groupId) {
    try {
      await api.leaveGroup(groupId);
      toast.success('Left the group.');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to leave group');
    }
  }

  async function deleteGroup(groupId) {
    try {
      await api.deleteGroup(groupId);
      toast.success('Group deleted.');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete group');
    }
  }

  async function removeMember(groupId, userId) {
    try {
      await api.removeMember(groupId, userId);
      await loadLeaderboard(groupId);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove member');
    }
  }

  async function addMember(groupId, userId) {
    try {
      await api.addMember(groupId, userId);
      await loadLeaderboard(groupId);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add member');
    }
  }

  return {
    groups, loading, refresh: load,
    leaderboards, leaderboardLoading,
    loadLeaderboard, createGroup, leaveGroup, deleteGroup, addMember, removeMember,
  };
}
