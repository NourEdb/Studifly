import { format } from 'date-fns';
import Button from '../ui/Button';
import styles from './MonthNav.module.css';

export default function MonthNav({ monthCursor, onPrev, onNext, onToday }) {
  return (
    <div className={styles.nav}>
      <Button variant="secondary" size="sm" onClick={onPrev}>← Prev</Button>
      <span className={styles.label}>{format(monthCursor, 'MMMM yyyy')}</span>
      <Button variant="secondary" size="sm" onClick={onNext}>Next →</Button>
      <Button variant="secondary" size="sm" onClick={onToday}>Today</Button>
    </div>
  );
}
