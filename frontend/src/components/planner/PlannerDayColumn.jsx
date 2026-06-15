import { useState } from 'react';
import { format } from 'date-fns';
import ColorDot from '../ui/ColorDot';
import TaskStatusBadge from '../tasks/TaskStatusBadge';
import EventCard from './EventCard';
import EventFormModal from './EventFormModal';
import styles from './PlannerDayColumn.module.css';

export default function PlannerDayColumn({ date, tasks, sessions, events, onAddEvent, onDeleteEvent }) {
  const [showModal, setShowModal] = useState(false);
  const dayStr = format(date, 'yyyy-MM-dd');
  const dayTasks    = tasks.filter(t => t.due_date === dayStr);
  const daySessions = sessions.filter(s => s.start_time?.startsWith(dayStr));
  const dayEvents   = events.filter(e => e.event_date === dayStr)
    .sort((a, b) => (a.event_time || '').localeCompare(b.event_time || ''));

  const actualSeconds = daySessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  const plannedMin    = dayTasks.reduce((sum, t) => sum + (t.planned_time || 0), 0);
  const isToday = format(new Date(), 'yyyy-MM-dd') === dayStr;

  return (
    <>
      <div className={[styles.col, isToday && styles.today].filter(Boolean).join(' ')}>
        <div className={styles.header}>
          <p className={styles.dayName}>{format(date, 'EEE')}</p>
          <p className={styles.dayNum}>{format(date, 'd')}</p>
          <button className={styles.addBtn} onClick={() => setShowModal(true)} title="Add event">+</button>
        </div>
        <div className={styles.body}>
          {dayEvents.map(ev => (
            <EventCard key={`ev-${ev.id}`} event={ev} onDelete={onDeleteEvent} />
          ))}
          {dayTasks.length === 0 && dayEvents.length === 0 ? (
            <p className={styles.noTasks}>—</p>
          ) : (
            dayTasks.map(t => (
              <div key={t.id} className={styles.taskItem}>
                <div className={styles.taskTop}>
                  {t.course_color && <ColorDot color={t.course_color} size={8} />}
                  <span className={styles.taskName}>{t.name}</span>
                </div>
                <TaskStatusBadge status={t.status} />
              </div>
            ))
          )}
        </div>
        <div className={styles.footer}>
          {plannedMin > 0 && <span className={styles.planned}>📋 {plannedMin}m planned</span>}
          {actualSeconds > 0 && <span className={styles.actual}>⏱ {Math.round(actualSeconds / 60)}m actual</span>}
        </div>
      </div>

      {showModal && (
        <EventFormModal
          date={dayStr}
          onSave={onAddEvent}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
