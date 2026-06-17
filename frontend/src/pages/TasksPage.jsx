import { useState } from 'react';
import useTasks from '../hooks/useTasks';
import useCourses from '../hooks/useCourses';
import TaskList from '../components/tasks/TaskList';

export default function TasksPage() {
  const [filters, setFilters] = useState({});
  const { tasks, loading, add, edit, remove } = useTasks(filters);
  const { courses } = useCourses();

  if (loading) return <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>;

  return (
    <TaskList
      tasks={tasks}
      courses={courses}
      add={add}
      edit={edit}
      remove={remove}
      filters={filters}
      setFilters={setFilters}
    />
  );
}
