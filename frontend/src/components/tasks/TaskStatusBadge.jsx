import Badge from '../ui/Badge';

const STATUS_MAP = {
  pending: { label: 'Pending', type: 'other' },
  in_progress: { label: 'In Progress', type: 'practice' },
  completed: { label: 'Completed', type: 'reading' },
};

export default function TaskStatusBadge({ status }) {
  const { label, type } = STATUS_MAP[status] || STATUS_MAP.pending;
  return <Badge label={label} type={type} />;
}
