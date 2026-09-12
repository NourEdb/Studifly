import { useState, useRef } from 'react';
import styles from './FocusSoundsPanel.module.css';

const STORAGE_KEY = 'studifly_focus_sound';

const PRESETS = [
  { id: 'rain',  label: 'Rain',          emoji: '🌧️', youtubeId: 'BSmYxnvUDHw' },
  { id: 'white', label: 'White noise',   emoji: '📻', youtubeId: 'nMfPqeZjc2c' },
  { id: 'brown', label: 'Brown noise',   emoji: '🟤', youtubeId: 'IOijfCTQPGQ' },
  { id: 'cafe',  label: 'Café ambience', emoji: '☕', youtubeId: 'h2zkV-l_TbY' },
];

function loadRemembered() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const val = JSON.parse(raw);
    if (val?.type === 'preset' && PRESETS.some(p => p.id === val.id)) return val;
    if (val?.type === 'custom' && typeof val.videoId === 'string') return val;
    return null;
  } catch { return null; }
}

function saveRemembered(choice) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(choice)); } catch { /* ignore */ }
}

// Accepts a raw 11-char video id, or a full watch/share/embed URL.
function extractYoutubeId(input) {
  const trimmed = input.trim();
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname.includes('youtu.be')) return url.pathname.slice(1);
    if (url.pathname.startsWith('/embed/')) return url.pathname.replace('/embed/', '');
    const v = url.searchParams.get('v');
    if (v) return v;
  } catch { /* not a URL */ }
  return null;
}

export default function FocusSoundsPanel() {
  // 'closed' — small headphone FAB only (nothing loaded).
  // 'open'   — full panel with presets/custom input.
  // 'mini'   — small pill (sound name + pause/play) while a sound is loaded in the background.
  const [view, setView] = useState('closed');
  const [choice, setChoice] = useState(loadRemembered);
  const [loaded, setLoaded] = useState(false);
  const [paused, setPaused] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [customError, setCustomError] = useState('');
  const iframeRef = useRef(null);

  const activeVideoId = choice?.type === 'preset'
    ? PRESETS.find(p => p.id === choice.id)?.youtubeId
    : choice?.type === 'custom' ? choice.videoId : null;

  const activeLabel = choice?.type === 'preset'
    ? PRESETS.find(p => p.id === choice.id)?.label
    : choice?.type === 'custom' ? 'Custom sound' : '';

  // Sends a play/pause command to the already-embedded iframe via the raw
  // postMessage protocol the YouTube player listens for when enablejsapi=1
  // is set — no youtube iframe API script/package needed.
  function postCommand(func) {
    try {
      iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*');
    } catch { /* ignore */ }
  }

  function loadChoice(next) {
    setChoice(next);
    saveRemembered(next);
    setCustomError('');
    setLoaded(true);
    setPaused(false);
  }

  function playPreset(preset) {
    const isCurrent = choice?.type === 'preset' && choice.id === preset.id;
    if (isCurrent && loaded) {
      // Same video already mounted (possibly paused) — resume it in place
      // instead of reloading it from the beginning.
      postCommand('playVideo');
      setPaused(false);
      return;
    }
    loadChoice({ type: 'preset', id: preset.id });
  }

  function handlePlayClick() {
    const trimmed = customInput.trim();
    if (!trimmed) {
      // Nothing typed in the custom field — play/resume whichever preset
      // (or previous custom link) is currently selected.
      if (!choice) { setCustomError('Choose a preset or enter a YouTube link'); return; }
      if (loaded) { postCommand('playVideo'); setPaused(false); }
      else { loadChoice(choice); }
      return;
    }
    const videoId = extractYoutubeId(trimmed);
    if (!videoId) { setCustomError('Enter a valid YouTube link or video ID'); return; }
    loadChoice({ type: 'custom', videoId });
  }

  function handleCustomChange(e) {
    const val = e.target.value;
    setCustomInput(val);
    if (!val.trim()) setCustomError('');
  }

  function togglePause() {
    if (!loaded) return;
    if (paused) { postCommand('playVideo'); setPaused(false); }
    else { postCommand('pauseVideo'); setPaused(true); }
  }

  function handleClose() {
    setLoaded(false);
    setPaused(false);
    setView('closed');
  }

  function minimize() {
    setView('mini');
  }

  return (
    <div className={styles.wrap}>
      {view === 'closed' && (
        <button
          className={styles.fab}
          onClick={() => setView('open')}
          aria-label="Open focus sounds"
          title="Focus sounds"
        >
          🎧
        </button>
      )}

      {view === 'mini' && (
        <button className={styles.pill} onClick={() => setView('open')} title="Expand focus sounds">
          <span className={styles.pillLabel}>🎧 {activeLabel}</span>
          <span
            className={styles.pillStop}
            role="button"
            aria-label={paused ? 'Play' : 'Pause'}
            title={paused ? 'Play' : 'Pause'}
            onClick={e => { e.stopPropagation(); togglePause(); }}
          >
            {paused ? '▶' : '⏸'}
          </span>
        </button>
      )}

      {/* Kept mounted (just hidden) whenever a sound is loaded, so switching
          between 'open' and 'mini', or pausing, never reloads the iframe. */}
      <div className={[styles.panel, view === 'open' ? '' : styles.panelHidden].join(' ')}>
        <div className={styles.header}>
          <span className={styles.title}>Focus sounds</span>
          <div className={styles.headerBtns}>
            {loaded && (
              <button className={styles.minimizeBtn} onClick={minimize} aria-label="Minimize focus sounds" title="Minimize">–</button>
            )}
            <button className={styles.closeBtn} onClick={handleClose} aria-label="Stop and close focus sounds" title="Stop">✕</button>
          </div>
        </div>

        <div className={styles.presets}>
          {PRESETS.map(p => (
            <button
              key={p.id}
              className={[styles.presetBtn, choice?.type === 'preset' && choice.id === p.id ? styles.presetActive : ''].join(' ')}
              onClick={() => playPreset(p)}
            >
              <span>{p.emoji}</span> {p.label}
            </button>
          ))}
        </div>

        <div className={styles.customRow}>
          <input
            className={styles.customInput}
            type="text"
            placeholder="Custom YouTube link"
            value={customInput}
            onChange={handleCustomChange}
            onKeyDown={e => { if (e.key === 'Enter') handlePlayClick(); }}
          />
          <button className={styles.customBtn} onClick={handlePlayClick}>Play</button>
        </div>
        {customError && <p className={styles.error}>{customError}</p>}

        {loaded && activeVideoId && (
          <div className={styles.player}>
            <iframe
              key={activeVideoId}
              ref={iframeRef}
              width="100%"
              height="150"
              src={`https://www.youtube.com/embed/${activeVideoId}?autoplay=1&rel=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
              title="Focus sound player"
              frameBorder="0"
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
            <button className={styles.stopBtn} onClick={togglePause}>
              {paused ? '▶ Play' : '⏸ Pause'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
