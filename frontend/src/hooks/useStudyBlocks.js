import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  getStudyBlocks,
  createStudyBlock,
  updateStudyBlock,
  updateStudyBlockStatus,
  deleteStudyBlock,
  logActualProgress,
} from '../api/study-blocks.api';

export default function useStudyBlocks() {
  const [blocks, setBlocks]   = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getStudyBlocks();
      setBlocks(data);
    } catch {
      toast.error('Failed to load study blocks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  async function add(data) {
    const block = await createStudyBlock(data);
    setBlocks(prev => [...prev, block]);
    return block;
  }

  async function edit(id, data) {
    const block = await updateStudyBlock(id, data);
    setBlocks(prev => prev.map(b => b.id === id ? block : b));
    return block;
  }

  async function remove(id) {
    await deleteStudyBlock(id);
    setBlocks(prev => prev.filter(b => b.id !== id));
  }

  async function logActual(id, data) {
    const block = await logActualProgress(id, data);
    setBlocks(prev => prev.map(b => b.id === id ? block : b));
    return block;
  }

  async function setStatus(id, status) {
    const block = await updateStudyBlockStatus(id, status);
    setBlocks(prev => prev.map(b => b.id === id ? block : b));
    return block;
  }

  // Patches the in-memory list only (no API call) — for reflecting a status
  // change made elsewhere (e.g. the timer already updated the backend).
  function updateLocal(id, patch) {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));
  }

  function forTask(taskId) {
    return blocks.filter(b => b.task_id === taskId);
  }

  return { blocks, loading, add, edit, remove, logActual, setStatus, updateLocal, forTask, refresh: fetch };
}
