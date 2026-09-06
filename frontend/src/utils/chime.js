const CHIME_TYPE_KEY = 'studifly_chime_type';
const DEFAULT_CHIME = 'bell';

export const CHIME_OPTIONS = [
  { value: 'bell',  label: 'Bell' },
  { value: 'soft',  label: 'Soft' },
  { value: 'alert', label: 'Alert' },
];

// Each entry is a sequence of tones played back-to-back.
const CHIME_DEFS = {
  bell: {
    notes: [659.25, 880.0, 987.77], // E5, A5, B5 — ascending, hard to miss
    toneDuration: 0.55,
    gap: 0.02,
    peakGain: 0.9,
    attack: 0.03,
  },
  soft: {
    notes: [349.23, 261.63], // F4, C4 — gentle, descending
    toneDuration: 0.75,
    gap: 0.08,
    peakGain: 0.5,
    attack: 0.12,
  },
  alert: {
    notes: [880, 1046.5, 880, 1046.5], // A5, C6 repeated — fast and urgent
    toneDuration: 0.15,
    gap: 0.03,
    peakGain: 0.9,
    attack: 0.01,
  },
};

export function getChimeType() {
  const v = localStorage.getItem(CHIME_TYPE_KEY);
  return CHIME_DEFS[v] ? v : DEFAULT_CHIME;
}

export function setChimeType(type) {
  if (CHIME_DEFS[type]) {
    try { localStorage.setItem(CHIME_TYPE_KEY, type); } catch { /* storage unavailable */ }
  }
}

let ctx = null;

function getContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!ctx) ctx = new AudioCtx();
  return ctx;
}

// Browsers only allow an AudioContext to produce sound after it has been
// resumed from inside a user-gesture handler (e.g. a click). Call this from
// the Start button's onClick so later, non-gesture calls to playChime()
// (from an interval tick) are still allowed to play.
export function unlockAudio() {
  try {
    const c = getContext();
    if (c && c.state === 'suspended') c.resume();
  } catch {
    // AudioContext unsupported — chime will just no-op later
  }
}

// Builds the oscillators for one chime starting at the given AudioContext
// clock time (ctx.currentTime for "now", or ctx.currentTime + N for
// "scheduled ahead"). Returns the created oscillator nodes so a caller can
// cancel them before they play, or attach an onended hook to the last one.
function buildTones(c, startTime, type) {
  const def = CHIME_DEFS[type] || CHIME_DEFS[getChimeType()];
  const { notes, toneDuration, gap, peakGain, attack } = def;
  const oscillators = [];

  notes.forEach((freq, i) => {
    const start = startTime + i * (toneDuration + gap);
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peakGain, start + attack);
    gain.gain.setValueAtTime(peakGain, start + toneDuration - Math.min(0.15, toneDuration * 0.3));
    gain.gain.exponentialRampToValueAtTime(0.001, start + toneDuration);
    osc.connect(gain).connect(c.destination);
    osc.start(start);
    osc.stop(start + toneDuration + 0.02);
    oscillators.push(osc);
  });

  return oscillators;
}

// Plays the user's selected chime (or a specific one, if passed) right now,
// synthesized with the Web Audio API — no audio file needed.
export function playChime(type) {
  try {
    const c = getContext();
    if (!c) return;
    if (c.state === 'suspended') c.resume();
    buildTones(c, c.currentTime, type);
  } catch {
    // AudioContext unsupported or blocked — skip the chime
  }
}

// The chime currently scheduled ahead of time via scheduleChime(), if any —
// only one can be pending at once (a new call/cancel supersedes it).
let scheduledOscillators = [];

// Schedules a chime to play `delaySeconds` from now using the AudioContext's
// own clock, so it fires at the precise moment even if the tab is throttled
// or hidden (setInterval-based timing drifts in the background; the audio
// rendering graph does not). `onPlay`, if given, fires when the chime
// actually finishes playing — NOT if it's cancelled first (see
// cancelScheduledChime). Use it to mark "this already chimed" for a
// tick-loop fallback to check against.
export function scheduleChime(delaySeconds, type, onPlay) {
  try {
    const c = getContext();
    if (!c) return;
    if (c.state === 'suspended') c.resume();

    cancelScheduledChime();
    const startTime = c.currentTime + Math.max(0, delaySeconds);
    const oscillators = buildTones(c, startTime, type);
    if (onPlay && oscillators.length) {
      oscillators[oscillators.length - 1].onended = onPlay;
    }
    scheduledOscillators = oscillators;
  } catch {
    // AudioContext unsupported or blocked — the tick-loop fallback will
    // still catch a genuinely-reached threshold, just less precisely.
  }
}

// Stops whatever is currently scheduled (if it hasn't played yet) without
// firing its onPlay callback — used when a pause, stop, or phase change
// invalidates a pending schedule so it can be replaced with a fresh one.
export function cancelScheduledChime() {
  scheduledOscillators.forEach(osc => {
    osc.onended = null; // don't let a deliberate cancel look like "it played"
    try { osc.stop(0); } catch { /* already stopped or already played */ }
    try { osc.disconnect(); } catch { /* already disconnected */ }
  });
  scheduledOscillators = [];
}
