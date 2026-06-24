import toast from 'react-hot-toast';
import useTasks from '../hooks/useTasks';
import useSessions from '../hooks/useSessions';
import useEvents from '../hooks/useEvents';
import useStudyBlocks from '../hooks/useStudyBlocks';
import WeeklyPlanner from '../components/planner/WeeklyPlanner';

export default function PlannerPage() {
  const { tasks,    loading: tasksLoading    } = useTasks();
  const { sessions, loading: sessionsLoading } = useSessions({ limit: 200 });
  const { events,   loading: eventsLoading, addEvent, editEvent, removeEvent } = useEvents();
  const { blocks,   loading: blocksLoading, add: addBlock, edit: editBlock, remove: removeBlock } = useStudyBlocks();

  if (tasksLoading || sessionsLoading || eventsLoading || blocksLoading) {
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
  );
}
