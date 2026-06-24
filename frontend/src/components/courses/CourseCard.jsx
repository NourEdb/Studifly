import { useState } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import ColorDot from '../ui/ColorDot';
import CourseDetailPanel from './CourseDetailPanel';
import styles from './CourseCard.module.css';

export default function CourseCard({ course, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <button className={styles.nameBtn} onClick={() => setExpanded(e => !e)}>
          <ColorDot color={course.color} size={12} />
          <span className={styles.nameText}>{course.name}</span>
          <span className={[styles.chevron, expanded && styles.open].filter(Boolean).join(' ')}>›</span>
        </button>
        <div className={styles.actions}>
          <Button variant="text" size="sm" onClick={() => onEdit(course)}>Edit</Button>
          <Button variant="danger" size="sm" onClick={() => onDelete(course.id)}>Delete</Button>
        </div>
      </div>

      {expanded && (
        <CourseDetailPanel courseId={course.id} courseName={course.name} />
      )}
    </Card>
  );
}
