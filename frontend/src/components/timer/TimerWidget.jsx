import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
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

function playChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const start = now + i * 0.15;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.15, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.4);
    });
  } catch {
    // AudioContext unsupported or blocked — skip the chime
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
  const [plannedMinutes, setPlannedMinutes] = useState(null);
  const plannedNotifiedRef                  = useRef(false);
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
    plannedNotifiedRef.current = false;
    setPlannedMinutes(task?.planned_time > 0 ? task.planned_time : null);
    await handleStart(selectedTask ? parseInt(selectedTask) : null, task?.name || 'Untitled session');
  }

  async function stop() {
    const session = await handleStop();
    if (session) setStoppedSession(session);
    if (pomMode) {
      setPomPhase('work');
      setPomSecsLeft(WORK_SECS);
    }
    setPlannedMinutes(null);
  }

  useEffect(() => {
    if (!isRunning || !plannedMinutes || plannedNotifiedRef.current) return;
    if (elapsedSeconds >= plannedMinutes * 60) {
      plannedNotifiedRef.current = true;
      playChime();
      toast("⏰ You've reached your planned time! Keep going or wrap up?", { duration: 6000 });
    }
  }, [elapsedSeconds, isRunning, plannedMinutes]);

  function switchMode(toPom) {
    if (isRunning) return;
    setPomMode(toPom);
    setPomPhase('work');
    setPomSecsLeft(WORK_SECS);
  }

  function handleReflectionDone() {
    setStoppedSession(null);
    setSelectedTask('');
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
          onDone={handleReflectionDone}
        />
      )}
    </>
  );
}
