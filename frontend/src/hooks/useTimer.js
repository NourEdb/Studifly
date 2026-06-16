import { useTimerContext } from '../context/TimerContext';
import { startSession, stopSession } from '../api/sessions.api';
import { getTaskTotal } from '../api/sessions.api';
import toast from 'react-hot-toast';

export default function useTimer() {
  const ctx = useTimerContext();

  async function handleStart(taskId, taskName) {
    if (ctx.isRunning) return;
    try {
      const session = await startSession({ task_id: taskId });

      let taskTotal = null;
      if (taskId) {
        try {
          const data = await getTaskTotal(taskId);
          taskTotal = data.total_seconds > 0 ? data.total_seconds : null;
          console.log('[useTimer] task-total fetch:', { taskId, total_seconds: data.total_seconds, taskTotal });
        } catch (err) {
          console.error('[useTimer] getTaskTotal failed:', err);
        }
      }

      ctx.startTimer({ ...session, taskName }, taskTotal);
      toast.success('Timer started');
    } catch {
      toast.error('Failed to start timer');
    }
  }

  async function handleStop() {
    if (!ctx.isRunning || !ctx.activeSession) return null;
    try {
      const session = await stopSession(ctx.activeSession.id);
      ctx.stopTimer();
      toast.success('Session saved');
      return session;
    } catch {
      toast.error('Failed to stop timer');
      return null;
    }
  }

  return {
    elapsedSeconds:   ctx.elapsedSeconds,
    isRunning:        ctx.isRunning,
    activeSession:    ctx.activeSession,
    taskTotalSeconds: ctx.taskTotalSeconds,
    handleStart,
    handleStop,
  };
}
