// Single shared time-of-day formatter — always 24-hour, used everywhere a
// clock time is shown (planner chips, monthly view, recent sessions, PDF
// export). Accepts either a bare "HH:MM" string (study blocks, events) or a
// full ISO datetime string (session start/end times).
export function fmtTime24(value) {
  if (!value) return '';

  if (/^\d{1,2}:\d{2}$/.test(value)) {
    const [h, m] = value.split(':');
    return `${h.padStart(2, '0')}:${m}`;
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}
