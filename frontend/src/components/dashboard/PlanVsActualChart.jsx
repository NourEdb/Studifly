import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Card from '../ui/Card';
import styles from './PlanVsActualChart.module.css';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function fmtDay(dateStr) {
  // Use noon local time to avoid any day-boundary timezone shift
  return DAY_NAMES[new Date(dateStr + 'T12:00:00').getDay()];
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const planned = payload.find(p => p.dataKey === 'planned_minutes')?.value ?? 0;
  const actual  = payload.find(p => p.dataKey === 'actual_minutes')?.value ?? 0;
  const pct = planned > 0 ? Math.round(actual / planned * 100) : 0;

  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipLabel}>{label}</p>
      <p className={styles.tooltipPlanned}>Planned: {planned}m</p>
      <p className={styles.tooltipActual}>Actual: {actual}m</p>
      {planned > 0 && <p className={styles.tooltipPct}>{pct}% completed</p>}
    </div>
  );
}

export default function PlanVsActualChart({ data }) {
  if (!data || data.length === 0) return null;

  const chartData = data.map(d => ({
    day:              fmtDay(d.date),
    planned_minutes:  d.planned_minutes,
    actual_minutes:   d.actual_minutes,
  }));

  return (
    <Card>
      <h3 className={styles.title}>Study Plan vs Reality</h3>
      <p className={styles.sub}>This week · minutes per day</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0eef8" />
          <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#7B7A99' }} />
          <YAxis tick={{ fontSize: 12, fill: '#7B7A99' }} unit="m" />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="square"
            iconSize={10}
            formatter={name => name === 'planned_minutes' ? 'Planned' : 'Actual'}
            wrapperStyle={{ fontSize: 12, color: '#7B7A99', paddingTop: 8 }}
          />
          <Bar dataKey="planned_minutes" name="planned_minutes" fill="#6C4DC4" radius={[4, 4, 0, 0]} />
          <Bar dataKey="actual_minutes"  name="actual_minutes"  fill="#34C68A" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
