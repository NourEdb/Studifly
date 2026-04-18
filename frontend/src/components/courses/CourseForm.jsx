import { useState } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import styles from './CourseForm.module.css';

const COLORS = ['#6C4DC4', '#4A9FE0', '#E87AB0', '#F5C842', '#34C68A', '#F5A623', '#E85454', '#7B5EA7'];

export default function CourseForm({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial?.name || '');
  const [color, setColor] = useState(initial?.color || '#6C4DC4');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({ name, color });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={initial ? 'Edit Course' : 'New Course'} onClose={onClose} size="sm">
      <form onSubmit={handleSubmit} className={styles.form}>
        <Input
          id="course-name"
          label="Course name"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          autoFocus
        />
        <div>
          <p className={styles.colorLabel}>Color</p>
          <div className={styles.swatches}>
            {COLORS.map(c => (
              <button
                key={c}
                type="button"
                className={[styles.swatch, color === c && styles.selected].filter(Boolean).join(' ')}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>
        <div className={styles.actions}>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={loading || !name.trim()}>
            {loading ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
