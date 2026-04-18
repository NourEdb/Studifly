import { createContext, useContext, useState, useEffect, useRef } from 'react';

const TimerContext = createContext(null);

export function TimerProvider({ children }) {
  const [activeSession, setActiveSession] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds(s => s + 1);
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  function startTimer(session) {
    setActiveSession(session);
    setElapsedSeconds(0);
    setIsRunning(true);
  }

  function stopTimer() {
    setIsRunning(false);
    setActiveSession(null);
    setElapsedSeconds(0);
  }

  return (
    <TimerContext.Provider value={{ activeSession, elapsedSeconds, isRunning, startTimer, stopTimer }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimerContext() {
  return useContext(TimerContext);
}
