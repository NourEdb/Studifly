import { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { reflectSession } from '../../api/sessions.api';
import styles from './PostSessionModal.module.css';

const STAR_LABELS = { focus: 'Focus level', difficulty: 'Difficulty' };

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

export default function PostSessionModal({ session, onClose, onDone }) {
  const [completion, setCompletion] = useState(null);
  const [markDone, setMarkDone]     = useState(false);
  const [extraTime, setExtraTime]   = useState('');
  const [notes, setNotes]           = useState('');
  const [focus, setFocus]           = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [saving, setSaving]         = useState(false);

  async function handleSubmit(continueSession = false) {
    setSaving(true);
    try {
      await reflectSession(session.id, {
        completion_answer:        completion,
        notes:                    notes || null,
        focus_score:              focus,
        difficulty_rating:        difficulty,
        estimated_extra_minutes:  extraTime ? parseInt(extraTime) : null,
        task_marked_done:         markDone ? 1 : 0,
        resume_later:             continueSession,
      });
      toast.success('Reflection saved');
      onDone?.({ continueSession });
    } catch {
      toast.error('Failed to save reflection');
    } finally {
      setSaving(false);
    }
  }

  async function handleSkip() {
    onClose();
  }

  return (
    <Modal title="How did that session go?" onClose={handleSkip} size="md">
      <div className={styles.body}>

        <div className={styles.section}>
          <p className={styles.question}>Did you complete the task?</p>
          <div className={styles.chips}>
            {[
              { value: 'yes',       label: 'Yes!' },
              { value: 'partially', label: 'Partially' },
              { value: 'no',        label: 'Not really' },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                className={[styles.chip, completion === opt.value ? styles.chipActive : ''].join(' ')}
                onClick={() => { setCompletion(opt.value); setMarkDone(false); }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {completion === 'yes' && session?.task_id && (
          <div className={styles.section}>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={markDone} onChange={e => setMarkDone(e.target.checked)} />
              <span>Mark task as completed in my task list</span>
            </label>
          </div>
        )}

        {(completion === 'partially' || completion === 'no') && (
          <div className={styles.section}>
            <label className={styles.fieldLabel}>How much more time do you estimate you need? (minutes)</label>
            <input
              type="number"
              min="1"
              max="480"
              className={styles.input}
              placeholder="e.g. 30"
              value={extraTime}
              onChange={e => setExtraTime(e.target.value)}
            />
          </div>
        )}

        <div className={styles.ratingsRow}>
          <StarRating label={STAR_LABELS.focus}      value={focus}      onChange={setFocus} />
          <StarRating label={STAR_LABELS.difficulty} value={difficulty} onChange={setDifficulty} />
        </div>

        <div className={styles.section}>
          <label className={styles.fieldLabel}>Notes (optional)</label>
          <textarea
            className={styles.textarea}
            rows={3}
            placeholder="Anything worth noting about this session…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        <div className={styles.actions}>
          <Button variant="ghost" onClick={handleSkip} disabled={saving}>Skip</Button>
          {(completion === 'partially' || completion === 'no') && (
            <Button variant="secondary" onClick={() => handleSubmit(true)} disabled={saving}>
              To be continued
            </Button>
          )}
          <Button onClick={() => handleSubmit(false)} disabled={saving}>
            {saving ? 'Saving…' : 'Save Reflection'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
