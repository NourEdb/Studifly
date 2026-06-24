import { useState } from 'react';
import toast from 'react-hot-toast';
import { submitCheckin } from '../../api/mood.api';
import styles from './MoodCheckinModal.module.css';

const MOOD_OPTIONS = [
  { emoji: '😞', label: 'Rough'     },
  { emoji: '😕', label: 'Low'       },
  { emoji: '😐', label: 'Okay'      },
  { emoji: '🙂', label: 'Good'      },
  { emoji: '😄', label: 'Great'     },
];

const ENERGY_OPTIONS = [
  { emoji: '😴', label: 'Drained'   },
  { emoji: '😑', label: 'Low'       },
  { emoji: '😐', label: 'Okay'      },
  { emoji: '⚡', label: 'Energized' },
  { emoji: '🔥', label: 'Pumped'    },
];

const SKIP_KEY = `studifly_mood_skip_${new Date().toISOString().slice(0, 10)}`;

export function markSkippedToday() {
  localStorage.setItem(SKIP_KEY, '1');
}

export function wasSkippedToday() {
  return !!localStorage.getItem(SKIP_KEY);
}

export default function MoodCheckinModal({ onClose }) {
  const [mood,       setMood]       = useState(null); // 1-5
  const [energy,     setEnergy]     = useState(null); // 1-5
  const [note,       setNote]       = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleSkip() {
    markSkippedToday();
    onClose();
  }

  async function handleSubmit() {
    if (!mood || !energy) {
      toast.error('Please select both mood and energy');
      return;
    }
    setSubmitting(true);
    try {
      await submitCheckin({ mood_score: mood, energy_score: energy, note: note.trim() || undefined });
      toast.success('Check-in saved! Keep it up 💪');
      onClose();
    } catch {
      toast.error('Failed to save check-in');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <p className={styles.title}>How are you feeling today? 🌟</p>
          <p className={styles.sub}>Quick check-in to track your wellbeing</p>
        </div>

        <div className={styles.body}>

          {/* Mood */}
          <div className={styles.pickerGroup}>
            <span className={styles.pickerLabel}>
              Mood
              {mood && <span className={styles.pickerSelected}>{MOOD_OPTIONS[mood - 1].label}</span>}
            </span>
            <div className={styles.emojiRow}>
              {MOOD_OPTIONS.map((opt, i) => (
                <button
                  key={i}
                  className={[styles.emojiBtn, mood === i + 1 && styles.emojiBtnActive].filter(Boolean).join(' ')}
                  onClick={() => setMood(i + 1)}
                  title={opt.label}
                  type="button"
                >
                  {opt.emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Energy */}
          <div className={styles.pickerGroup}>
            <span className={styles.pickerLabel}>
              Energy
              {energy && <span className={styles.pickerSelected}>{ENERGY_OPTIONS[energy - 1].label}</span>}
            </span>
            <div className={styles.emojiRow}>
              {ENERGY_OPTIONS.map((opt, i) => (
                <button
                  key={i}
                  className={[styles.emojiBtn, energy === i + 1 && styles.emojiBtnActive].filter(Boolean).join(' ')}
                  onClick={() => setEnergy(i + 1)}
                  title={opt.label}
                  type="button"
                >
                  {opt.emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <input
            className={styles.noteInput}
            type="text"
            placeholder="Any notes? (optional)"
            value={note}
            onChange={e => setNote(e.target.value)}
            maxLength={200}
          />

          {/* Actions */}
          <div className={styles.actions}>
            <button className={styles.btnSkip} type="button" onClick={handleSkip}>
              Skip for today
            </button>
            <button
              className={styles.btnSubmit}
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Saving…' : 'Check in'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
