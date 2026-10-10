// Shared by WeeklyBarChart and the Dashboard's "This week" stat card so both
// render the exact same date-range label for a given backend week string.
// Mirrors the week math (Sunday-start, UTC) in backend/utils/dateHelpers.js.

function weekStartSunday(weekStr) {
  const [yearStr, weekPart] = weekStr.split('-W');
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekPart, 10);
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const jan1Day = jan1.getUTCDay();
  const weekOneSunday = new Date(jan1);
  weekOneSunday.setUTCDate(jan1.getUTCDate() - jan1Day);
  const sunday = new Date(weekOneSunday);
  sunday.setUTCDate(weekOneSunday.getUTCDate() + (week - 1) * 7);
  return sunday;
}

// weekStr format: "YYYY-WNN" (e.g. "2026-W41") -> "Oct 4–10" (or "Oct 28–Nov 3"
// when the week spans two months).
export function fmtWeek(weekStr) {
  const start = weekStartSunday(weekStr);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  const startMonth = start.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();

  return startMonth === endMonth
    ? `${startMonth} ${startDay}–${endDay}`
    : `${startMonth} ${startDay}–${endMonth} ${endDay}`;
}
