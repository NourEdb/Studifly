import { useState } from 'react';
import toast from 'react-hot-toast';
import { manualSession } from '../../api/sessions.api';
import Input from '../ui/Input';
import Button from '../ui/Button';
import styles from './ManualEntryForm.module.css';

function StarRating({ value, onChange, label }) {
  return (
    <div className={styles.ratingGroup}>
      <span className={styles.ratingLabel}>{label}</span>
      <div className={styles.stars}>
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            className={[styles.star, n <= value ? styles.starActive : ''].join(' ')}
            onClick={() => onChange(n === value ? null : n)}
            aria-label={`${n} star`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ManualEntryForm({ tasks, onSaved }) {
  const [form, setForm] = useState({
    task_id: '', start_time: '', end_time: '', notes: '',
  });
  const [focus, setFocus]           = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [loading, setLoading]       = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  const duration = (() => {
    if (!form.start_time || !form.end_time) return null;
    const diff = (new Date(form.end_time) - new Date(form.start_time)) / 1000;
    if (diff <= 0) return null;
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  })();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.start_time || !form.end_time) { toast.error('Start and end time required'); return; }
    if (new Date(form.end_time) <= new Date(form.start_time)) { toast.error('End time must be after start time'); return; }
    setLoading(true);
    try {
      await manualSession({
        ...form,
        task_id:          form.task_id || null,
        notes:            form.notes || null,
        focus_score:      focus,
        difficulty_rating: difficulty,
      });
      toast.success('Session logged');
      setForm({ task_id: '', start_time: '', end_time: '', notes: '' });
      setFocus(null);
      setDifficulty(null);
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

      {duration && <p className={styles.durationPreview}>Duration: {duration}</p>}

      <div className={styles.ratingsRow}>
        <StarRating label="Focus level" value={focus} onChange={setFocus} />
        <StarRating label="Difficulty"  value={difficulty} onChange={setDifficulty} />
      </div>

      <div className={styles.field}>
        <label>Notes (optional)</label>
        <textarea
          className={styles.textarea}
          rows={2}
          placeholder="What did you work on?"
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
        />
      </div>

      <Button type="submit" disabled={loading} fullWidth>
        {loading ? 'Saving…' : 'Log Session'}
      </Button>
    </form>
  );
}
