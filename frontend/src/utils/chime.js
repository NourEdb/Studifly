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

// Plays the user's selected chime (or a specific one, if passed), synthesized
// with the Web Audio API — no audio file needed.
export function playChime(type) {
  try {
    const c = getContext();
    if (!c) return;
    if (c.state === 'suspended') c.resume();

    const def = CHIME_DEFS[type] || CHIME_DEFS[getChimeType()];
    const { notes, toneDuration, gap, peakGain, attack } = def;

    notes.forEach((freq, i) => {
      const start = c.currentTime + i * (toneDuration + gap);
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
    });
  } catch {
    // AudioContext unsupported or blocked — skip the chime
  }
}
