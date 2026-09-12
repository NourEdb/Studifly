import { useState } from 'react';
import toast from 'react-hot-toast';
import useTasks from '../hooks/useTasks';
import useSessions from '../hooks/useSessions';
import useEvents from '../hooks/useEvents';
import useStudyBlocks from '../hooks/useStudyBlocks';
import useCourses from '../hooks/useCourses';
import WeeklyPlanner from '../components/planner/WeeklyPlanner';
import MonthlyPlanner from '../components/planner/MonthlyPlanner';
import styles from './PlannerPage.module.css';

export default function PlannerPage() {
  const [view, setView] = useState('week');
  const { tasks, loading: tasksLoading, edit: editTask } = useTasks({ ignore_order: 1 });
  const { sessions, loading: sessionsLoading } = useSessions({ limit: 200 });
  const { events, loading: eventsLoading, addEvent, editEvent, removeEvent } = useEvents();
  const { blocks, loading: blocksLoading, add: addBlock, edit: editBlock, remove: removeBlock } = useStudyBlocks();
  const { courses, loading: coursesLoading } = useCourses();

  if (tasksLoading || sessionsLoading || eventsLoading || blocksLoading || coursesLoading) {
    return <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>;
  }

  async function handleAddBlock(data) {
    try { await addBlock(data); toast.success('Study block planned'); }
    catch { toast.error('Failed to save study block'); }
  }

  async function handleEditBlock(id, data) {
    try { await editBlock(id, data); toast.success('Study block updated'); }
    catch { toast.error('Failed to update study block'); }
  }

  async function handleDeleteBlock(id) {
    if (!confirm('Delete this study block?')) return;
    try { await removeBlock(id); toast.success('Study block deleted'); }
    catch { toast.error('Failed to delete study block'); }
  }

  return (
    <div className={styles.page}>
      <div className={styles.viewToggle}>
        <button
          className={[styles.viewBtn, view === 'week' && styles.viewBtnActive].filter(Boolean).join(' ')}
          onClick={() => setView('week')}
        >
          Week
        </button>
        <button
          className={[styles.viewBtn, view === 'month' && styles.viewBtnActive].filter(Boolean).join(' ')}
          onClick={() => setView('month')}
        >
          Month
        </button>
      </div>

      {view === 'week' ? (
        <WeeklyPlanner
          tasks={tasks}
          sessions={sessions}
          events={events}
          blocks={blocks}
          onAddBlock={handleAddBlock}
          onEditBlock={handleEditBlock}
          onDeleteBlock={handleDeleteBlock}
          onAddEvent={addEvent}
          onEditEvent={editEvent}
          onDeleteEvent={removeEvent}
        />
      ) : (
        <MonthlyPlanner
          tasks={tasks}
          events={events}
          courses={courses}
          editTask={editTask}
          onAddEvent={addEvent}
          onEditEvent={editEvent}
          onDeleteEvent={removeEvent}
        />
      )}
    </div>
  );
}
