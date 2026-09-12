import Badge from '../ui/Badge';

const CATEGORY_MAP = {
  exam:     { label: 'Exam',     type: 'cat_exam' },
  homework: { label: 'Homework', type: 'cat_homework' },
  project:  { label: 'Project',  type: 'cat_project' },
  other:    { label: 'Other',    type: 'cat_other' },
};

export default function CategoryBadge({ category }) {
  const { label, type } = CATEGORY_MAP[category] || CATEGORY_MAP.other;
  return <Badge label={label} type={type} />;
}
