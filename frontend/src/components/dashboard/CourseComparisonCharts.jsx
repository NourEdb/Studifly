import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer,
  PieChart, Pie, Legend,
} from 'recharts';
import Card from '../ui/Card';
import styles from './CourseComparisonCharts.module.css';

function fmtHours(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const TICK_STYLE = { fontSize: 11, fill: '#7B7A99' };
const TOOLTIP_STYLE = { borderRadius: 8, border: '1px solid #E8E4F3', fontSize: 13 };

function BarTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <strong>{payload[0].payload.name}</strong>
      <span>{fmtHours(payload[0].payload.total_seconds)}</span>
    </div>
  );
}

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className={styles.tooltip}>
      <strong>{d.name}</strong>
      <span>{fmtHours(d.total_seconds)} · {d.pct}%</span>
    </div>
  );
}

function renderPieLabel({ cx, cy, midAngle, innerRadius, outerRadius, pct }) {
  if (pct < 5) return null; // skip tiny slices
  const RAD = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + r * Math.cos(-midAngle * RAD);
  const y = cy + r * Math.sin(-midAngle * RAD);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {pct}%
    </text>
  );
}

export default function CourseComparisonCharts({ data }) {
  if (!data?.length) return null;

  const totalSeconds = data.reduce((s, c) => s + c.total_seconds, 0);

  const barData = data.map(c => ({
    name: c.course_name,
    hours: parseFloat((c.total_seconds / 3600).toFixed(1)),
    total_seconds: c.total_seconds,
    color: c.color,
  }));

  const pieData = data.map(c => ({
    name: c.course_name,
    value: c.total_seconds,
    total_seconds: c.total_seconds,
    pct: totalSeconds > 0 ? Math.round((c.total_seconds / totalSeconds) * 100) : 0,
    color: c.color,
  }));

  return (
    <Card>
      <h3 className={styles.title}>Course Comparison</h3>
      <p className={styles.sub}>All-time study time across courses</p>

      <div className={styles.grid}>
        {/* Bar chart — total hours */}
        <div className={styles.chartWrap}>
          <p className={styles.chartLabel}>Total Hours</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} margin={{ top: 4, right: 8, left: -16, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0eef8" />
              <XAxis
                dataKey="name"
                tick={{ ...TICK_STYLE, width: 80 }}
                interval={0}
                angle={-35}
                textAnchor="end"
              />
              <YAxis tick={TICK_STYLE} unit="h" />
              <Tooltip content={<BarTooltip />} contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Donut chart — percentage share */}
        <div className={styles.chartWrap}>
          <p className={styles.chartLabel}>Time Share</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="45%"
                innerRadius="38%"
                outerRadius="68%"
                dataKey="value"
                labelLine={false}
                label={renderPieLabel}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={v => <span style={{ fontSize: 11, color: '#7B7A99' }}>{v}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}
