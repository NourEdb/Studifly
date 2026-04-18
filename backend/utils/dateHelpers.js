function getISOWeekBounds(weekStr) {
  // weekStr format: YYYY-WNN  e.g. "2024-W15"
  const [yearStr, weekPart] = weekStr.split('-W');
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekPart, 10);

  // Jan 4 is always in week 1
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7; // Mon=1..Sun=7
  const weekOneMonday = new Date(jan4);
  weekOneMonday.setUTCDate(jan4.getUTCDate() - (dayOfWeek - 1));

  const start = new Date(weekOneMonday);
  start.setUTCDate(weekOneMonday.getUTCDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);

  return { start: start.toISOString(), end: end.toISOString() };
}

function currentISOWeek() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const weekOneMonday = new Date(jan4);
  weekOneMonday.setUTCDate(jan4.getUTCDate() - (dayOfWeek - 1));
  const diff = now - weekOneMonday;
  const week = Math.floor(diff / (7 * 24 * 3600 * 1000)) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

module.exports = { getISOWeekBounds, currentISOWeek };
