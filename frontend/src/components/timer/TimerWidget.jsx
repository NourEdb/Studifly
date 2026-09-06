import { useState } from 'react';
import useTimer from '../../hooks/useTimer';
import { playChime, unlockAudio, getChimeType, setChimeType, CHIME_OPTIONS } from '../../utils/chime';
import TimerDisplay from './TimerDisplay';
import PostSessionModal from './PostSessionModal';
import TimerFullscreen from './TimerFullscreen';
import TaskSubtaskSelect from './TaskSubtaskSelect';
import Button from '../ui/Button';
import CourseLabel from '../ui/CourseLabel';
import { parseSelection } from '../../utils/subtaskSelection';
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

export default function TimerWidget({ tasks, blocks, onSessionSaved }) {
  const [selection, setSelection]           = useState('');
  const [stoppedSession, setStoppedSession] = useState(null);
  const [chimeType, setChimeTypeUI]         = useState(getChimeType());
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  const {
    elapsedSeconds, isRunning, activeSession, taskTotalSeconds,
    pomMode, pomPhase, pomSecondsLeft, workMinutes, breakMinutes,
    setPomMode, setWorkMinutes, setBreakMinutes,
    isPaused, pauseTimer, resumeTimer,
    handleStart, handleStop,
  } = useTimer();

  async function start() {
    // Both modes can now trigger a browser notification (planned-time reached,
    // or a Pomodoro phase change), so always ask up front.
    requestNotifPermission();
    const { taskId, studyBlockId, name, plannedMinutes } = parseSelection(selection, tasks, blocks);
    await handleStart(taskId, name, plannedMinutes, studyBlockId);
  }

  async function stop() {
    const session = await handleStop();
    if (session) setStoppedSession(session);
  }

  async function stopFromFullscreen() {
    setFullscreenOpen(false);
    await stop();
  }

  function handleReflectionDone() {
    setStoppedSession(null);
    setSelection('');
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
  const runningTask = activeSession?.task_id ? tasks.find(t => t.id === activeSession.task_id) : null;

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
          {isPaused && <p className={styles.pausedLabel}>Paused</p>}
          {isRunning && activeSession?.taskName && (
            <p className={styles.taskLabel}>📌 {activeSession.taskName}</p>
          )}
          {isRunning && runningTask?.course_name && (
            <div className={styles.courseRow}>
              <CourseLabel name={runningTask.course_name} color={runningTask.course_color} />
            </div>
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
              <TaskSubtaskSelect tasks={tasks} blocks={blocks} value={selection} onChange={setSelection} />
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
          <div className={styles.runningControls}>
            {isPaused ? (
              <Button onClick={resumeTimer} variant="secondary" size="lg" fullWidth>▶ Resume</Button>
            ) : (
              <Button onClick={pauseTimer} variant="secondary" size="lg" fullWidth>⏸ Pause</Button>
            )}
            <Button onClick={stop} variant="danger" size="lg" fullWidth>■ Stop &amp; Save</Button>
            <button type="button" className={styles.fullscreenBtn} onClick={() => setFullscreenOpen(true)}>
              ⛶ Full screen
            </button>
          </div>
        )}
      </div>

      {fullscreenOpen && (
        <TimerFullscreen
          taskName={activeSession?.taskName}
          courseName={runningTask?.course_name}
          courseColor={runningTask?.course_color}
          onStop={stopFromFullscreen}
          onClose={() => setFullscreenOpen(false)}
        />
      )}

      {stoppedSession && (
        <PostSessionModal
          session={stoppedSession}
          onDone={handleReflectionDone}
        />
      )}
    </>
  );
}
