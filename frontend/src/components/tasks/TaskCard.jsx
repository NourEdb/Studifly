import Card from '../ui/Card';
import Badge from '../ui/Badge';
import ColorDot from '../ui/ColorDot';
import Button from '../ui/Button';
import TaskStatusBadge from './TaskStatusBadge';
import styles from './TaskCard.module.css';

export default function TaskCard({ task, onEdit, onDelete, onToggle, onStartTimer }) {
  const isOverdue = task.overdue;
  const dueLabel = task.due_date ? new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;
  const plannedH = task.planned_time ? `${Math.floor(task.planned_time / 60)}h ${task.planned_time % 60}m`.replace('0h ', '') : null;

  return (
    <Card className={[styles.card, isOverdue && styles.overdue, task.status === 'completed' && styles.done].filter(Boolean).join(' ')}>
      <div className={styles.top}>
        <button className={styles.check} onClick={() => onToggle(task.id, task.status)} title="Toggle complete">
          <span className={[styles.checkIcon, task.status === 'completed' && styles.checked].filter(Boolean).join(' ')}>
            {task.status === 'completed' ? '✓' : ''}
          </span>
        </button>
        <div className={styles.info}>
          <p className={styles.name}>{task.name}</p>
          <div className={styles.meta}>
            {task.course_name && (
              <span className={styles.course}>
                <ColorDot color={task.course_color} size={8} />
                {task.course_name}
              </span>
            )}
            <Badge label={task.activity_type} type={task.activity_type} />
            <TaskStatusBadge status={task.status} />
            {dueLabel && (
              <span className={[styles.due, isOverdue && styles.overdueDue].filter(Boolean).join(' ')}>
                {isOverdue ? '⚠ ' : '📅 '}{dueLabel}
              </span>
            )}
            {plannedH && <span className={styles.planned}>🎯 {plannedH}</span>}
          </div>
        </div>
        <div className={styles.actions}>
          {onStartTimer && task.status !== 'completed' && (
            <Button variant="ghost" size="sm" onClick={() => onStartTimer(task)}>▶ Start</Button>
          )}
          <Button variant="text" size="sm" onClick={() => onEdit(task)}>Edit</Button>
          <Button variant="danger" size="sm" onClick={() => onDelete(task.id)}>✕</Button>
        </div>
      </div>
    </Card>
  );
}
