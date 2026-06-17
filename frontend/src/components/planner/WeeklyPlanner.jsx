import { useState } from 'react';
import { startOfISOWeek, addDays, addWeeks, subWeeks } from 'date-fns';
import WeekNav from './WeekNav';
import PlannerDayColumn from './PlannerDayColumn';
import styles from './WeeklyPlanner.module.css';

export default function WeeklyPlanner({ tasks, sessions, events, onAddEvent, onEditEvent, onDeleteEvent }) {
  const [weekStart, setWeekStart] = useState(() => startOfISOWeek(new Date()));
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div>
      <div className={styles.header}>
        <WeekNav
          weekStart={weekStart}
          onPrev={() => setWeekStart(d => subWeeks(d, 1))}
          onNext={() => setWeekStart(d => addWeeks(d, 1))}
        />
      </div>
      <div className={styles.grid}>
        {days.map(date => (
          <PlannerDayColumn
            key={date.toISOString()}
            date={date}
            tasks={tasks}
            sessions={sessions}
            events={events}
            onAddEvent={onAddEvent}
            onEditEvent={onEditEvent}
            onDeleteEvent={onDeleteEvent}
          />
        ))}
      </div>
    </div>
  );
}
