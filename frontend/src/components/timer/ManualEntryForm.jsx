import { useState } from 'react';
import toast from 'react-hot-toast';
import { manualSession } from '../../api/sessions.api';
import { parseSelection } from '../../utils/subtaskSelection';
import DateTimePicker from '../ui/DateTimePicker';
import Button from '../ui/Button';
import TaskSubtaskSelect from './TaskSubtaskSelect';
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

const COMPLETION_OPTIONS = [
  { value: '',          label: 'No answer' },
  { value: 'yes',       label: 'Yes!' },
  { value: 'partially', label: 'Partially' },
  { value: 'no',        label: 'Not really' },
];

export default function ManualEntryForm({ tasks, blocks, onSaved }) {
  const [form, setForm] = useState({
    selection: '', start_time: null, end_time: null, notes: '', completion_answer: '',
  });
  const [focus, setFocus]           = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [loading, setLoading]       = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  const { taskId, studyBlockId } = parseSelection(form.selection, tasks, blocks || []);
  const isSubtask = !!studyBlockId;

  const duration = (() => {
    if (!form.start_time || !form.end_time) return null;
    const diff = (form.end_time - form.start_time) / 1000;
    if (diff <= 0) return null;
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  })();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.start_time || !form.end_time) { toast.error('Start and end time required'); return; }
    if (form.end_time <= form.start_time) { toast.error('End time must be after start time'); return; }
    setLoading(true);
    try {
      await manualSession({
        task_id:            taskId,
        study_block_id:     studyBlockId,
        start_time:         form.start_time.toISOString(),
        end_time:           form.end_time.toISOString(),
        notes:              form.notes || null,
        completion_answer:  (taskId || studyBlockId) ? (form.completion_answer || null) : null,
        focus_score:        focus,
        difficulty_rating:  difficulty,
      });
      toast.success('Session logged');
      setForm({ selection: '', start_time: null, end_time: null, notes: '', completion_answer: '' });
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
      <h3 className={styles.title}>Log Session Manually</h3>

      <div className={styles.field}>
        <label>Task (optional)</label>
        <TaskSubtaskSelect
          tasks={tasks}
          blocks={blocks}
          value={form.selection}
          onChange={selection => setForm(f => ({ ...f, selection, completion_answer: selection ? f.completion_answer : '' }))}
          placeholder="— No task —"
        />
      </div>

      {form.selection && (
        <div className={styles.field}>
          <label>Did you complete the {isSubtask ? 'subtask' : 'task'}?</label>
          <select value={form.completion_answer} onChange={e => set('completion_answer', e.target.value)}>
            {COMPLETION_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      )}

      <div className={styles.row}>
        <DateTimePicker id="manual-start" label="Start time" selected={form.start_time} onChange={date => set('start_time', date)} />
        <DateTimePicker id="manual-end" label="End time" selected={form.end_time} onChange={date => set('end_time', date)} />
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
