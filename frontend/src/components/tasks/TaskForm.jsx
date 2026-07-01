import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import DateTimePicker from '../ui/DateTimePicker';
import { getCustomActivityTypes } from '../../api/tasks.api';
import styles from './TaskForm.module.css';

const BUILT_IN_ACTIVITY_TYPES = new Set(['reading', 'practice', 'watching', 'other']);

const ACTIVITY_TYPES = ['reading', 'practice', 'watching', 'other'];

function minsToHours(mins) {
  return String(mins ? Math.floor(mins / 60) : 0);
}

function minsToMinutes(mins) {
  return String(mins ? mins % 60 : 0);
}

// due_date is stored as a plain "YYYY-MM-DD" string — parse/format using local
// date components (not UTC) so the picked day never shifts across timezones.
function parseDueDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDueDate(date) {
  if (!date) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function initForm(initial) {
  const rawType = initial?.activity_type || 'reading';
  const isCustom = initial && !BUILT_IN_ACTIVITY_TYPES.has(rawType);
  return {
    name:          initial?.name || '',
    course_id:     initial?.course_id || '',
    activity_type: isCustom ? '__custom__' : rawType,
    customType:    isCustom ? rawType : '',
    planned_hours:   minsToHours(initial?.planned_time),
    planned_minutes: minsToMinutes(initial?.planned_time),
    due_date:      parseDueDate(initial?.due_date),
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
    const { planned_hours, planned_minutes, ...rest } = form;
    try {
      await onSave({
        ...rest,
        activity_type: finalType,
        course_id:     form.course_id || null,
        planned_time:  (parseInt(planned_hours, 10) || 0) * 60 + (parseInt(planned_minutes, 10) || 0),
        due_date:      formatDueDate(form.due_date),
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
          <div className={styles.field}>
            <label htmlFor="task-hours">Planned time</label>
            <div className={styles.timeGroup}>
              <input
                id="task-hours"
                className={styles.timeHours}
                type="number"
                min="0"
                list="task-hours-options"
                placeholder="Hrs"
                value={form.planned_hours}
                onChange={e => set('planned_hours', e.target.value)}
                aria-label="Hours"
              />
              <datalist id="task-hours-options">
                <option value="0" />
                <option value="1" />
                <option value="2" />
                <option value="3" />
                <option value="4" />
                <option value="5" />
                <option value="6" />
                <option value="7" />
                <option value="8" />
                <option value="9" />
                <option value="10" />
              </datalist>
              <span className={styles.timeUnit}>h</span>
              <input
                id="task-minutes"
                className={styles.timeMinutes}
                type="number"
                min="0"
                max="59"
                list="task-minutes-options"
                placeholder="Min"
                value={form.planned_minutes}
                onChange={e => set('planned_minutes', e.target.value)}
                aria-label="Minutes"
              />
              <datalist id="task-minutes-options">
                <option value="0" />
                <option value="5" />
                <option value="10" />
                <option value="15" />
                <option value="20" />
                <option value="25" />
                <option value="30" />
                <option value="35" />
                <option value="40" />
                <option value="45" />
                <option value="50" />
                <option value="55" />
              </datalist>
              <span className={styles.timeUnit}>m</span>
            </div>
          </div>
          <DateTimePicker
            id="task-due"
            label="Due date (optional)"
            selected={form.due_date}
            onChange={date => set('due_date', date)}
            showTime={false}
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
