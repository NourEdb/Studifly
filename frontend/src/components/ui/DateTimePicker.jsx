import { useEffect, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import styles from './DateTimePicker.module.css';

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia(`(max-width: ${breakpoint}px)`).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = e => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);

  return isMobile;
}

export default function DateTimePicker({
  id, label, selected, onChange, showTime = true,
  placeholder = showTime ? 'Select date & time' : 'Select date',
}) {
  const isMobile = useIsMobile();

  return (
    <div className={styles.field}>
      {label && <label htmlFor={id} className={styles.label}>{label}</label>}
      <DatePicker
        id={id}
        selected={selected}
        onChange={onChange}
        showTimeSelect={showTime}
        timeIntervals={5}
        timeCaption="Time"
        dateFormat={showTime ? 'MMM d, yyyy h:mm aa' : 'MMM d, yyyy'}
        placeholderText={placeholder}
        autoComplete="off"
        shouldCloseOnSelect={!showTime}
        className={styles.input}
        wrapperClassName={styles.wrapper}
        calendarClassName="dtp-calendar"
        popperClassName="dtp-popper"
        withPortal={isMobile}
        popperProps={{ strategy: 'fixed' }}
      />
    </div>
  );
}
