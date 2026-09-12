// NOTE: function names say "ISO" for historical reasons (kept as-is to avoid
// a mechanical rename across every service that imports them), but weeks are
// defined as Sunday–Saturday here, not ISO 8601 Monday-start weeks — matching
// the app's locale (Israel). "Week 1" is the Sun–Sat week containing Jan 1.

function getISOWeekBounds(weekStr) {
  // weekStr format: YYYY-WNN  e.g. "2024-W15"
  const [yearStr, weekPart] = weekStr.split('-W');
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekPart, 10);

  const jan1 = new Date(Date.UTC(year, 0, 1));
  const jan1Day = jan1.getUTCDay(); // Sun=0..Sat=6
  const weekOneSunday = new Date(jan1);
  weekOneSunday.setUTCDate(jan1.getUTCDate() - jan1Day);

  const start = new Date(weekOneSunday);
  start.setUTCDate(weekOneSunday.getUTCDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);

  return { start: start.toISOString(), end: end.toISOString() };
}

function currentISOWeek() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const jan1Day = jan1.getUTCDay();
  const weekOneSunday = new Date(jan1);
  weekOneSunday.setUTCDate(jan1.getUTCDate() - jan1Day);
  const diff = now - weekOneSunday;
  const week = Math.floor(diff / (7 * 24 * 3600 * 1000)) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

// Returns a YYYY-MM-DD date string in UTC, offset by the given number of days
function dateStrUTC(offsetDays = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

module.exports = { getISOWeekBounds, currentISOWeek, dateStrUTC };
