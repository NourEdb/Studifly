import { createContext, useContext, useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { playChime, scheduleChime, cancelScheduledChime, unlockAudio } from '../utils/chime';
import { useAuth } from './AuthContext';

const TimerContext = createContext(null);

const SNAPSHOT_KEY  = 'studifly_timer_snapshot';
const LS_WORK_KEY    = 'studifly_pomodoro_work_minutes';
const LS_BREAK_KEY   = 'studifly_pomodoro_break_minutes';
const WORK_MIN_DEFAULT  = 25;
const BREAK_MIN_DEFAULT = 5;

// Shown one at random when a post-session break starts.
const BREAK_IDEAS = [
  'Try a 1-minute breathing exercise — inhale for 4 seconds, hold for 4, exhale for 4.',
  'Stand up and do a few desk stretches.',
  'Take a short walk, even just around the room.',
  'Drink a full glass of water.',
  'Jot a couple of lines in a journal about how the session went.',
  'Look away from the screen — focus on something far away for 20 seconds.',
];

function loadStoredMinutes(key, fallback) {
  const n = parseInt(localStorage.getItem(key), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// A snapshot is valid if it describes either a running study session or an
// active post-session break — only one of the two can ever be true at once.
function loadSnapshot() {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw);
    const validSession = snap?.activeSession && snap?.startedAt;
    const validBreak = snap?.breakActive && snap?.breakStartedAt && snap?.breakDurationSec;
    return (validSession || validBreak) ? snap : null;
  } catch {
    return null;
  }
}

function saveSnapshot(snap) {
  try {
    if (snap) localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap));
    else localStorage.removeItem(SNAPSHOT_KEY);
  } catch {
    // storage unavailable (private browsing, quota) — timer just won't survive a refresh
  }
}

function sendNotif(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

// Defensive: only ever treat a genuinely positive, finite number of seconds as
// a real planned time. Guards against a malformed/legacy localStorage
// snapshot (or a 0/undefined slipping through) ever being read as "truthy
// enough" to fire the chime for a task that has no planned time at all.
function sanitizePlannedSeconds(v) {
  return (typeof v === 'number' && Number.isFinite(v) && v > 0) ? v : null;
}

export function TimerProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const prevUserRef = useRef(undefined);
  const restored = loadSnapshot();

  const [activeSession,    setActiveSession]    = useState(restored?.activeSession ?? null);
  const [startedAt,        setStartedAt]        = useState(restored?.startedAt ?? null);
  const [elapsedSeconds,   setElapsedSeconds]   = useState(() => {
    if (!restored?.activeSession) return 0;
    const referencePoint = restored.isPaused && restored.pausedAt ? restored.pausedAt : Date.now();
    return Math.max(0, Math.floor((referencePoint - restored.startedAt) / 1000));
  });
  const [isRunning,        setIsRunning]        = useState(!!restored?.activeSession);
  const [taskTotalSeconds, setTaskTotalSeconds] = useState(restored?.taskTotalSeconds ?? null);
  const [plannedSeconds,   setPlannedSeconds]   = useState(() => sanitizePlannedSeconds(restored?.plannedSeconds));
  // Whether the planned-time chime has already fired for the CURRENT session.
  // Persisted (not a plain ref) so it survives a snapshot restore — otherwise
  // a tab that gets fully discarded and reloaded (e.g. screen off long enough
  // for the OS/browser to kill it) would reset this to false and could fire
  // the chime again on the very next tick after restoring.
  const [plannedNotified,  setPlannedNotified]  = useState(restored?.plannedNotified ?? false);

  const [pomMode,        setPomModeState]     = useState(restored?.pomMode ?? false);
  const [pomPhase,       setPomPhase]         = useState(restored?.pomPhase ?? 'work');
  const [phaseStartedAt, setPhaseStartedAt]   = useState(restored?.phaseStartedAt ?? null);
  const [workMinutes,    setWorkMinutesState] = useState(() => loadStoredMinutes(LS_WORK_KEY, WORK_MIN_DEFAULT));
  const [breakMinutes,   setBreakMinutesState]= useState(() => loadStoredMinutes(LS_BREAK_KEY, BREAK_MIN_DEFAULT));
  const [pomSecondsLeft, setPomSecondsLeft]   = useState(() => {
    if (restored?.pomMode && restored?.phaseStartedAt) {
      const dur = (restored.pomPhase === 'break'
        ? loadStoredMinutes(LS_BREAK_KEY, BREAK_MIN_DEFAULT)
        : loadStoredMinutes(LS_WORK_KEY, WORK_MIN_DEFAULT)) * 60;
      const referencePoint = restored.isPaused && restored.pausedAt ? restored.pausedAt : Date.now();
      return Math.max(0, dur - Math.floor((referencePoint - restored.phaseStartedAt) / 1000));
    }
    return loadStoredMinutes(LS_WORK_KEY, WORK_MIN_DEFAULT) * 60;
  });
  // Seconds spent on completed break intervals AND completed pauses so far this
  // session. The current, still-in-progress break or pause (if any) is added on
  // top of this at read time by getBreakSeconds().
  const [accumulatedBreakSeconds, setAccumulatedBreakSeconds] = useState(restored?.accumulatedBreakSeconds ?? 0);

  // Persisted so a refresh while paused doesn't silently turn the paused time
  // (while the page was reloading) into study time — pausedAt is a fixed
  // timestamp, so however long the refresh itself takes is correctly still
  // counted as paused, not worked.
  const [isPaused, setIsPaused] = useState(restored?.isPaused ?? false);
  const [pausedAt, setPausedAt] = useState(restored?.pausedAt ?? null);

  // --- Post-session break (free timer only) --------------------------------
  const [breakActive,      setBreakActive]      = useState(restored?.breakActive ?? false);
  const [breakStartedAt,   setBreakStartedAt]   = useState(restored?.breakStartedAt ?? null);
  const [breakDurationSec, setBreakDurationSec] = useState(restored?.breakDurationSec ?? null);
  const [breakIdea,        setBreakIdea]        = useState(restored?.breakIdea ?? null);
  const [breakNotified,    setBreakNotified]    = useState(restored?.breakNotified ?? false);
  const [breakSecondsLeft, setBreakSecondsLeft] = useState(() => {
    if (restored?.breakActive && restored?.breakStartedAt && restored?.breakDurationSec) {
      return Math.max(0, restored.breakDurationSec - Math.floor((Date.now() - restored.breakStartedAt) / 1000));
    }
    return 0;
  });
  const breakAudioFiredRef = useRef(false);
  const breakStateRef = useRef({});
  breakStateRef.current = { breakStartedAt, breakDurationSec, breakNotified };

  const intervalRef = useRef(null);
  // Mirrors current state for the interval closure below, so it always reads fresh values
  // instead of the ones captured when the interval was created.
  const stateRef = useRef({});
  stateRef.current = { pomMode, pomPhase, phaseStartedAt, workMinutes, breakMinutes, startedAt, plannedSeconds, plannedNotified };

  // --- Precise, audio-clock-scheduled chimes -------------------------------
  // The tick loop below is throttled in a backgrounded/hidden tab (browsers
  // slow setInterval way down), so relying on it alone made both the
  // Pomodoro phase chime and the free-timer planned-time chime fire late —
  // by ~30s or more — after any real time in the background. Scheduling the
  // actual sound on the AudioContext's own clock instead fires it precisely,
  // since the audio rendering graph keeps running even when JS timers don't.
  // The tick loop remains the single source of truth for state (phase,
  // elapsed, notifications) — it just skips re-playing a chime that audio
  // already handled, tracked via these refs. The post-session break chime
  // (below) reuses the exact same scheduling primitive.
  const lastAudioBoundaryMsRef = useRef(null); // last Pomodoro phase-boundary (ms) confirmed chimed via audio
  const freeAudioFiredRef      = useRef(false); // whether the free-timer's scheduled chime already played

  // Chains itself via the chime's onended: each time one phase's chime plays,
  // it schedules the next one, so precision doesn't erode over a long
  // backgrounded Pomodoro session spanning many phase changes.
  function schedulePomodoroChime(phase, phaseStartMs, workMin, breakMin) {
    let curPhase = phase;
    let curStart = phaseStartMs;
    let durSec   = (curPhase === 'work' ? workMin : breakMin) * 60;
    let boundaryMs = curStart + durSec * 1000;

    // Fast-forward silently through any boundaries already in the past (e.g.
    // the initial schedule after restoring a session that ran unattended for
    // a long time) — chime once for the current phase, not once per skipped
    // one, matching the tick loop's own catch-up behavior.
    while (boundaryMs <= Date.now()) {
      curPhase = curPhase === 'work' ? 'break' : 'work';
      curStart = boundaryMs;
      durSec   = (curPhase === 'work' ? workMin : breakMin) * 60;
      boundaryMs = curStart + durSec * 1000;
    }

    const delaySeconds = (boundaryMs - Date.now()) / 1000;
    scheduleChime(delaySeconds, undefined, () => {
      lastAudioBoundaryMsRef.current = boundaryMs;
      schedulePomodoroChime(curPhase === 'work' ? 'break' : 'work', boundaryMs, workMin, breakMin);
    });
  }

  // One-shot — the free timer's planned-time chime never repeats.
  function scheduleFreeChime(plannedSec, startMs) {
    const boundaryMs = startMs + plannedSec * 1000;
    const delaySeconds = (boundaryMs - Date.now()) / 1000;
    scheduleChime(delaySeconds, undefined, () => {
      freeAudioFiredRef.current = true;
    });
  }

  // Also one-shot, same pattern as the free-timer chime.
  function scheduleBreakChime(durationSec, startMs) {
    const boundaryMs = startMs + durationSec * 1000;
    const delaySeconds = (boundaryMs - Date.now()) / 1000;
    scheduleChime(delaySeconds, undefined, () => {
      breakAudioFiredRef.current = true;
    });
  }

  useEffect(() => {
    clearInterval(intervalRef.current);
    if (!isRunning || startedAt === null || isPaused) return;

    function tick() {
      const s = stateRef.current;
      const elapsedNow = Math.floor((Date.now() - s.startedAt) / 1000);
      setElapsedSeconds(elapsedNow);

      // Free timer: chime + notify once when planned time is reached, keep counting.
      // Runs here (not in a page component) so it fires regardless of which page is
      // open, or whether the tab is backgrounded. The actual sound is normally
      // already played precisely by scheduleFreeChime()'s AudioContext-clock
      // schedule (see below) — this only plays it if that didn't happen (e.g.
      // AudioContext unavailable), guarded by freeAudioFiredRef so it can't
      // double-play. State/notification/toast always fire from here regardless,
      // since only the tick loop can currently drive React state and only the
      // tick loop's notification path applies (Notifications can't be scheduled).
      // Defensive check (not just a truthy test): only a real, positive, finite
      // planned time can ever trigger this, however s.plannedSeconds got here.
      const hasPlannedTime = typeof s.plannedSeconds === 'number' && Number.isFinite(s.plannedSeconds) && s.plannedSeconds > 0;
      if (!s.pomMode && hasPlannedTime && !s.plannedNotified && elapsedNow >= s.plannedSeconds) {
        setPlannedNotified(true);
        if (!freeAudioFiredRef.current) playChime();
        sendNotif('Studifly', "You've reached your planned time! Keep going or wrap up?");
        toast("⏰ You've reached your planned time! Keep going or wrap up?", { duration: 6000 });
      }

      if (!s.pomMode || s.phaseStartedAt === null) return;

      let phase       = s.pomPhase;
      let phaseStart  = s.phaseStartedAt;
      let durSec      = (phase === 'work' ? s.workMinutes : s.breakMinutes) * 60;
      let elapsed     = (Date.now() - phaseStart) / 1000;
      let changed     = false;
      let breakDelta  = 0;

      // Loop (rather than a single step) so a long-backgrounded tab or a page
      // refresh after several phases catches up to the correct current phase.
      while (elapsed >= durSec) {
        if (phase === 'break') breakDelta += durSec;
        phaseStart += durSec * 1000;
        phase       = phase === 'work' ? 'break' : 'work';
        durSec      = (phase === 'work' ? s.workMinutes : s.breakMinutes) * 60;
        elapsed     = (Date.now() - phaseStart) / 1000;
        changed     = true;
      }

      if (breakDelta > 0) setAccumulatedBreakSeconds(prev => prev + breakDelta);

      if (changed) {
        // Same fallback pattern as the free-timer chime above: schedulePomodoroChime's
        // onended chain normally already played this precisely and recorded the
        // boundary it covered. Only play here if that boundary is still behind
        // where the tick loop ended up (audio scheduling unavailable, or this
        // tick simply won the race against a not-yet-fired schedule).
        const audioAlreadyChimed = lastAudioBoundaryMsRef.current !== null && phaseStart <= lastAudioBoundaryMsRef.current;
        if (!audioAlreadyChimed) playChime();
        sendNotif('Studifly', phase === 'break' ? 'Time to take a break!' : 'Back to work!');
        setPomPhase(phase);
        setPhaseStartedAt(phaseStart);
      }
      setPomSecondsLeft(Math.max(0, Math.ceil(durSec - elapsed)));
    }

    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => clearInterval(intervalRef.current);
  }, [isRunning, startedAt, isPaused]);

  // Independent tick for the post-session break countdown — runs regardless
  // of the study-timer's isRunning state, since a break only ever happens
  // after a session has already been stopped.
  const breakIntervalRef = useRef(null);
  useEffect(() => {
    clearInterval(breakIntervalRef.current);
    if (!breakActive || breakStartedAt === null) return;

    function breakTick() {
      const s = breakStateRef.current;
      const elapsed = Math.floor((Date.now() - s.breakStartedAt) / 1000);
      const left = Math.max(0, s.breakDurationSec - elapsed);
      setBreakSecondsLeft(left);

      if (left <= 0 && !s.breakNotified) {
        setBreakNotified(true);
        if (!breakAudioFiredRef.current) playChime();
        sendNotif('Studifly', "Break's over — ready to get back to it?");
        toast("☕ Break's over! Ready for the next session?", { duration: 6000 });
      }
    }

    breakTick();
    breakIntervalRef.current = setInterval(breakTick, 1000);
    return () => clearInterval(breakIntervalRef.current);
  }, [breakActive, breakStartedAt]);

  // Snapshot a running timer OR an active break to localStorage so a page
  // refresh can restore it — the two are mutually exclusive.
  useEffect(() => {
    if (isRunning && activeSession) {
      saveSnapshot({
        activeSession, startedAt, pomMode, pomPhase, phaseStartedAt,
        taskTotalSeconds, plannedSeconds, plannedNotified, accumulatedBreakSeconds,
        isPaused, pausedAt,
      });
    } else if (breakActive) {
      saveSnapshot({ breakActive, breakStartedAt, breakDurationSec, breakIdea, breakNotified });
    } else {
      saveSnapshot(null);
    }
  }, [isRunning, activeSession, startedAt, pomMode, pomPhase, phaseStartedAt, taskTotalSeconds, plannedSeconds, plannedNotified, accumulatedBreakSeconds, isPaused, pausedAt, breakActive, breakStartedAt, breakDurationSec, breakIdea, breakNotified]);

  function setWorkMinutes(raw) {
    const n = Math.max(1, parseInt(raw, 10) || 1);
    setWorkMinutesState(n);
    localStorage.setItem(LS_WORK_KEY, String(n));
    if (!isRunning) setPomSecondsLeft(n * 60);
    return n;
  }

  function setBreakMinutes(raw) {
    const n = Math.max(1, parseInt(raw, 10) || 1);
    setBreakMinutesState(n);
    localStorage.setItem(LS_BREAK_KEY, String(n));
    return n;
  }

  function setPomMode(on) {
    if (isRunning) return;
    setPomModeState(on);
    setPomPhase('work');
    setPomSecondsLeft(workMinutes * 60);
  }

  function startTimer(session, taskTotal = null, plannedMinutes = null) {
    // Starting a new session while a post-session break is pending means the
    // user chose to skip it — can't be "on a break" and studying at once.
    if (breakActive) skipBreak();

    const now = Date.now();
    const planned = sanitizePlannedSeconds(plannedMinutes > 0 ? plannedMinutes * 60 : null);
    setActiveSession(session);
    setStartedAt(now);
    setTaskTotalSeconds(taskTotal > 0 ? taskTotal : null);
    setPlannedSeconds(planned);
    setAccumulatedBreakSeconds(0);
    setPlannedNotified(false);
    setIsRunning(true);

    unlockAudio(); // Start is a genuine user gesture — allows scheduled sounds to play later
    lastAudioBoundaryMsRef.current = null;
    freeAudioFiredRef.current = false;

    if (pomMode) {
      setPomPhase('work');
      setPhaseStartedAt(now);
      setPomSecondsLeft(workMinutes * 60);
      schedulePomodoroChime('work', now, workMinutes, breakMinutes);
    } else if (planned) {
      scheduleFreeChime(planned, now);
    }
  }

  // Pausing counts the same as a break for duration purposes — neither is "work" —
  // so it reuses the same accumulator/field sent to the backend as break_seconds,
  // rather than needing a separate column.
  function pauseTimer() {
    if (!isRunning || isPaused) return;
    setIsPaused(true);
    setPausedAt(Date.now());
    // The AudioContext clock keeps running in real time regardless of our
    // "paused" concept, so a pending schedule would otherwise fire at the
    // wrong (real-world) moment. resumeTimer() reschedules from where this left off.
    cancelScheduledChime();
  }

  function resumeTimer() {
    if (!isRunning || !isPaused) return;
    const pausedMs = Date.now() - pausedAt;
    const newStartedAt = startedAt + pausedMs;
    // Shifting startedAt/phaseStartedAt forward makes the live display/countdown
    // continue smoothly (no jump) as if the pause never happened. That alone
    // doesn't reach the backend though — record the completed pause here so it
    // still ends up in break_seconds when Stop & Save is pressed later. Without
    // this, a resumed pause's duration was silently dropped: getBreakSeconds()
    // only ever added the CURRENT pause on top of the accumulator, and once
    // resumed there was no "current pause" left to add.
    setAccumulatedBreakSeconds(prev => prev + Math.floor(pausedMs / 1000));
    setStartedAt(newStartedAt);
    let newPhaseStartedAt = phaseStartedAt;
    if (pomMode && phaseStartedAt !== null) {
      newPhaseStartedAt = phaseStartedAt + pausedMs;
      setPhaseStartedAt(newPhaseStartedAt);
    }
    setIsPaused(false);
    setPausedAt(null);

    unlockAudio(); // Resume is also a genuine user gesture
    lastAudioBoundaryMsRef.current = null;
    if (pomMode && newPhaseStartedAt !== null) {
      schedulePomodoroChime(pomPhase, newPhaseStartedAt, workMinutes, breakMinutes);
    } else if (!pomMode && plannedSeconds && !plannedNotified) {
      freeAudioFiredRef.current = false;
      scheduleFreeChime(plannedSeconds, newStartedAt);
    }
  }

  // Total break time for the CURRENT session, including any break interval or
  // pause still in progress right now — used when Stop & Save is pressed.
  function getBreakSeconds() {
    const referenceNow = isPaused ? pausedAt : Date.now();
    const phasePartial = (pomMode && pomPhase === 'break' && phaseStartedAt !== null)
      ? Math.max(0, Math.floor((referenceNow - phaseStartedAt) / 1000))
      : 0;
    const pausePartial = isPaused ? Math.floor((Date.now() - pausedAt) / 1000) : 0;
    return accumulatedBreakSeconds + phasePartial + pausePartial;
  }

  function stopTimer() {
    setIsRunning(false);
    setActiveSession(null);
    setStartedAt(null);
    setElapsedSeconds(0);
    setTaskTotalSeconds(null);
    setPlannedSeconds(null);
    setAccumulatedBreakSeconds(0);
    setPlannedNotified(false);
    setPhaseStartedAt(null);
    setPomPhase('work');
    setPomSecondsLeft(workMinutes * 60);
    setIsPaused(false);
    setPausedAt(null);
    cancelScheduledChime();
    lastAudioBoundaryMsRef.current = null;
    freeAudioFiredRef.current = false;
    saveSnapshot(null);
  }

  // Post-session break — offered after stopping a free-timer session. This is
  // never counted as study time: it only ever runs once the study session has
  // already been stopped and saved, entirely independent of the study state.
  function startBreak(minutes) {
    if (isRunning) return; // can't be studying and on a break at once
    const now = Date.now();
    const durSec = Math.max(1, Math.round(minutes)) * 60;
    setBreakActive(true);
    setBreakStartedAt(now);
    setBreakDurationSec(durSec);
    setBreakIdea(BREAK_IDEAS[Math.floor(Math.random() * BREAK_IDEAS.length)]);
    setBreakNotified(false);
    setBreakSecondsLeft(durSec);
    breakAudioFiredRef.current = false;
    unlockAudio(); // starting a break is a user gesture too
    scheduleBreakChime(durSec, now);
  }

  function skipBreak() {
    cancelScheduledChime();
    setBreakActive(false);
    setBreakStartedAt(null);
    setBreakDurationSec(null);
    setBreakIdea(null);
    setBreakNotified(false);
    setBreakSecondsLeft(0);
    breakAudioFiredRef.current = false;
    saveSnapshot(null);
  }

  // If we just restored an already-running (and not paused) session, or an
  // active break, from the snapshot — i.e. this mount is a page reload, not a
  // fresh start or an explicit resume — none of those call sites ran, so the
  // precise audio schedule needs to be established here instead. Runs once,
  // using the values restored at construction time above.
  useEffect(() => {
    if (isRunning && !isPaused && startedAt !== null) {
      if (pomMode && phaseStartedAt !== null) {
        schedulePomodoroChime(pomPhase, phaseStartedAt, workMinutes, breakMinutes);
      } else if (!pomMode && plannedSeconds && !plannedNotified) {
        scheduleFreeChime(plannedSeconds, startedAt);
      }
    } else if (breakActive && breakStartedAt !== null && breakDurationSec !== null && !breakNotified) {
      scheduleBreakChime(breakDurationSec, breakStartedAt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset on logout so a running timer isn't restored into the next user's
  // session on a shared computer. Ignored while auth is still resolving on
  // boot (loading=true), so a restored snapshot survives a page refresh.
  useEffect(() => {
    if (authLoading) return;
    if (prevUserRef.current && !user) { stopTimer(); skipBreak(); }
    prevUserRef.current = user;
  }, [user, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <TimerContext.Provider value={{
      activeSession, elapsedSeconds, isRunning, taskTotalSeconds,
      pomMode, pomPhase, pomSecondsLeft, workMinutes, breakMinutes, isPaused,
      startTimer, stopTimer, setPomMode, setWorkMinutes, setBreakMinutes, getBreakSeconds,
      pauseTimer, resumeTimer,
      breakActive, breakSecondsLeft, breakIdea, startBreak, skipBreak,
    }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimerContext() {
  return useContext(TimerContext);
}
