import { useState } from 'react';
import useTimer from '../../hooks/useTimer';
import TimerDisplay from './TimerDisplay';
import PostSessionModal from './PostSessionModal';
import Button from '../ui/Button';
import styles from './TimerWidget.module.css';

function fmtDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function TimerWidget({ tasks, onSessionSaved }) {
  const [selectedTask, setSelectedTask]     = useState('');
  const [stoppedSession, setStoppedSession] = useState(null);
  const { elapsedSeconds, isRunning, activeSession, taskTotalSeconds, handleStart, handleStop } = useTimer();

  async function start() {
    const task = tasks.find(t => t.id === parseInt(selectedTask));
    await handleStart(selectedTask ? parseInt(selectedTask) : null, task?.name || 'Untitled session');
  }

  async function stop() {
    const session = await handleStop();
    if (session) setStoppedSession(session);
  }

  function handleReflectionDone() {
    setStoppedSession(null);
    onSessionSaved?.();
  }

  return (
    <>
      <div className={styles.widget}>
        <div className={styles.displayWrapper}>
          <TimerDisplay seconds={elapsedSeconds} />
          {isRunning && activeSession?.taskName && (
            <p className={styles.taskLabel}>📌 {activeSession.taskName}</p>
          )}
          {isRunning && taskTotalSeconds && (
            <p className={styles.taskTotal}>
              Total time on this task: {fmtDuration(taskTotalSeconds)}
            </p>
          )}
        </div>

        {!isRunning ? (
          <div className={styles.controls}>
            <div className={styles.field}>
              <label>Select task (optional)</label>
              <select value={selectedTask} onChange={e => setSelectedTask(e.target.value)}>
                <option value="">— No specific task —</option>
                {tasks.filter(t => t.status !== 'completed').map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <Button onClick={start} size="lg" fullWidth>▶ Start Timer</Button>
          </div>
        ) : (
          <Button onClick={stop} variant="danger" size="lg" fullWidth>■ Stop &amp; Save</Button>
        )}
      </div>

      {stoppedSession && (
        <PostSessionModal
          session={stoppedSession}
          onClose={() => { setStoppedSession(null); onSessionSaved?.(); }}
          onDone={handleReflectionDone}
        />
      )}
    </>
  );
}
