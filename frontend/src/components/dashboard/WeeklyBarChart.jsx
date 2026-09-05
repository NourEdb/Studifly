import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '../ui/Card';
import styles from './WeeklyBarChart.module.css';

// Mirrors the ISO-week (Monday-start, UTC) math in backend/utils/dateHelpers.js
// so the label matches whatever week the backend actually queried.
function isoWeekMonday(weekStr) {
  const [yearStr, weekPart] = weekStr.split('-W');
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekPart, 10);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const weekOneMonday = new Date(jan4);
  weekOneMonday.setUTCDate(jan4.getUTCDate() - (dayOfWeek - 1));
  const monday = new Date(weekOneMonday);
  monday.setUTCDate(weekOneMonday.getUTCDate() + (week - 1) * 7);
  return monday;
}

function fmtWeek(w) {
  const start = isoWeekMonday(w);
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

export default function WeeklyBarChart({ data }) {
  const chartData = data.map(d => ({
    week: fmtWeek(d.week),
    hours: parseFloat((d.total_seconds / 3600).toFixed(1)),
  }));

  return (
    <Card>
      <h3 className={styles.title}>Weekly Study Hours</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0eef8" />
          <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#7B7A99' }} interval={0} />
          <YAxis tick={{ fontSize: 12, fill: '#7B7A99' }} unit="h" />
          <Tooltip
            formatter={v => [`${v}h`, 'Study time']}
            contentStyle={{ borderRadius: 8, border: '1px solid #E8E4F3', fontSize: 13 }}
          />
          <Bar dataKey="hours" fill="#6C4DC4" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
