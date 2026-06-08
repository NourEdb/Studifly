import Card from '../ui/Card';
import styles from './HeatMap.module.css';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// Interpolate from light lavender (#eae7f6) → app purple (#6C4DC4) → deep (#3d2a8a)
function cellColor(value, max) {
  if (!value || max === 0) return '#eae7f6';
  const t = Math.min(1, value / max);
  // two-stop gradient: t=0→light, t=0.5→brand purple, t=1→deep
  let r, g, b;
  if (t < 0.5) {
    const s = t / 0.5;
    r = Math.round(234 - s * (234 - 108));
    g = Math.round(231 - s * (231 - 77));
    b = Math.round(246 - s * (246 - 196));
  } else {
    const s = (t - 0.5) / 0.5;
    r = Math.round(108 - s * (108 - 61));
    g = Math.round(77  - s * (77  - 42));
    b = Math.round(196 - s * (196 - 138));
  }
  return `rgb(${r},${g},${b})`;
}

function fmtHour(h) {
  if (h === 0)  return '12am';
  if (h === 12) return '12pm';
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

function fmtMinutes(seconds) {
  if (!seconds) return 'No activity';
  const m = Math.round(seconds / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function HeatMap({ data }) {
  // Build lookup: grid[dow-1][hour] = total_seconds  (dow 1=Mon…7=Sun)
  const grid = Array.from({ length: 7 }, () => new Array(24).fill(0));
  data.forEach(({ dow, hour, total_seconds }) => {
    if (dow >= 1 && dow <= 7 && hour >= 0 && hour <= 23) {
      grid[dow - 1][hour] = total_seconds || 0;
    }
  });

  const max = Math.max(1, ...grid.flat());

  // Ticks every 3 hours
  const hourTicks = HOURS.filter(h => h % 3 === 0);

  return (
    <Card>
      <h3 className={styles.title}>Study Activity Heatmap</h3>
      <p className={styles.sub}>Most productive hours at a glance</p>

      <div className={styles.chart}>
        {/* Y-axis labels + rows */}
        <div className={styles.rows}>
          {DAYS.map((day, di) => (
            <div key={day} className={styles.row}>
              <span className={styles.dayLabel}>{day}</span>
              <div className={styles.cells}>
                {HOURS.map(hour => (
                  <div
                    key={hour}
                    className={styles.cell}
                    style={{ background: cellColor(grid[di][hour], max) }}
                    title={`${day} ${fmtHour(hour)} — ${fmtMinutes(grid[di][hour])}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* X-axis labels */}
        <div className={styles.xAxis}>
          <span className={styles.xSpacer} />
          <div className={styles.xLabels}>
            {hourTicks.map(h => (
              <span key={h} className={styles.hourLabel} style={{ left: `${(h / 24) * 100}%` }}>
                {fmtHour(h)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        <span className={styles.legendLabel}>Less</span>
        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <div
            key={t}
            className={styles.legendCell}
            style={{ background: cellColor(t * max, max) }}
          />
        ))}
        <span className={styles.legendLabel}>More</span>
      </div>
    </Card>
  );
}
