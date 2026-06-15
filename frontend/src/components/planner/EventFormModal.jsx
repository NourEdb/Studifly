import { useState } from 'react';
import styles from './EventFormModal.module.css';

const TYPES = [
  { value: 'exam',     label: 'Exam' },
  { value: 'deadline', label: 'Deadline' },
  { value: 'meeting',  label: 'Meeting' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'other',    label: 'Other' },
];

const EMPTY = { title: '', type: 'other', event_time: '', notes: '' };

export default function EventFormModal({ date, onSave, onClose }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(field) {
    return e => setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({ ...form, event_date: date, title: form.title.trim() });
      onClose();
    } catch {
      setError('Failed to save event');
      setSaving(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Add Event — {date}</h3>
          <button className={styles.close} onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>
            Title *
            <input
              className={styles.input}
              value={form.title}
              onChange={set('title')}
              placeholder="e.g. Final exam"
              autoFocus
            />
          </label>

          <label className={styles.label}>
            Type
            <select className={styles.input} value={form.type} onChange={set('type')}>
              {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>

          <label className={styles.label}>
            Time (optional)
            <input
              className={styles.input}
              type="time"
              lang="en"
              value={form.event_time}
              onChange={set('event_time')}
            />
          </label>

          <label className={styles.label}>
            Notes (optional)
            <textarea
              className={styles.textarea}
              value={form.notes}
              onChange={set('notes')}
              rows={3}
              placeholder="Any extra details…"
            />
          </label>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button type="button" className={styles.cancel} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.save} disabled={saving}>
              {saving ? 'Saving…' : 'Add Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
