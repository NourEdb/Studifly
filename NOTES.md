# Studifly — Round Summary (2026-09-13)

Follow-up fixes to the previous round's task ordering and Focus sounds features. (Previous round's break-timer summary below is unchanged and still accurate.)

## 1. Task ordering — fixed and finalized

**What was wrong:** a new task's `sort_order` was `NULL`, and the frontend's `add()` optimistically prepended the freshly-created task to the top of the in-memory list instead of waiting for the server's real order — so new tasks always visually appeared at the top regardless of due date. There was also no way to drop a custom drag order once set, and pages other than Tasks (course detail, task pickers) had no explicit guarantee they'd stay on the plain due-date rule if a custom order existed.

**Fixed default order** for the non-completed group (unchanged when nobody has ever dragged): due-date tasks first, soonest due date first; then no-due-date tasks, newest created first. Completed tasks are unchanged — pinned at the bottom, newest-completed first, non-draggable.

**New tasks now insert correctly in both modes:**
- If the user has never dragged anything, the new task simply falls into place via the due-date rule above (no `sort_order` needed).
- If the user *has* established a custom drag order, the backend now merges the new task into that existing order at the position the due-date rule would give it (comparing its due date/created-at against the already-ordered tasks), then re-locks the whole arrangement with fresh sequential `sort_order` values. It never lands at the very top or bottom just because it's new.

**"Reset to due-date order":** a small text link next to the Tasks page filters clears every one of the user's `sort_order` values, which drops back to the pure due-date/newest-created default.

**Other listings now explicitly ignore the custom drag order:** Tracker and Planner pages (which power the task/subtask selectors in the timer, manual entry, and study-block forms) now request `?ignore_order=1`, so they always show the plain due-date-then-newest rule regardless of whatever arrangement the user has dragged into on the Tasks page. The course detail panel's task list already used its own independent due-date query (no `sort_order` involved), so no change was needed there.

**Files changed:**
- `backend/services/tasks.service.js`:
  - `getAll()` now honors an `ignore_order` filter that skips `sort_order` entirely and applies the plain due-date-then-newest rule.
  - New `compareByDueDateRule(a, b)` comparator (due date ascending, no-due-date tasks after, ties broken by newest-created-first).
  - New `insertIntoCustomOrder(userId, newTask)` — merges a newly created task into an existing custom order at its due-date-correct position, only when a custom order actually exists.
  - `create()` calls `insertIntoCustomOrder()` for non-completed tasks.
  - New `resetOrder(userId)` — clears `sort_order` for all of a user's tasks.
- `backend/controllers/tasks.controller.js` — added `resetOrder` controller.
- `backend/routes/tasks.routes.js` — added `PATCH /tasks/reset-order`.
- `frontend/src/api/tasks.api.js` — added `resetTaskOrder()`.
- `frontend/src/hooks/useTasks.js` — `add()` now refetches instead of optimistically prepending the new task; added `resetOrder()`.
- `frontend/src/pages/TasksPage.jsx` — passes `resetOrder` down to `TaskList`.
- `frontend/src/pages/TrackerPage.jsx`, `frontend/src/pages/PlannerPage.jsx` — request `{ ignore_order: 1 }` so their task selectors always use the plain due-date rule.
- `frontend/src/components/tasks/TaskList.jsx` — added the "Reset to due-date order" link and its handler.
- `frontend/src/components/tasks/TaskList.module.css` — styles for the reset link.

**No new migration** — reuses the existing nullable `sort_order` column from the previous round.

**Test checklist:**
- Fresh account, create a few tasks with mixed due dates (some none) → order matches: earliest due date first, then no-due-date tasks newest-created-first, with no drags at all.
- Create a new task with an earlier due date than everything else → it correctly appears at the top (that's the due-date rule working, not a bug).
- Drag tasks into a custom order on the Tasks page, then create a new task with a due date that should slot into the *middle* of that custom order → confirm it lands there, not at the top or bottom.
- Create a new task with no due date after establishing a custom order → confirm it's inserted per the newest-created-first rule relative to the other no-due-date tasks in that order, not just tacked onto the very end.
- Click "Reset to due-date order" → confirms via toast, and the list reverts to the pure due-date/newest default; refresh the page to confirm it stuck.
- With a custom drag order set on the Tasks page, open the Tracker page's task selector and the Planner's task list → both show the plain due-date order, not the dragged one.
- Completed tasks still sit at the bottom, newest-completed-first, unaffected by any of the above.

## 2. Focus sounds — Lo-fi removed, minimize added (2026-09-13)

- Removed the **Lo-fi** preset entirely (no replacement) — the panel now offers 4 presets: Rain, White noise, Brown noise, Café ambience.
- Added a **minimize** option: while a sound is playing, clicking the panel's collapse (✕) button now shrinks it to a small floating pill (bottom-right) showing the preset/sound name and a stop button, instead of returning to the plain headphone icon. Clicking the pill re-expands the full panel. The underlying YouTube `<iframe>` is kept mounted the entire time (visibility is toggled via CSS `display:none` on the panel container, never unmounted), so playback is uninterrupted across open ⇄ minimized transitions. When nothing is playing, collapsing still returns to the plain headphone icon as before, and "Stop" always fully closes back to that icon too.

*(Superseded in part by the follow-up below — the ✕/minimize split described here was reworked into an explicit "–" button plus a real pause instead of stop.)*

## 3. Focus sounds follow-up — play/resume bug, real pause, explicit minimize button

**Play/resume bug fixed:** clicking "Play" next to the custom-link field used to always validate the custom text field, so it showed "Enter a valid YouTube link or video ID" even when a preset was already selected and the field was just empty. The Play button now only validates the custom field when the user actually typed something in it; if it's empty, it plays (or resumes) whatever preset/link is currently selected instead. Clicking an already-highlighted preset button again now also (re)plays it, resuming in place rather than doing nothing or erroring.

**Real pause instead of stop:** the red button (panel and pill) is now a genuine pause/resume control, not a stop. The iframe loads with `enablejsapi=1` (and an `origin` param) and is controlled via the raw YouTube postMessage command protocol (`{"event":"command","func":"playVideo"/"pauseVideo"}`) sent straight to the iframe's `contentWindow` — no YouTube IFrame API script or package is loaded. Pausing keeps the iframe mounted (so resuming continues from where it left off instead of restarting); the button's icon swaps to a play icon (▶) while paused and back to a pause icon (⏸) while playing. The same toggle appears both in the panel and on the minimized pill. Switching to a *different* preset or link still reloads the iframe from the beginning (expected — it's a different video), but re-selecting the *same* one just resumes it.

**Explicit minimize button:** the panel header now has two controls whenever a sound is loaded: a new "–" button that minimizes to the pill (keeping playback/pause state as-is), and "✕" which now unambiguously stops playback, unmounts the iframe, and returns to the plain headphone icon. Previously "✕" alone did double duty as both minimize and stop depending on state, which is what this button split cleans up.

**Inline error cleanup:** the custom-link field's error message now clears automatically as soon as the field is cleared (not just after a successful play), so it doesn't linger onscreen next to an empty input.

**Files changed:**
- `frontend/src/components/focus/FocusSoundsPanel.jsx` — replaced the `playing` boolean with `loaded` (iframe mounted) + `paused` (playing vs. paused within that mount); added an `iframeRef` and `postCommand(func)` for the postMessage play/pause protocol; `playPreset()` now resumes-in-place for the already-selected preset instead of always reloading; `handlePlayClick()` (renamed from `playCustom()`) falls back to playing/resuming the current `choice` when the custom field is empty, only validating typed input; `handleCustomChange()` clears `customError` as soon as the field is emptied; added `togglePause()`, `minimize()`, and `handleClose()` (full stop + unmount + back to the headphone icon); header now renders a "–" minimize button (only while `loaded`) alongside "✕"; the iframe `src` gains `enablejsapi=1&origin=...`.
- `frontend/src/components/focus/FocusSoundsPanel.module.css` — added `.headerBtns` and `.minimizeBtn` (styled like the existing `.closeBtn`); no changes to the existing red pause/stop button styling (`.stopBtn`, `.pillStop`), which is reused as-is per the "keep the same red control" instruction — only its label/icon and behavior changed in the component.

**Test checklist:**
- Play a preset, click ✕ to stop, then click "Play" (with the custom field empty) → it replays the same preset instead of showing a validation error.
- Click an already-highlighted preset again while it's playing or paused → it (re)plays/resumes instead of doing nothing.
- Play a preset, then click the red pause button → audio pauses, icon swaps to ▶, iframe stays mounted (check via dev tools that it isn't removed/re-added).
- Click the same button again (now showing ▶) → resumes from where it paused, not from the beginning.
- Pause, then minimize with "–" → pill shows with a ▶ icon; click the pill's ▶ → resumes; click the pill itself (not the icon) → expands the full panel, still paused/playing state preserved correctly.
- While a sound is loaded, click "✕" → playback stops, iframe is unmounted, panel returns to the plain headphone icon (confirm via dev tools that the iframe element is gone).
- Type an invalid value into the custom field and click Play → inline error appears; clear the field → error disappears immediately without needing another click.
- Switch from one preset to a different one while the first is playing → the new preset loads and plays from the start (expected, since it's a different video).
- Check both dark and light mode for the new "–" button and the unchanged pause/pill styling.

## Previous round (2026-09-12) — unchanged, for reference

### Break timer after sessions

When a **free-timer** session (not Pomodoro) is stopped, saved, and reflected on, the user is offered an optional break: 5 / 10 / 15 min presets or a custom minute value. The countdown lives in `TimerContext` (survives navigation/refresh) and uses the same Web Audio API clock-scheduled chime mechanism as the rest of the timer. One idea from a small built-in list is shown at random. When the break ends, a chime + notification fire and a "Start next session" button appears. Skipping/ending early is one click. Break time is never sent to the backend as study time. Pomodoro sessions are unaffected.

Files: `frontend/src/context/TimerContext.jsx`, `frontend/src/hooks/useTimer.js`, `frontend/src/components/timer/TimerWidget.jsx` (+ `.module.css`).

## Migrations

- `025_task_sort_order.sql` (previous round) — adds nullable `sort_order INTEGER` to `tasks`. No new migration this round.

## Full file list (this round)

**Backend:**
- `backend/services/tasks.service.js`
- `backend/controllers/tasks.controller.js`
- `backend/routes/tasks.routes.js`

**Frontend:**
- `frontend/src/api/tasks.api.js`
- `frontend/src/hooks/useTasks.js`
- `frontend/src/pages/TasksPage.jsx`
- `frontend/src/pages/TrackerPage.jsx`
- `frontend/src/pages/PlannerPage.jsx`
- `frontend/src/components/tasks/TaskList.jsx`
- `frontend/src/components/tasks/TaskList.module.css`
- `frontend/src/components/focus/FocusSoundsPanel.jsx`
- `frontend/src/components/focus/FocusSoundsPanel.module.css`

Both `npm run build` (frontend) and `node --check` (backend, all touched files) passed after these changes.
