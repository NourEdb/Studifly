import useCourses from '../hooks/useCourses';
import CourseList from '../components/courses/CourseList';

export default function CoursesPage() {
  const { courses, loading, add, edit, remove } = useCourses();
  if (loading) return <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>;
  return <CourseList courses={courses} add={add} edit={edit} remove={remove} />;
}
