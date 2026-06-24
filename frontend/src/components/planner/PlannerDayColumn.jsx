import { useState } from 'react';
import { format } from 'date-fns';
import ColorDot from '../ui/ColorDot';
import TaskStatusBadge from '../tasks/TaskStatusBadge';
import EventCard from './EventCard';
import EventFormModal from './EventFormModal';
import StudyBlockChip from './StudyBlockChip';
import StudyBlockForm from '../tasks/StudyBlockForm';
import styles from './PlannerDayColumn.module.css';

export default function PlannerDayColumn({
  date, tasks, sessions, events,
  blocks, onAddBlock, onEditBlock, onDeleteBlock,
  onAddEvent, onEditEvent, onDeleteEvent,
}) {
  const [showEventModal,  setShowEventModal]  = useState(false);
  const [editingEvent,    setEditingEvent]    = useState(null);
  const [showBlockModal,  setShowBlockModal]  = useState(false);
  const [editingBlock,    setEditingBlock]    = useState(null);

  const dayStr     = format(date, 'yyyy-MM-dd');
  const dayTasks   = tasks.filter(t => t.due_date === dayStr);
  const daySessions = sessions.filter(s => s.start_time?.startsWith(dayStr));
  const dayEvents  = events.filter(e => e.event_date === dayStr)
    .sort((a, b) => (a.event_time || '').localeCompare(b.event_time || ''));
  const dayBlocks  = (blocks || [])
    .filter(b => b.plan_date === dayStr)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const actualSeconds = daySessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  const plannedMin    = dayTasks.reduce((sum, t) => sum + (t.planned_time || 0), 0);
  const isToday = format(new Date(), 'yyyy-MM-dd') === dayStr;

  const isEmpty = dayEvents.length === 0 && dayTasks.length === 0 && dayBlocks.length === 0;

  async function handleSaveBlock(data) {
    if (editingBlock) {
      await onEditBlock(editingBlock.id, data);
    } else {
      await onAddBlock(data);
    }
  }

  function openEditBlock(block) {
    setEditingBlock(block);
    setShowBlockModal(true);
  }

  function closeBlockModal() {
    setShowBlockModal(false);
    setEditingBlock(null);
  }

  return (
    <>
      <div className={[styles.col, isToday && styles.today].filter(Boolean).join(' ')}>
        <div className={styles.header}>
          {onAddBlock && (
            <button
              className={[styles.addBtn, styles.addBlockBtn].join(' ')}
              onClick={() => setShowBlockModal(true)}
              title="Plan study block"
            >＋</button>
          )}
          <p className={styles.dayName}>{format(date, 'EEE')}</p>
          <p className={styles.dayNum}>{format(date, 'd')}</p>
          <button className={styles.addBtn} onClick={() => setShowEventModal(true)} title="Add event">+</button>
        </div>

        <div className={styles.body}>
          {dayEvents.map(ev => (
            <EventCard key={`ev-${ev.id}`} event={ev} onEdit={setEditingEvent} onDelete={onDeleteEvent} />
          ))}

          {dayBlocks.map(b => (
            <StudyBlockChip
              key={`blk-${b.id}`}
              block={b}
              onEdit={openEditBlock}
              onDelete={onDeleteBlock}
            />
          ))}

          {isEmpty ? (
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

      {showEventModal && (
        <EventFormModal
          date={dayStr}
          onSave={onAddEvent}
          onClose={() => setShowEventModal(false)}
        />
      )}
      {editingEvent && (
        <EventFormModal
          date={editingEvent.event_date}
          event={editingEvent}
          onSave={data => onEditEvent(editingEvent.id, data)}
          onClose={() => setEditingEvent(null)}
        />
      )}

      {showBlockModal && (
        <StudyBlockForm
          tasks={tasks}
          block={editingBlock}
          defaultDate={dayStr}
          onSave={handleSaveBlock}
          onClose={closeBlockModal}
        />
      )}
    </>
  );
}
