import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '../ui/Card';
import styles from './WeeklyBarChart.module.css';

function fmtWeek(w) {
  const [, wn] = w.split('-W');
  return `W${wn}`;
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
          <XAxis dataKey="week" tick={{ fontSize: 12, fill: '#7B7A99' }} />
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
