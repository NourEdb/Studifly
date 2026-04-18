import Card from '../components/ui/Card';
import TimerWidget from '../components/timer/TimerWidget';
import ManualEntryForm from '../components/timer/ManualEntryForm';
import useTasks from '../hooks/useTasks';
import useSessions from '../hooks/useSessions';
import styles from './TrackerPage.module.css';

function fmtDuration(seconds) {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function TrackerPage() {
  const { tasks } = useTasks();
  const { sessions, loading, refresh } = useSessions({ limit: 50 });

  return (
    <div className={styles.page}>
      <div className={styles.left}>
        <Card>
          <TimerWidget tasks={tasks} onSessionSaved={refresh} />
        </Card>
        <Card>
          <ManualEntryForm tasks={tasks} onSaved={refresh} />
        </Card>
      </div>

      <div className={styles.right}>
        <h2 className={styles.historyTitle}>Recent Sessions</h2>
        {loading ? <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p> : (
          sessions.length === 0 ? (
            <p className={styles.empty}>No sessions yet. Start studying!</p>
          ) : (
            <div className={styles.sessionList}>
              {sessions.map(s => (
                <div key={s.id} className={styles.session}>
                  <div className={styles.sessionMeta}>
                    <span className={styles.sessionDate}>{fmtDate(s.start_time)}</span>
                    <span className={styles.sessionTime}>{fmtTime(s.start_time)} – {fmtTime(s.end_time)}</span>
                    {s.is_manual === 1 && <span className={styles.manual}>manual</span>}
                  </div>
                  <div className={styles.sessionInfo}>
                    <span className={styles.sessionTask}>{s.task_name || 'No task'}</span>
                    <span className={styles.sessionDuration}>{fmtDuration(s.duration)}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
