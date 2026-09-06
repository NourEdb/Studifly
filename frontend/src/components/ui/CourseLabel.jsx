import ColorDot from './ColorDot';
import styles from './CourseLabel.module.css';

export default function CourseLabel({ name, color }) {
  if (!name) return null;
  return (
    <span className={styles.label}>
      <ColorDot color={color} size={7} />
      {name}
    </span>
  );
}
