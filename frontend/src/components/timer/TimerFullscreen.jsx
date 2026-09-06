import { useEffect, useRef } from 'react';
import useTimer from '../../hooks/useTimer';
import TimerDisplay from './TimerDisplay';
import styles from './TimerFullscreen.module.css';

export default function TimerFullscreen({ taskName, courseName, onStop, onClose }) {
  const rootRef = useRef(null);
  // TimerWidget re-renders every tick and passes a fresh onClose closure each
  // time. Reading it through a ref (kept current on every render, below) lets
  // the setup effect run exactly once on mount/unmount instead of tearing
  // down and re-entering fullscreen every second — which is what was causing
  // the view to immediately exit itself (the teardown's exitFullscreen() call
  // raced with re-requesting fullscreen and the resulting fullscreenchange
  // event closed the overlay for real).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const {
    elapsedSeconds, pomMode, pomPhase, pomSecondsLeft,
    isPaused, pauseTimer, resumeTimer,
  } = useTimer();

  const displaySeconds = pomMode ? pomSecondsLeft : elapsedSeconds;

  useEffect(() => {
    const el = rootRef.current;
    // Browser Fullscreen API when available; the overlay below still renders as
    // an in-page fallback if this is unsupported or denied.
    el?.requestFullscreen?.().catch(() => {});

    function handleFullscreenChange() {
      if (!document.fullscreenElement) onCloseRef.current();
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') onCloseRef.current();
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []); // run once for the lifetime of this overlay, not on every parent re-render

  return (
    <div ref={rootRef} className={styles.overlay}>
      <button className={styles.close} onClick={onClose} aria-label="Exit full screen" title="Exit full screen (Esc)">
        ✕
      </button>

      {pomMode && (
        <div className={[styles.phaseBadge, pomPhase === 'break' && styles.phaseBadgeBreak].filter(Boolean).join(' ')}>
          {pomPhase === 'work' ? 'Work' : 'Break'}
        </div>
      )}

      <TimerDisplay seconds={displaySeconds} size="xl" />

      {isPaused && <p className={styles.pausedLabel}>Paused</p>}

      {taskName && (
        <p className={styles.taskName}>
          📌 {taskName}{courseName ? ` · ${courseName}` : ''}
        </p>
      )}

      <div className={styles.controls}>
        {isPaused ? (
          <button className={styles.controlBtn} onClick={resumeTimer}>▶ Resume</button>
        ) : (
          <button className={styles.controlBtn} onClick={pauseTimer}>⏸ Pause</button>
        )}
        <button className={[styles.controlBtn, styles.stopBtn].join(' ')} onClick={onStop}>
          ■ Stop &amp; Save
        </button>
      </div>
    </div>
  );
}
