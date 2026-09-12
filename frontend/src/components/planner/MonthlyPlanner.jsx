import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, addMonths, subMonths, isSameMonth, isToday, isSameDay,
} from 'date-fns';
import ColorDot from '../ui/ColorDot';
import Badge from '../ui/Badge';
import CategoryBadge from '../tasks/CategoryBadge';
import TaskForm from '../tasks/TaskForm';
import EventFormModal from './EventFormModal';
import MonthNav from './MonthNav';
import { fmtTime24 } from '../../utils/formatTime';
import styles from './MonthlyPlanner.module.css';

// Mirrors EventCard.jsx's palette so an event looks the same color here as
// it does in the weekly planner.
const EVENT_TYPE_COLORS = {
  exam: '#E85454', deadline: '#F5A623', meeting: '#4A9FE0',
  reminder: '#34C68A', work: '#A259FF', personal: '#9AA0AE', other: '#7B7A99',
};

// "exam" and "other" are shared with tasks.category on purpose, so this one
// filter matches both kinds of item; "events" shows every event regardless
// of type, as a way to see the full event list irrespective of category.
const FILTERS = [
  { value: 'all',      label: 'All' },
  { value: 'exam',     label: 'Exam' },
  { value: 'homework', label: 'Homework' },
  { value: 'project',  label: 'Project' },
  { value: 'other',    label: 'Other' },
  { value: 'events',   label: 'Events' },
];

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function MonthlyPlanner({ tasks, events, courses, editTask, onAddEvent, onEditEvent, onDeleteEvent }) {
  const [monthCursor,    setMonthCursor]    = useState(() => startOfMonth(new Date()));
  const [selectedDate,   setSelectedDate]   = useState(() => new Date());
  const [filter,         setFilter]         = useState('all');
  const [showPersonal,   setShowPersonal]   = useState(false);
  const [editingTask,    setEditingTask]    = useState(null);
  const [editingEvent,   setEditingEvent]   = useState(null);
  const [addingEventFor, setAddingEventFor] = useState(null);

  const gridStart = startOfWeek(monthCursor, { weekStartsOn: 0 });
  const gridEnd   = endOfWeek(endOfMonth(monthCursor), { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  function eventVisible(e) {
    if (e.type === 'personal' && !showPersonal) return false;
    if (filter === 'all' || filter === 'events') return true;
    return e.type === filter;
  }

  function taskVisible(t) {
    if (filter === 'all') return true;
    if (filter === 'events') return false;
    return (t.category || 'other') === filter;
  }

  function itemsForDate(date) {
    const dayStr = format(date, 'yyyy-MM-dd');
    const dayTasks = tasks
      .filter(t => t.due_date === dayStr && taskVisible(t))
      .map(t => ({ kind: 'task', key: `t-${t.id}`, sortKey: `0${t.name}`, data: t }));
    const dayEvents = events
      .filter(e => e.event_date === dayStr && eventVisible(e))
      .map(e => ({ kind: 'event', key: `e-${e.id}`, sortKey: `1${e.event_time || '99:99'}`, data: e }));
    return [...dayTasks, ...dayEvents].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }

  function openItem(item) {
    if (item.kind === 'task') setEditingTask(item.data);
    else setEditingEvent(item.data);
  }

  async function handleSaveTask(data) {
    try {
      await editTask(editingTask.id, data);
      toast.success('Task updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update task');
      throw err;
    }
  }

  const selectedDayStr = format(selectedDate, 'yyyy-MM-dd');
  const selectedItems  = itemsForDate(selectedDate);

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <MonthNav
          monthCursor={monthCursor}
          onPrev={() => setMonthCursor(d => subMonths(d, 1))}
          onNext={() => setMonthCursor(d => addMonths(d, 1))}
          onToday={() => { const now = new Date(); setMonthCursor(startOfMonth(now)); setSelectedDate(now); }}
        />
        <div className={styles.controls}>
          <select className={styles.filterSelect} value={filter} onChange={e => setFilter(e.target.value)}>
            {FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <label className={styles.personalToggle}>
            <input type="checkbox" checked={showPersonal} onChange={e => setShowPersonal(e.target.checked)} />
            Show personal
          </label>
        </div>
      </div>

      <div className={styles.weekdays}>
        {WEEKDAY_LABELS.map(d => <div key={d} className={styles.weekdayLabel}>{d}</div>)}
      </div>

      <div className={styles.grid}>
        {days.map(date => {
          const dayStr    = format(date, 'yyyy-MM-dd');
          const items     = itemsForDate(date);
          const isOutside = !isSameMonth(date, monthCursor);

          return (
            <button
              type="button"
              key={dayStr}
              className={[
                styles.cell,
                isOutside && styles.outside,
                isToday(date) && styles.today,
                isSameDay(date, selectedDate) && styles.selected,
              ].filter(Boolean).join(' ')}
              onClick={() => setSelectedDate(date)}
            >
              <span className={styles.dayNum}>{format(date, 'd')}</span>
              <div className={styles.chips}>
                {items.slice(0, 3).map(item => (
                  <span
                    key={item.key}
                    className={styles.chip}
                    style={{ '--chip-color': item.kind === 'task' ? (item.data.course_color || 'var(--color-purple)') : (EVENT_TYPE_COLORS[item.data.type] || EVENT_TYPE_COLORS.other) }}
                    onClick={e => { e.stopPropagation(); setSelectedDate(date); openItem(item); }}
                  >
                    <span className={styles.chipDot} />
                    <span className={styles.chipLabel}>
                      {item.kind === 'task' && item.data.overdue ? '⚠ ' : ''}
                      {item.kind === 'task' ? item.data.name : item.data.title}
                    </span>
                  </span>
                ))}
                {items.length > 3 && <span className={styles.moreLabel}>+{items.length - 3} more</span>}
              </div>
            </button>
          );
        })}
      </div>

      <div className={styles.dayDetail}>
        <div className={styles.dayDetailHeader}>
          <h3 className={styles.dayDetailTitle}>{format(selectedDate, 'EEEE, MMM d')}</h3>
          <button type="button" className={styles.addEventBtn} onClick={() => setAddingEventFor(selectedDayStr)}>+ Add event</button>
        </div>
        {selectedItems.length === 0 ? (
          <p className={styles.emptyText}>Nothing here.</p>
        ) : (
          <div className={styles.dayDetailList}>
            {selectedItems.map(item => (
              <div key={item.key} className={styles.detailRow}>
                <button type="button" className={styles.detailMain} onClick={() => openItem(item)}>
                  {item.kind === 'task' ? (
                    <>
                      <ColorDot color={item.data.course_color} size={9} />
                      <span className={styles.detailName}>{item.data.name}</span>
                      <CategoryBadge category={item.data.category} />
                      {item.data.overdue && <Badge label="Overdue" type="cat_exam" />}
                    </>
                  ) : (
                    <>
                      <span className={styles.detailDot} style={{ background: EVENT_TYPE_COLORS[item.data.type] || EVENT_TYPE_COLORS.other }} />
                      <span className={styles.detailName}>{item.data.title}</span>
                      {item.data.event_time && <span className={styles.detailTime}>{fmtTime24(item.data.event_time)}</span>}
                    </>
                  )}
                </button>
                {item.kind === 'event' && (
                  <button
                    type="button"
                    className={styles.detailDelete}
                    onClick={() => onDeleteEvent(item.data.id)}
                    aria-label="Delete event"
                    title="Delete event"
                  >×</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {editingTask && (
        <TaskForm
          initial={editingTask}
          courses={courses}
          onSave={handleSaveTask}
          onClose={() => setEditingTask(null)}
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

      {addingEventFor && (
        <EventFormModal
          date={addingEventFor}
          onSave={onAddEvent}
          onClose={() => setAddingEventFor(null)}
        />
      )}
    </div>
  );
}
