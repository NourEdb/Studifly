import { useEffect, useRef, useState } from 'react';
import CourseLabel from '../ui/CourseLabel';
import styles from './TaskSubtaskSelect.module.css';

// Flattens tasks + their subtasks into one selectable list: each task appears
// exactly once (selecting it means "the whole task"), with its own subtasks
// (if any) immediately after it, indented. Values use the same "t:<id>" /
// "b:<id>" encoding as utils/subtaskSelection.js, so callers are unchanged.
function buildItems(tasks, blocks, placeholder) {
  const items = [{ value: '', rowLabel: placeholder, fullLabel: placeholder, isPlaceholder: true }];

  tasks.filter(t => t.status !== 'completed').forEach(t => {
    items.push({
      value: `t:${t.id}`,
      rowLabel: t.name,
      fullLabel: t.name,
      courseName: t.course_name,
      courseColor: t.course_color,
    });
    (blocks || []).filter(b => b.task_id === t.id && b.status !== 'completed').forEach(b => {
      items.push({
        value: `b:${b.id}`,
        rowLabel: b.topic || 'Subtask',
        fullLabel: `${t.name} › ${b.topic || 'Subtask'}`,
        isSubtask: true,
      });
    });
  });

  return items;
}

export default function TaskSubtaskSelect({ tasks, blocks, value, onChange, placeholder = '— No specific task —' }) {
  const [open, setOpen]           = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef(null);
  const listRef = useRef(null);

  const items = buildItems(tasks, blocks, placeholder);
  const selected = items.find(i => i.value === value) || items[0];

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Keep the highlighted row scrolled into view during keyboard navigation.
  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [open, highlight]);

  function openMenu() {
    const idx = items.findIndex(i => i.value === value);
    setHighlight(idx >= 0 ? idx : 0);
    setOpen(true);
  }

  function selectAndClose(v) {
    onChange(v);
    setOpen(false);
  }

  // All keyboard handling lives here — the trigger button keeps DOM focus the
  // whole time the menu is open, so this is the only element that needs it.
  function handleKeyDown(e) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => Math.min(h + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectAndClose(items[highlight]?.value ?? '');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  }

  return (
    <div className={styles.wrapper} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={[styles.triggerLabel, selected?.isPlaceholder && styles.placeholder].filter(Boolean).join(' ')}>
          {selected?.fullLabel ?? placeholder}
        </span>
        <span className={styles.chevron}>▾</span>
      </button>

      {open && (
        <ul className={styles.menu} role="listbox" ref={listRef}>
          {items.map((item, i) => (
            <li
              key={item.value || 'none'}
              role="option"
              aria-selected={item.value === value}
              data-active={i === highlight}
              className={[
                styles.option,
                item.isSubtask && styles.subtaskOption,
                item.isPlaceholder && styles.placeholderOption,
                i === highlight && styles.highlighted,
                item.value === value && styles.selected,
              ].filter(Boolean).join(' ')}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => selectAndClose(item.value)}
            >
              {item.isSubtask && <span className={styles.subtaskArrow}>↳</span>}
              <span className={styles.optionName}>{item.rowLabel}</span>
              {!item.isSubtask && item.courseName && (
                <CourseLabel name={item.courseName} color={item.courseColor} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
