import { useState } from 'react';
import styles from './StudyBlockForm.module.css';

function initForm(block, defaultDate) {
  if (!block) return { plan_date: defaultDate || '', start_time: '', end_time: '', topic: '' };
  return {
    plan_date:  block.plan_date  || defaultDate || '',
    start_time: block.start_time || '',
    end_time:   block.end_time   || '',
    topic:      block.topic      || '',
  };
}

// task        — pre-selected task (from TaskCard flow). When provided, hides task picker.
// tasks       — full list (from Planner flow). When provided, shows task dropdown.
// block       — existing block for edit mode.
// defaultDate — pre-fills date (from Planner "＋" button).
export default function StudyBlockForm({ task, tasks, block, defaultDate, onSave, onClose }) {
  const [form, setForm]           = useState(() => initForm(block, defaultDate));
  const [selectedTaskId, setSelectedTaskId] = useState(block?.task_id ?? task?.id ?? '');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  const isEdit      = Boolean(block);
  const usePicker   = !task && Array.isArray(tasks);
  const resolvedTask = task || (usePicker ? tasks.find(t => t.id === Number(selectedTaskId)) : null);

  function set(field) {
    return e => setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (usePicker && !selectedTaskId) { setError('Please select a task');        return; }
    if (!form.plan_date)              { setError('Date is required');             return; }
    if (!form.start_time)             { setError('Start time is required');       return; }
    if (!form.end_time)               { setError('End time is required');         return; }
    if (form.end_time <= form.start_time) { setError('End time must be after start time'); return; }

    setSaving(true);
    setError('');
    try {
      await onSave({
        task_id:    Number(selectedTaskId) || task.id,
        plan_date:  form.plan_date,
        start_time: form.start_time,
        end_time:   form.end_time,
        topic:      form.topic.trim() || null,
      });
      onClose();
    } catch {
      setError('Failed to save study block');
      setSaving(false);
    }
  }

  const headerSubtitle = usePicker
    ? (resolvedTask ? resolvedTask.name : 'Select a task below')
    : task?.name;

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div>
            <h3 className={styles.modalTitle}>{isEdit ? 'Edit Study Block' : 'Plan Study Block'}</h3>
            {headerSubtitle && <p className={styles.taskName}>{headerSubtitle}</p>}
          </div>
          <button className={styles.close} onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {usePicker && (
            <label className={styles.label}>
              Task *
              <select
                className={styles.input}
                value={selectedTaskId}
                onChange={e => setSelectedTaskId(e.target.value)}
                autoFocus
              >
                <option value="">— choose a task —</option>
                {tasks.filter(t => t.status !== 'completed').map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
          )}

          <label className={styles.label}>
            Date *
            <input
              className={styles.input}
              type="date"
              value={form.plan_date}
              onChange={set('plan_date')}
              autoFocus={!usePicker}
            />
          </label>

          <div className={styles.row}>
            <label className={styles.label}>
              Start time *
              <input
                className={styles.input}
                type="time"
                value={form.start_time}
                onChange={set('start_time')}
              />
            </label>
            <label className={styles.label}>
              End time *
              <input
                className={styles.input}
                type="time"
                value={form.end_time}
                onChange={set('end_time')}
              />
            </label>
          </div>

          <label className={styles.label}>
            What to cover (optional)
            <input
              className={styles.input}
              value={form.topic}
              onChange={set('topic')}
              placeholder="e.g. Chapter 3 + practice problems"
              maxLength={200}
            />
          </label>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button type="button" className={styles.cancel} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.save} disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Block'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
