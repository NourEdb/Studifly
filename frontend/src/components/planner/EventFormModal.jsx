import { useState, useEffect } from 'react';
import { getCustomTypes } from '../../api/events.api';
import styles from './EventFormModal.module.css';

const BUILT_IN_TYPES = new Set(['exam', 'deadline', 'meeting', 'reminder', 'work', 'other']);

const TYPES = [
  { value: 'exam',     label: 'Exam' },
  { value: 'deadline', label: 'Deadline' },
  { value: 'meeting',  label: 'Meeting' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'work',     label: 'Work' },
  { value: 'other',    label: 'Other' },
];

function initForm(event) {
  if (!event) return { title: '', type: 'other', event_time: '', notes: '', customType: '' };
  const isCustom = !BUILT_IN_TYPES.has(event.type);
  return {
    title:      event.title,
    type:       isCustom ? '__custom__' : (event.type || 'other'),
    event_time: event.event_time || '',
    notes:      event.notes || '',
    customType: isCustom ? event.type : '',
  };
}

export default function EventFormModal({ date, event, onSave, onClose }) {
  const [form, setForm]               = useState(() => initForm(event));
  const [customTypes, setCustomTypes] = useState([]);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  useEffect(() => {
    getCustomTypes()
      .then(types => {
        setCustomTypes(types);
        // If editing a custom type that's now in the fetched list, select it directly
        // so the dropdown shows the type by name instead of staying on "Other (custom)…"
        setForm(prev => {
          if (prev.type === '__custom__' && types.includes(prev.customType)) {
            return { ...prev, type: prev.customType, customType: '' };
          }
          return prev;
        });
      })
      .catch(() => {});
  }, []);

  function set(field) {
    return e => setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required'); return; }

    const finalType = form.type === '__custom__'
      ? form.customType.trim()
      : form.type;
    if (!finalType) { setError('Please enter a custom event type'); return; }

    setSaving(true);
    setError('');
    try {
      await onSave({ ...form, type: finalType, event_date: date, title: form.title.trim() });
      onClose();
    } catch {
      setError('Failed to save event');
      setSaving(false);
    }
  }

  const isEditMode = Boolean(event);

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>{isEditMode ? 'Edit Event' : 'Add Event'} — {date}</h3>
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
              {customTypes.map(t => (
                <option key={`custom-${t}`} value={t}>{t}</option>
              ))}
              <option value="__custom__">Other (custom)…</option>
            </select>
          </label>

          {form.type === '__custom__' && (
            <label className={styles.label}>
              Custom type
              <input
                className={styles.input}
                value={form.customType}
                onChange={set('customType')}
                placeholder="e.g. Sport, Chores, Language…"
                maxLength={50}
                autoFocus
              />
            </label>
          )}

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
              {saving ? 'Saving…' : isEditMode ? 'Save Changes' : 'Add Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
