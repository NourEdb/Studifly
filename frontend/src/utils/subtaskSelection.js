// Encodes/decodes the "t:<taskId>" / "b:<studyBlockId>" value used by the
// task-and-subtask <select> in TimerWidget and ManualEntryForm, so a single
// dropdown can offer either a whole task or one of its subtasks.

export function encodeTaskSelection(taskId) {
  return `t:${taskId}`;
}

export function encodeSubtaskSelection(blockId) {
  return `b:${blockId}`;
}

export function parseSelection(selection, tasks, blocks) {
  if (!selection) return { taskId: null, studyBlockId: null, name: 'Untitled session', plannedMinutes: null };

  if (selection.startsWith('b:')) {
    const blockId = parseInt(selection.slice(2), 10);
    const block = blocks.find(b => b.id === blockId);
    const task = tasks.find(t => t.id === block?.task_id);
    const name = task ? `${task.name} › ${block?.topic || 'Subtask'}` : (block?.topic || 'Untitled session');
    const plannedMinutes = (block?.planned_time > 0 ? block.planned_time : null) ?? (task?.planned_time > 0 ? task.planned_time : null);
    return { taskId: block?.task_id ?? null, studyBlockId: blockId, name, plannedMinutes };
  }

  const taskId = parseInt(selection.slice(2), 10);
  const task = tasks.find(t => t.id === taskId);
  return {
    taskId,
    studyBlockId: null,
    name: task?.name || 'Untitled session',
    plannedMinutes: task?.planned_time > 0 ? task.planned_time : null,
  };
}

// For the resumed-session case, where we already know the task/block ids
// (from the saved session row) rather than a "t:"/"b:" selection string.
export function describeSession(taskId, studyBlockId, tasks, blocks) {
  const task = taskId ? tasks.find(t => t.id === taskId) : null;
  const block = studyBlockId ? blocks.find(b => b.id === studyBlockId) : null;
  const name = block
    ? `${task?.name || 'Untitled session'} › ${block.topic || 'Subtask'}`
    : (task?.name || 'Untitled session');
  const plannedMinutes = (block?.planned_time > 0 ? block.planned_time : null) ?? (task?.planned_time > 0 ? task.planned_time : null);
  return { name, plannedMinutes };
}
