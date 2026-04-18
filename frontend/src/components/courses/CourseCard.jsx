import Card from '../ui/Card';
import Button from '../ui/Button';
import ColorDot from '../ui/ColorDot';
import styles from './CourseCard.module.css';

export default function CourseCard({ course, onEdit, onDelete }) {
  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <div className={styles.name}>
          <ColorDot color={course.color} size={12} />
          <span>{course.name}</span>
        </div>
        <div className={styles.actions}>
          <Button variant="text" size="sm" onClick={() => onEdit(course)}>Edit</Button>
          <Button variant="danger" size="sm" onClick={() => onDelete(course.id)}>Delete</Button>
        </div>
      </div>
    </Card>
  );
}
