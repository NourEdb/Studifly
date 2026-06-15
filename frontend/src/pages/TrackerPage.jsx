import { useState } from 'react';
import Card from '../components/ui/Card';
import TimerWidget from '../components/timer/TimerWidget';
import ManualEntryForm from '../components/timer/ManualEntryForm';
import useTasks from '../hooks/useTasks';
import useSessions from '../hooks/useSessions';
import { deleteSession } from '../api/sessions.api';
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
  const { sessions, loading, remove, refresh } = useSessions({ limit: 50 });
  const [cleaningUp, setCleaningUp] = useState(false);

  const incompleteSessions = sessions.filter(s => !s.end_time || !s.duration || s.duration === 0);

  async function handleDelete(id) {
    if (!window.confirm('Delete this session? This cannot be undone.')) return;
    await remove(id);
  }

  async function handleCleanUp() {
    if (incompleteSessions.length === 0) return;
    const confirmed = window.confirm(
      `Remove ${incompleteSessions.length} incomplete session${incompleteSessions.length === 1 ? '' : 's'} (no end time or zero duration)?`
    );
    if (!confirmed) return;
    setCleaningUp(true);
    try {
      await Promise.all(incompleteSessions.map(s => deleteSession(s.id)));
      await refresh();
    } finally {
      setCleaningUp(false);
    }
  }

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
        <div className={styles.historyHeader}>
          <h2 className={styles.historyTitle}>Recent Sessions</h2>
          {incompleteSessions.length > 0 && (
            <button
              className={styles.cleanupBtn}
              onClick={handleCleanUp}
              disabled={cleaningUp}
              title={`${incompleteSessions.length} incomplete session${incompleteSessions.length === 1 ? '' : 's'}`}
            >
              🗑 Clean up ({incompleteSessions.length})
            </button>
          )}
        </div>

        {loading ? <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p> : (
          sessions.length === 0 ? (
            <p className={styles.empty}>No sessions yet. Start studying!</p>
          ) : (
            <div className={styles.sessionList}>
              {sessions.map(s => {
                const incomplete = !s.end_time || !s.duration || s.duration === 0;
                return (
                  <div key={s.id} className={[styles.session, incomplete && styles.incomplete].filter(Boolean).join(' ')}>
                    <div className={styles.sessionMeta}>
                      <span className={styles.sessionDate}>{fmtDate(s.start_time)}</span>
                      <span className={styles.sessionTime}>{fmtTime(s.start_time)} – {fmtTime(s.end_time)}</span>
                      {s.is_manual === 1 && <span className={styles.manual}>manual</span>}
                      {incomplete && <span className={styles.incompleteTag}>incomplete</span>}
                    </div>
                    <div className={styles.sessionInfo}>
                      <span className={styles.sessionTask}>{s.task_name || 'No task'}</span>
                      <span className={styles.sessionDuration}>{fmtDuration(s.duration)}</span>
                    </div>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => handleDelete(s.id)}
                      aria-label="Delete session"
                      title="Delete session"
                    >×</button>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}
