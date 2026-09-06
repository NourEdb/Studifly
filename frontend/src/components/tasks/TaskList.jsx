import { useState } from 'react';
import toast from 'react-hot-toast';
import TaskCard from './TaskCard';
import TaskForm from './TaskForm';
import StudyBlockForm from './StudyBlockForm';
import StudyBlockList from './StudyBlockList';
import Button from '../ui/Button';
import useTimer from '../../hooks/useTimer';
import useStudyBlocks from '../../hooks/useStudyBlocks';
import { describeSession } from '../../utils/subtaskSelection';
import styles from './TaskList.module.css';

export default function TaskList({ tasks, courses, add, edit, remove, setStatus, updateLocal, filters, setFilters }) {
  const [showForm, setShowForm]       = useState(false);
  const [editing, setEditing]         = useState(null);
  const [planningTask, setPlanningTask] = useState(null);
  const [editingBlock, setEditingBlock] = useState(null);
  const { handleStart, isRunning, activeSession } = useTimer();
  const {
    add: addBlock, edit: editBlock, remove: removeBlock,
    setStatus: setBlockStatus, updateLocal: updateBlockLocal, forTask,
  } = useStudyBlocks();

  async function handleSave(data) {
    try {
      if (editing) {
        await edit(editing.id, data);
        toast.success('Task updated');
      } else {
        await add(data);
        toast.success('Task created');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save task');
      throw err;
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this task?')) return;
    try { await remove(id); toast.success('Task deleted'); }
    catch { toast.error('Failed to delete task'); }
  }

  async function handleStartTimer(task) {
    if (isRunning) {
      toast.error(`Timer already running for "${activeSession?.taskName}"`);
      return;
    }
    const plannedMinutes = task.planned_time > 0 ? task.planned_time : null;
    await handleStart(task.id, task.name, plannedMinutes);
    updateLocal?.(task.id, { status: 'in_progress' });
  }

  async function handleToggleComplete(task) {
    const next = task.status === 'completed' ? 'pending' : 'completed';
    try {
      await setStatus(task.id, next);
      toast.success(next === 'completed' ? 'Task marked complete' : 'Task marked incomplete');
    } catch {
      toast.error('Failed to update task');
    }
  }

  async function handleStartSubtask(block) {
    if (isRunning) {
      toast.error(`Timer already running for "${activeSession?.taskName}"`);
      return;
    }
    const { name, plannedMinutes } = describeSession(block.task_id, block.id, tasks, [block]);
    await handleStart(block.task_id, name, plannedMinutes, block.id);
    updateBlockLocal?.(block.id, { status: 'in_progress' });
    updateLocal?.(block.task_id, { status: 'in_progress' });
  }

  async function handleToggleSubtaskComplete(block) {
    const next = block.status === 'completed' ? 'pending' : 'completed';
    try {
      const result = await setBlockStatus(block.id, next);
      toast.success(next === 'completed' ? 'Subtask marked complete' : 'Subtask marked incomplete');
      if (result?.parent_task_completed) {
        updateLocal?.(block.task_id, { status: 'completed' });
        toast.success('🎉 All subtasks done — the parent task was marked complete too!', { duration: 5000 });
      }
    } catch {
      toast.error('Failed to update subtask');
    }
  }

  async function handleSaveBlock(data) {
    try {
      if (editingBlock) {
        await editBlock(editingBlock.id, data);
        toast.success('Study block updated');
      } else {
        await addBlock(data);
        toast.success('Study block planned');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save study block');
      throw err;
    }
  }

  async function handleDeleteBlock(id) {
    if (!confirm('Delete this study block?')) return;
    try { await removeBlock(id); toast.success('Study block deleted'); }
    catch { toast.error('Failed to delete study block'); }
  }

  function openEditBlock(block) {
    const task = tasks.find(t => t.id === block.task_id);
    setEditingBlock(block);
    setPlanningTask(task);
  }

  function closeBlockModal() {
    setPlanningTask(null);
    setEditingBlock(null);
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>+ New Task</Button>
        <div className={styles.filters}>
          <select value={filters?.status || ''} onChange={e => setFilters?.(f => ({ ...f, status: e.target.value || undefined }))}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
          <select value={filters?.course_id || ''} onChange={e => setFilters?.(f => ({ ...f, course_id: e.target.value || undefined }))}>
            <option value="">All courses</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className={styles.empty}>
          <p>✅ No tasks yet. Add your first one!</p>
        </div>
      ) : (
        <div className={styles.list}>
          {tasks.map(t => (
            <div key={t.id}>
              <TaskCard
                task={t}
                onEdit={task => { setEditing(task); setShowForm(true); }}
                onDelete={handleDelete}
                onStartTimer={handleStartTimer}
                onToggleComplete={handleToggleComplete}
                onPlanStudy={task => { setEditingBlock(null); setPlanningTask(task); }}
              />
              <StudyBlockList
                blocks={forTask(t.id)}
                onEdit={openEditBlock}
                onDelete={handleDeleteBlock}
                onStartTimer={handleStartSubtask}
                onToggleComplete={handleToggleSubtaskComplete}
              />
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <TaskForm
          initial={editing}
          courses={courses}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {planningTask && (
        <StudyBlockForm
          task={planningTask}
          block={editingBlock}
          onSave={handleSaveBlock}
          onClose={closeBlockModal}
        />
      )}
    </div>
  );
}
