import { useState } from 'react';
import toast from 'react-hot-toast';
import { manualSession } from '../../api/sessions.api';
import Input from '../ui/Input';
import Button from '../ui/Button';
import styles from './ManualEntryForm.module.css';

export default function ManualEntryForm({ tasks, onSaved }) {
  const [form, setForm] = useState({ task_id: '', start_time: '', end_time: '' });
  const [loading, setLoading] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.start_time || !form.end_time) { toast.error('Start and end time required'); return; }
    if (new Date(form.end_time) <= new Date(form.start_time)) { toast.error('End time must be after start time'); return; }
    setLoading(true);
    try {
      await manualSession({ ...form, task_id: form.task_id || null });
      toast.success('Session logged');
      setForm({ task_id: '', start_time: '', end_time: '' });
      onSaved?.();
    } catch {
      toast.error('Failed to log session');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h3 className={styles.title}>Log a past session</h3>
      <div className={styles.field}>
        <label>Task (optional)</label>
        <select value={form.task_id} onChange={e => set('task_id', e.target.value)}>
          <option value="">— No task —</option>
          {tasks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div className={styles.row}>
        <Input id="manual-start" label="Start time" type="datetime-local" value={form.start_time} onChange={e => set('start_time', e.target.value)} required />
        <Input id="manual-end" label="End time" type="datetime-local" value={form.end_time} onChange={e => set('end_time', e.target.value)} required />
      </div>
      <Button type="submit" disabled={loading} fullWidth>
        {loading ? 'Saving…' : 'Log Session'}
      </Button>
    </form>
  );
}
