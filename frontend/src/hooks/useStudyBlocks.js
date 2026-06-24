import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  getStudyBlocks,
  createStudyBlock,
  updateStudyBlock,
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

  function forTask(taskId) {
    return blocks.filter(b => b.task_id === taskId);
  }

  return { blocks, loading, add, edit, remove, logActual, forTask, refresh: fetch };
}
