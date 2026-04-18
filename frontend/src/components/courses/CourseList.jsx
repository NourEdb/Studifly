import { useState } from 'react';
import toast from 'react-hot-toast';
import CourseCard from './CourseCard';
import CourseForm from './CourseForm';
import Button from '../ui/Button';
import styles from './CourseList.module.css';

export default function CourseList({ courses, add, edit, remove }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  async function handleSave(data) {
    try {
      if (editing) {
        await edit(editing.id, data);
        toast.success('Course updated');
      } else {
        await add(data);
        toast.success('Course created');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save course');
      throw err;
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this course? Tasks will become uncategorized.')) return;
    try {
      await remove(id);
      toast.success('Course deleted');
    } catch {
      toast.error('Failed to delete course');
    }
  }

  return (
    <div>
      <div className={styles.header}>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>+ New Course</Button>
      </div>

      {courses.length === 0 ? (
        <div className={styles.empty}>
          <p>📚 No courses yet. Add your first one!</p>
        </div>
      ) : (
        <div className={styles.list}>
          {courses.map(c => (
            <CourseCard
              key={c.id}
              course={c}
              onEdit={course => { setEditing(course); setShowForm(true); }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {showForm && (
        <CourseForm
          initial={editing}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
