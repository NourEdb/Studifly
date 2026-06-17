import { useState, useEffect, useCallback } from 'react';
import { getTasks, createTask, updateTask, deleteTask } from '../api/tasks.api';
import toast from 'react-hot-toast';

export default function useTasks(filters = {}) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(filters);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTasks(filters);
      setTasks(data);
    } catch {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetch(); }, [fetch]);

  async function add(data) {
    const task = await createTask(data);
    setTasks(prev => [task, ...prev]);
    return task;
  }

  async function edit(id, data) {
    const task = await updateTask(id, data);
    setTasks(prev => prev.map(t => t.id === id ? task : t));
    return task;
  }

  async function remove(id) {
    await deleteTask(id);
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  return { tasks, loading, add, edit, remove, refresh: fetch };
}
