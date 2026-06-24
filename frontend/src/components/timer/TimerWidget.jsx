import { useState, useEffect, useRef } from 'react';
import useTimer from '../../hooks/useTimer';
import TimerDisplay from './TimerDisplay';
import PostSessionModal from './PostSessionModal';
import Button from '../ui/Button';
import styles from './TimerWidget.module.css';

const WORK_SECS = 25 * 60;
const BREAK_SECS = 5 * 60;

function requestNotifPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function sendNotif(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

function fmtDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function TimerWidget({ tasks, onSessionSaved }) {
  const [selectedTask, setSelectedTask]     = useState('');
  const [stoppedSession, setStoppedSession] = useState(null);
  const { elapsedSeconds, isRunning, activeSession, taskTotalSeconds, handleStart, handleStop } = useTimer();

  const [pomMode, setPomMode]         = useState(false);
  const [pomPhase, setPomPhase]       = useState('work');
  const [pomSecsLeft, setPomSecsLeft] = useState(WORK_SECS);
  const pomPhaseRef                   = useRef('work');

  useEffect(() => {
    pomPhaseRef.current = pomPhase;
  }, [pomPhase]);

  useEffect(() => {
    if (!pomMode || !isRunning) return;
    const id = setInterval(() => {
      setPomSecsLeft(prev => {
        if (prev <= 1) {
          const next = pomPhaseRef.current === 'work' ? 'break' : 'work';
          setPomPhase(next);
          if (next === 'break') {
            sendNotif('Studifly', 'Time to take a break!');
            return BREAK_SECS;
          } else {
            sendNotif('Studifly', 'Back to work!');
            return WORK_SECS;
          }
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [pomMode, isRunning]);

  async function start() {
    if (pomMode) requestNotifPermission();
    const task = tasks.find(t => t.id === parseInt(selectedTask));
    await handleStart(selectedTask ? parseInt(selectedTask) : null, task?.name || 'Untitled session');
  }

  async function stop() {
    const session = await handleStop();
    if (session) setStoppedSession(session);
    if (pomMode) {
      setPomPhase('work');
      setPomSecsLeft(WORK_SECS);
    }
  }

  function switchMode(toPom) {
    if (isRunning) return;
    setPomMode(toPom);
    setPomPhase('work');
    setPomSecsLeft(WORK_SECS);
  }

  function handleReflectionDone() {
    setStoppedSession(null);
    onSessionSaved?.();
  }

  const displaySeconds = pomMode ? pomSecsLeft : elapsedSeconds;

  return (
    <>
      <div className={styles.widget}>
        <div className={styles.modeToggle}>
          <button
            className={[styles.modeBtn, !pomMode && styles.modeBtnActive].filter(Boolean).join(' ')}
            onClick={() => switchMode(false)}
            disabled={isRunning}
            title={isRunning ? 'Stop timer to switch modes' : undefined}
          >
            Free Timer
          </button>
          <button
            className={[styles.modeBtn, pomMode && styles.modeBtnActive].filter(Boolean).join(' ')}
            onClick={() => switchMode(true)}
            disabled={isRunning}
            title={isRunning ? 'Stop timer to switch modes' : undefined}
          >
            Pomodoro
          </button>
        </div>

        <div className={styles.displayWrapper}>
          {pomMode && (
            <div className={[styles.phaseBadge, pomPhase === 'break' && styles.phaseBadgeBreak].filter(Boolean).join(' ')}>
              {pomPhase === 'work' ? 'Work' : 'Break'}
            </div>
          )}
          <TimerDisplay seconds={displaySeconds} />
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
