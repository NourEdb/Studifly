import { createContext, useContext, useState, useEffect, useRef } from 'react';

const TimerContext = createContext(null);

export function TimerProvider({ children }) {
  const [activeSession,     setActiveSession]     = useState(null);
  const [startedAt,         setStartedAt]         = useState(null);
  const [elapsedSeconds,    setElapsedSeconds]    = useState(0);
  const [isRunning,         setIsRunning]         = useState(false);
  const [taskTotalSeconds,  setTaskTotalSeconds]  = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    clearInterval(intervalRef.current);
    if (isRunning && startedAt !== null) {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
      intervalRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning, startedAt]);

  function startTimer(session, taskTotal = null) {
    setActiveSession(session);
    setStartedAt(Date.now());
    setTaskTotalSeconds(taskTotal > 0 ? taskTotal : null);
    setIsRunning(true);
  }

  function stopTimer() {
    setIsRunning(false);
    setActiveSession(null);
    setStartedAt(null);
    setElapsedSeconds(0);
    setTaskTotalSeconds(null);
  }

  return (
    <TimerContext.Provider value={{ activeSession, elapsedSeconds, isRunning, taskTotalSeconds, startTimer, stopTimer }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimerContext() {
  return useContext(TimerContext);
}
