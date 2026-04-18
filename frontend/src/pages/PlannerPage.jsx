import useTasks from '../hooks/useTasks';
import useSessions from '../hooks/useSessions';
import WeeklyPlanner from '../components/planner/WeeklyPlanner';

export default function PlannerPage() {
  const { tasks, loading: tasksLoading } = useTasks();
  const { sessions, loading: sessionsLoading } = useSessions({ limit: 200 });

  if (tasksLoading || sessionsLoading) return <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>;

  return <WeeklyPlanner tasks={tasks} sessions={sessions} />;
}
