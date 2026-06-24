import {
  ComposedChart, Line, Bar,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import Card from '../ui/Card';
import styles from './MoodCorrelationChart.module.css';

function fmtDate(dateStr) {
  // checkin_date comes back as 'YYYY-MM-DD'; use noon to avoid timezone day shift
  const d = new Date(dateStr.slice(0, 10) + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const mood    = payload.find(p => p.dataKey === 'mood_score')?.value;
  const energy  = payload.find(p => p.dataKey === 'energy_score')?.value;
  const minutes = payload.find(p => p.dataKey === 'study_minutes')?.value;
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipDate}>{label}</p>
      {mood    != null && <p className={styles.tooltipMood}>   Mood:     {mood}/5</p>}
      {energy  != null && <p className={styles.tooltipEnergy}> Energy:   {energy}/5</p>}
      {minutes != null && <p className={styles.tooltipMins}>   Studied:  {minutes}m</p>}
    </div>
  );
}

export default function MoodCorrelationChart({ data }) {
  if (!data || data.length < 3) return null;

  const chartData = data.map(d => ({
    date:          fmtDate(d.checkin_date),
    mood_score:    Number(d.mood_score),
    energy_score:  Number(d.energy_score),
    study_minutes: Number(d.study_minutes),
  }));

  return (
    <Card>
      <h3 className={styles.title}>Mood &amp; Productivity Correlation</h3>
      <p className={styles.sub}>Daily mood, energy and study time</p>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0eef8" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#7B7A99' }} />
          <YAxis
            yAxisId="score"
            orientation="left"
            domain={[1, 5]}
            ticks={[1, 2, 3, 4, 5]}
            tick={{ fontSize: 11, fill: '#7B7A99' }}
            width={28}
          />
          <YAxis
            yAxisId="mins"
            orientation="right"
            tick={{ fontSize: 11, fill: '#7B7A99' }}
            unit="m"
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconSize={10}
            wrapperStyle={{ fontSize: 12, color: '#7B7A99', paddingTop: 8 }}
            formatter={key => key === 'mood_score' ? 'Mood' : key === 'energy_score' ? 'Energy' : 'Study mins'}
          />
          <Bar
            yAxisId="mins"
            dataKey="study_minutes"
            name="study_minutes"
            fill="#34C68A"
            fillOpacity={0.55}
            radius={[3, 3, 0, 0]}
          />
          <Line
            yAxisId="score"
            dataKey="mood_score"
            name="mood_score"
            stroke="#6C4DC4"
            strokeWidth={2}
            dot={{ r: 4, fill: '#6C4DC4' }}
            activeDot={{ r: 5 }}
          />
          <Line
            yAxisId="score"
            dataKey="energy_score"
            name="energy_score"
            stroke="#4A9FE0"
            strokeWidth={2}
            dot={{ r: 4, fill: '#4A9FE0' }}
            activeDot={{ r: 5 }}
            strokeDasharray="4 3"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}
