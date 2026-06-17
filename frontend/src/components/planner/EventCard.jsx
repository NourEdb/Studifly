import styles from './EventCard.module.css';

const TYPE_COLORS = {
  exam:     '#E85454',
  deadline: '#F5A623',
  meeting:  '#4A9FE0',
  reminder: '#34C68A',
  work:     '#A259FF',
  other:    '#7B7A99',
};

export default function EventCard({ event, onEdit, onDelete }) {
  const color = TYPE_COLORS[event.type] || TYPE_COLORS.other;

  return (
    <div className={styles.card} style={{ '--event-color': color }}>
      <span className={styles.dot} />
      <div className={styles.body}>
        <span className={styles.title}>{event.title}</span>
        {event.event_time && <span className={styles.time}>{event.event_time}</span>}
      </div>
      <button
        className={styles.edit}
        onClick={() => onEdit(event)}
        aria-label="Edit event"
      >✎</button>
      <button
        className={styles.del}
        onClick={() => onDelete(event.id)}
        aria-label="Delete event"
      >×</button>
    </div>
  );
}
