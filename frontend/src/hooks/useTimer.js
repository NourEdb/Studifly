import { useTimerContext } from '../context/TimerContext';
import { startSession, stopSession } from '../api/sessions.api';
import { getTaskTotal } from '../api/sessions.api';
import { updateTaskStatus } from '../api/tasks.api';
import { updateStudyBlockStatus } from '../api/study-blocks.api';
import { unlockAudio } from '../utils/chime';
import toast from 'react-hot-toast';

export default function useTimer() {
  const ctx = useTimerContext();

  async function handleStart(taskId, taskName, plannedMinutes = null, studyBlockId = null) {
    if (ctx.isRunning) return;
    unlockAudio(); // must run inside this user-gesture handler so later chimes are allowed to play
    try {
      const session = await startSession({ task_id: taskId, study_block_id: studyBlockId });

      let taskTotal = null;
      if (taskId) {
        try {
          const data = await getTaskTotal(taskId);
          taskTotal = data.total_seconds > 0 ? data.total_seconds : null;
          console.log('[useTimer] task-total fetch:', { taskId, total_seconds: data.total_seconds, taskTotal });
        } catch (err) {
          console.error('[useTimer] getTaskTotal failed:', err);
        }
        updateTaskStatus(taskId, 'in_progress').catch(err =>
          console.error('[useTimer] failed to mark task in_progress:', err.message)
        );
      }
      if (studyBlockId) {
        updateStudyBlockStatus(studyBlockId, 'in_progress').catch(err =>
          console.error('[useTimer] failed to mark subtask in_progress:', err.message)
        );
      }

      ctx.startTimer({ ...session, taskName }, taskTotal, plannedMinutes);
      toast.success('Timer started');
    } catch {
      toast.error('Failed to start timer');
    }
  }

  async function handleStop() {
    if (!ctx.isRunning || !ctx.activeSession) return null;
    try {
      const breakSeconds = ctx.getBreakSeconds();
      const session = await stopSession(ctx.activeSession.id, breakSeconds);
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
    pomMode:          ctx.pomMode,
    pomPhase:         ctx.pomPhase,
    pomSecondsLeft:   ctx.pomSecondsLeft,
    workMinutes:      ctx.workMinutes,
    breakMinutes:     ctx.breakMinutes,
    setPomMode:       ctx.setPomMode,
    setWorkMinutes:   ctx.setWorkMinutes,
    setBreakMinutes:  ctx.setBreakMinutes,
    isPaused:         ctx.isPaused,
    pauseTimer:       ctx.pauseTimer,
    resumeTimer:      ctx.resumeTimer,
    handleStart,
    handleStop,
  };
}
