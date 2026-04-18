import { format, startOfISOWeek, endOfISOWeek, addWeeks } from 'date-fns';
import Button from '../ui/Button';
import styles from './WeekNav.module.css';

export default function WeekNav({ weekStart, onPrev, onNext }) {
  const end = endOfISOWeek(weekStart);
  const label = `${format(weekStart, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
  return (
    <div className={styles.nav}>
      <Button variant="secondary" size="sm" onClick={onPrev}>← Prev</Button>
      <span className={styles.label}>{label}</span>
      <Button variant="secondary" size="sm" onClick={onNext}>Next →</Button>
    </div>
  );
}
