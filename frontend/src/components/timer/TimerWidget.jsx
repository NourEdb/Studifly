import { useState } from 'react';
import useTimer from '../../hooks/useTimer';
import { playChime, unlockAudio, getChimeType, setChimeType, CHIME_OPTIONS } from '../../utils/chime';
import TimerDisplay from './TimerDisplay';
import PostSessionModal from './PostSessionModal';
import Button from '../ui/Button';
import styles from './TimerWidget.module.css';

function requestNotifPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
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
  const [chimeType, setChimeTypeUI]         = useState(getChimeType());

  const {
    elapsedSeconds, isRunning, activeSession, taskTotalSeconds,
    pomMode, pomPhase, pomSecondsLeft, workMinutes, breakMinutes,
    setPomMode, setWorkMinutes, setBreakMinutes,
    handleStart, handleStop,
  } = useTimer();

  async function start() {
    // Both modes can now trigger a browser notification (planned-time reached,
    // or a Pomodoro phase change), so always ask up front.
    requestNotifPermission();
    const task = tasks.find(t => t.id === parseInt(selectedTask));
    const plannedMinutes = task?.planned_time > 0 ? task.planned_time : null;
    await handleStart(selectedTask ? parseInt(selectedTask) : null, task?.name || 'Untitled session', plannedMinutes);
  }

  async function stop() {
    const session = await handleStop();
    if (session) setStoppedSession(session);
  }

  function handleReflectionDone() {
    setStoppedSession(null);
    setSelectedTask('');
    onSessionSaved?.();
  }

  function handleChimeTypeChange(e) {
    const v = e.target.value;
    setChimeType(v);
    setChimeTypeUI(v);
  }

  function testSound() {
    unlockAudio();
    playChime(chimeType);
  }

  const displaySeconds = pomMode ? pomSecondsLeft : elapsedSeconds;

  return (
    <>
      <div className={styles.widget}>
        <div className={styles.modeToggle}>
          <button
            className={[styles.modeBtn, !pomMode && styles.modeBtnActive].filter(Boolean).join(' ')}
            onClick={() => setPomMode(false)}
            disabled={isRunning}
            title={isRunning ? 'Stop timer to switch modes' : undefined}
          >
            Free Timer
          </button>
          <button
            className={[styles.modeBtn, pomMode && styles.modeBtnActive].filter(Boolean).join(' ')}
            onClick={() => setPomMode(true)}
            disabled={isRunning}
            title={isRunning ? 'Stop timer to switch modes' : undefined}
          >
            Pomodoro
          </button>
        </div>

        {pomMode && (
          <div className={styles.pomSettings}>
            <div className={styles.pomSettingField}>
              <label>Work (min)</label>
              <input
                type="number"
                min="1"
                max="180"
                value={workMinutes}
                onChange={e => setWorkMinutes(e.target.value)}
                disabled={isRunning}
              />
            </div>
            <div className={styles.pomSettingField}>
              <label>Break (min)</label>
              <input
                type="number"
                min="1"
                max="60"
                value={breakMinutes}
                onChange={e => setBreakMinutes(e.target.value)}
                disabled={isRunning}
              />
            </div>
          </div>
        )}

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
            <div className={styles.soundRow}>
              <select className={styles.chimeSelect} value={chimeType} onChange={handleChimeTypeChange}>
                {CHIME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button type="button" className={styles.testSoundBtn} onClick={testSound}>
                🔊 Test sound
              </button>
            </div>
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
