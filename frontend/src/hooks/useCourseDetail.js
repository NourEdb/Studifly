import { useState, useEffect } from 'react';
import { getCourseDetail } from '../api/courses.api';

export default function useCourseDetail(courseId) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getCourseDetail(courseId)
      .then(setData)
      .catch(e => setError(e.message || 'Failed to load course detail'))
      .finally(() => setLoading(false));
  }, [courseId]);

  return { data, loading, error };
}
