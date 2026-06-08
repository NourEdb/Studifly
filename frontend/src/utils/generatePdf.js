import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { getSessions } from '../api/sessions.api';
import { getTasks } from '../api/tasks.api';

// ── constants ─────────────────────────────────────────────────────────────────
const PW = 210;
const PH = 297;
const M  = 15;
const CW = PW - M * 2; // 180 mm

const C = {
  purple: [108, 77,  196],
  text:   [26,  16,  64],
  muted:  [123, 122, 153],
  white:  [255, 255, 255],
  green:  [52,  198, 138],
  blue:   [74,  159, 224],
  red:    [232, 84,  84],
  gold:   [245, 166, 35],
};

// ── jsPDF helpers ─────────────────────────────────────────────────────────────
function maybeNewPage(doc, y, needed) {
  if (y + needed > PH - M) { doc.addPage(); return M + 5; }
  return y;
}

function sectionTitle(doc, y, title) {
  y = maybeNewPage(doc, y, 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...C.text);
  doc.text(title, M, y);
  doc.setDrawColor(...C.purple);
  doc.setLineWidth(0.4);
  doc.line(M, y + 1.5, M + doc.getTextWidth(title), y + 1.5);
  return y + 8;
}

// ── html2canvas capture helpers ───────────────────────────────────────────────
async function captureElement(el) {
  if (!el) return null;
  const canvas = await html2canvas(el, {
    scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false,
  });
  return { dataUrl: canvas.toDataURL('image/png'), w: canvas.width, h: canvas.height };
}

// Renders an HTML table off-screen and returns it as an image.
// colFractions: relative widths e.g. [3, 2, 6, 2.5]
// The browser handles all Unicode (Hebrew, etc.) correctly via its own text engine.
async function renderTableToImage(headers, colFractions, rows) {
  const RENDER_WIDTH = 900; // px — wide enough for crisp text at scale 2
  const gridCols = colFractions.map(f => `${f}fr`).join(' ');

  const wrap = document.createElement('div');
  wrap.style.cssText = [
    'position:absolute', 'left:-9999px', 'top:0',
    `width:${RENDER_WIDTH}px`,
    'background:#fff',
    'font-family:Inter,system-ui,sans-serif',
    'font-size:13px',
    'line-height:1.4',
    'border-radius:8px',
    'overflow:hidden',
    'border:1px solid #E8E4F3',
  ].join(';');

  // header row
  const hdr = document.createElement('div');
  hdr.style.cssText = `display:grid;grid-template-columns:${gridCols};background:#6C4DC4;`;
  headers.forEach(h => {
    const cell = document.createElement('div');
    cell.style.cssText = 'padding:9px 12px;color:#fff;font-weight:600;font-size:13px;';
    cell.textContent = h;
    hdr.appendChild(cell);
  });
  wrap.appendChild(hdr);

  // empty-state row
  if (rows.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'padding:12px;color:#7B7A99;font-size:13px;text-align:center;';
    empty.textContent = 'No data';
    wrap.appendChild(empty);
  }

  // data rows
  rows.forEach((row, ri) => {
    const rowEl = document.createElement('div');
    rowEl.style.cssText = [
      `display:grid`, `grid-template-columns:${gridCols}`,
      `background:${ri % 2 === 0 ? '#F8F7FF' : '#fff'}`,
    ].join(';');
    row.forEach(cell => {
      const cellEl = document.createElement('div');
      cellEl.style.cssText = [
        'padding:8px 12px',
        'color:#1A1040',
        'font-size:13px',
        'border-bottom:1px solid #E8E4F3',
        'word-break:break-word',
      ].join(';');
      cellEl.textContent = String(cell ?? '—');
      rowEl.appendChild(cellEl);
    });
    wrap.appendChild(rowEl);
  });

  document.body.appendChild(wrap);
  try {
    const canvas = await html2canvas(wrap, {
      scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false,
    });
    return { dataUrl: canvas.toDataURL('image/png'), w: canvas.width, h: canvas.height };
  } finally {
    document.body.removeChild(wrap);
  }
}

function addImage(doc, img, y) {
  if (!img) return y;
  const imgH = (img.h / img.w) * CW;
  y = maybeNewPage(doc, y, imgH);
  doc.addImage(img.dataUrl, 'PNG', M, y, CW, imgH);
  return y + imgH + 6;
}

// ── formatters ────────────────────────────────────────────────────────────────
function fmtHours(s)    { const h = Math.floor(s/3600), m = Math.floor((s%3600)/60); return h > 0 ? `${h}h ${m}m` : `${m}m`; }
function fmtDuration(s) { if (!s) return '—'; const m = Math.round(s/60); return m < 60 ? `${m} min` : `${Math.floor(m/60)}h ${m%60}m`; }
function fmtDate(iso)   { return iso ? new Date(iso).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—'; }
function fmtTime(iso)   { return iso ? new Date(iso).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : ''; }
function fmtStatus(s)   { return { pending:'Pending', in_progress:'In Progress', completed:'Done' }[s] ?? s; }
function fmtPlanned(m)  { if (!m) return '—'; const h = Math.floor(m/60); return h > 0 ? `${h}h ${m%60}m` : `${m}m`; }

// ── main export ───────────────────────────────────────────────────────────────
export async function generateDashboardPdf({ user, summary, chartEl, heatmapEl }) {
  // Fetch data and capture all visuals in parallel
  const [sessions, tasks, chartImg, heatmapImg] = await Promise.all([
    getSessions({ limit: 15 }),
    getTasks(),
    captureElement(chartEl),
    captureElement(heatmapEl),
  ]);

  // Render tables as images (browser handles Unicode text)
  const [sessionsImg, tasksImg] = await Promise.all([
    renderTableToImage(
      ['Date', 'Time', 'Task', 'Duration'],
      [2.5, 1.5, 5, 2],
      sessions.slice(0, 15).map(s => [
        fmtDate(s.start_time), fmtTime(s.start_time), s.task_name || 'No task', fmtDuration(s.duration),
      ])
    ),
    renderTableToImage(
      ['Task', 'Course', 'Status', 'Planned', 'Actual'],
      [4, 3, 2, 1.5, 1.5],
      tasks.map(t => [
        t.name, t.course_name || '—', fmtStatus(t.status),
        fmtPlanned(t.planned_time), fmtDuration(t.sessions?.total_seconds),
      ])
    ),
  ]);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const dateStr = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  // ── header bar ───────────────────────────────────────────────────────────────
  doc.setFillColor(...C.purple);
  doc.rect(0, 0, PW, 28, 'F');
  doc.setTextColor(...C.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Studifly', M, 19);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Study Report', M + doc.getTextWidth('Studifly') + 6, 19);
  doc.setFontSize(9);
  doc.text(`${user.username}  ·  ${dateStr}`, PW - M, 19, { align: 'right' });

  let y = 38;

  // ── summary stats ─────────────────────────────────────────────────────────────
  y = sectionTitle(doc, y, "This Week's Summary");
  const statW = (CW - 9) / 4;
  const statH = 20;
  [
    { label: 'Study Hours',     value: fmtHours(summary.weekly_seconds),                                  color: C.purple },
    { label: 'Tasks Completed', value: `${summary.task_counts.completed} / ${summary.total_tasks}`,       color: C.green  },
    { label: 'Completion Rate', value: `${summary.completion_rate}%`,                                     color: C.blue   },
    { label: 'Overdue Tasks',   value: String(summary.overdue_count), color: summary.overdue_count > 0 ? C.red : C.gold   },
  ].forEach((s, i) => {
    const sx = M + i * (statW + 3);
    doc.setFillColor(...s.color);
    doc.roundedRect(sx, y, statW, statH, 2.5, 2.5, 'F');
    doc.setTextColor(...C.white);
    doc.setFont('helvetica', 'bold');  doc.setFontSize(15);
    doc.text(s.value, sx + statW / 2, y + 11, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
    doc.text(s.label, sx + statW / 2, y + 17, { align: 'center' });
  });
  y += statH + 10;

  // ── charts ────────────────────────────────────────────────────────────────────
  if (chartImg) {
    y = sectionTitle(doc, y, 'Weekly Study Hours');
    y = addImage(doc, chartImg, y);
  }
  if (heatmapImg) {
    y = sectionTitle(doc, y, 'Study Activity Heatmap');
    y = addImage(doc, heatmapImg, y);
  }

  // ── tables (rendered as images — preserves Unicode/Hebrew text) ───────────────
  y = sectionTitle(doc, y, 'Recent Sessions');
  y = addImage(doc, sessionsImg, y);

  y = sectionTitle(doc, y, 'Tasks');
  addImage(doc, tasksImg, y);

  // ── footer on every page ──────────────────────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...C.muted);
    doc.text(`Studifly · Generated ${dateStr}`, M, PH - 8);
    doc.text(`${p} / ${pageCount}`, PW - M, PH - 8, { align: 'right' });
  }

  doc.save(`studifly-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}
