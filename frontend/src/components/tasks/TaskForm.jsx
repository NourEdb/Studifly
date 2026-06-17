import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { getCustomActivityTypes } from '../../api/tasks.api';
import styles from './TaskForm.module.css';

const BUILT_IN_ACTIVITY_TYPES = new Set(['reading', 'practice', 'watching', 'other']);

const ACTIVITY_TYPES = ['reading', 'practice', 'watching', 'other'];

function minsToHHMM(mins) {
  if (!mins) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function hhmmToMins(hhmm) {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function initForm(initial) {
  const rawType = initial?.activity_type || 'reading';
  const isCustom = initial && !BUILT_IN_ACTIVITY_TYPES.has(rawType);
  return {
    name:          initial?.name || '',
    course_id:     initial?.course_id || '',
    activity_type: isCustom ? '__custom__' : rawType,
    customType:    isCustom ? rawType : '',
    planned_time:  minsToHHMM(initial?.planned_time),
    due_date:      initial?.due_date || '',
  };
}

const STATUS_LABELS = { pending: 'Pending', in_progress: 'In Progress', completed: 'Completed' };
const STATUS_COLORS = { pending: 'var(--color-text-muted)', in_progress: 'var(--color-blue)', completed: 'var(--color-success)' };

export default function TaskForm({ initial, courses, onSave, onClose }) {
  const [form, setForm]               = useState(() => initForm(initial));
  const [customTypes, setCustomTypes] = useState([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  useEffect(() => {
    getCustomActivityTypes()
      .then(types => {
        setCustomTypes(types);
        setForm(prev => {
          if (prev.activity_type === '__custom__' && types.includes(prev.customType)) {
            return { ...prev, activity_type: prev.customType, customType: '' };
          }
          return prev;
        });
      })
      .catch(() => {});
  }, []);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    const finalType = form.activity_type === '__custom__'
      ? form.customType.trim()
      : form.activity_type;
    if (!finalType) { setError('Please enter a custom activity type'); return; }
    setError('');
    setLoading(true);
    try {
      await onSave({
        ...form,
        activity_type: finalType,
        course_id:     form.course_id || null,
        planned_time:  hhmmToMins(form.planned_time),
        due_date:      form.due_date || null,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={initial ? 'Edit Task' : 'New Task'} onClose={onClose}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <Input
          id="task-name"
          label="Task name"
          value={form.name}
          onChange={e => set('name', e.target.value)}
          required
          autoFocus
        />

        <div className={styles.field}>
          <label htmlFor="task-course">Course (optional)</label>
          <select id="task-course" value={form.course_id} onChange={e => set('course_id', e.target.value)}>
            <option value="">— No course —</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="task-type">Activity type</label>
          <select id="task-type" value={form.activity_type} onChange={e => set('activity_type', e.target.value)}>
            {ACTIVITY_TYPES.map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
            {customTypes.map(t => (
              <option key={`custom-${t}`} value={t}>{t}</option>
            ))}
            <option value="__custom__">Other (custom)…</option>
          </select>
        </div>

        {form.activity_type === '__custom__' && (
          <div className={styles.field}>
            <label htmlFor="task-custom-type">Custom activity type</label>
            <input
              id="task-custom-type"
              className={styles.customInput}
              value={form.customType}
              onChange={e => { set('customType', e.target.value); setError(''); }}
              placeholder="e.g. Writing, Drawing, Research…"
              maxLength={50}
              autoFocus
            />
            {error && <span className={styles.error}>{error}</span>}
          </div>
        )}

        <div className={styles.row}>
          <Input
            id="task-time"
            label="Planned time (HH:MM)"
            type="text"
            placeholder="00:00"
            pattern="[0-9]{1,3}:[0-5][0-9]"
            value={form.planned_time}
            onChange={e => set('planned_time', e.target.value)}
          />
          <Input
            id="task-due"
            label="Due date (optional)"
            type="date"
            value={form.due_date}
            onChange={e => set('due_date', e.target.value)}
          />
        </div>

        {initial && (
          <p className={styles.statusReadOnly}>
            Status:&nbsp;
            <span style={{ color: STATUS_COLORS[initial.status], fontWeight: 600 }}>
              {STATUS_LABELS[initial.status] ?? initial.status}
            </span>
            <span className={styles.statusHint}> — updated automatically from session reflections</span>
          </p>
        )}

        <div className={styles.actions}>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={loading || !form.name.trim()}>
            {loading ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
