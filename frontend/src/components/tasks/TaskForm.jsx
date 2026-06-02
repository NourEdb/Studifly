import { useState } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import styles from './TaskForm.module.css';

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

export default function TaskForm({ initial, courses, onSave, onClose }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    course_id: initial?.course_id || '',
    activity_type: initial?.activity_type || 'reading',
    planned_time: minsToHHMM(initial?.planned_time),
    due_date: initial?.due_date || '',
    status: initial?.status || 'pending',
  });
  const [loading, setLoading] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({
        ...form,
        course_id: form.course_id || null,
        planned_time: hhmmToMins(form.planned_time),
        due_date: form.due_date || null,
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
            {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>

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
          <div className={styles.field}>
            <label htmlFor="task-status">Status</label>
            <select id="task-status" value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
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
