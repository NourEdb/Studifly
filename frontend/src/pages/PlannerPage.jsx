import useTasks from '../hooks/useTasks';
import useSessions from '../hooks/useSessions';
import useEvents from '../hooks/useEvents';
import WeeklyPlanner from '../components/planner/WeeklyPlanner';

export default function PlannerPage() {
  const { tasks,    loading: tasksLoading    } = useTasks();
  const { sessions, loading: sessionsLoading } = useSessions({ limit: 200 });
  const { events,   loading: eventsLoading, addEvent, editEvent, removeEvent } = useEvents();

  if (tasksLoading || sessionsLoading || eventsLoading) {
    return <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>;
  }

  return (
    <WeeklyPlanner
      tasks={tasks}
      sessions={sessions}
      events={events}
      onAddEvent={addEvent}
      onEditEvent={editEvent}
      onDeleteEvent={removeEvent}
    />
  );
}
