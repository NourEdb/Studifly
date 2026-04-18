import { useState, useEffect, useCallback } from 'react';
import { getCourses, createCourse, updateCourse, deleteCourse } from '../api/courses.api';
import toast from 'react-hot-toast';

export default function useCourses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      const data = await getCourses();
      setCourses(data);
    } catch {
      toast.error('Failed to load courses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  async function add(data) {
    const course = await createCourse(data);
    setCourses(prev => [course, ...prev]);
    return course;
  }

  async function edit(id, data) {
    const course = await updateCourse(id, data);
    setCourses(prev => prev.map(c => c.id === id ? course : c));
    return course;
  }

  async function remove(id) {
    await deleteCourse(id);
    setCourses(prev => prev.filter(c => c.id !== id));
  }

  return { courses, loading, add, edit, remove, refresh: fetch };
}
