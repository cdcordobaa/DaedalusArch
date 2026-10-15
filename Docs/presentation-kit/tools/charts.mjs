// Chart helpers: horizontal proportion bars with Wilson 95% whiskers and k/n labels.
import { C, text, rect, line, wilson } from './kit.mjs';

/**
 * rows: [{ label, bold?, bars: [{ k, n, color, ci?: [lo, hi] }] }]
 * Draws a panel at (x, y) of width w. Returns [svg, height].
 */
export function pbars(x, y, w, { title, rows, labelW = 200, barH = 20, barGap = 5, rowGap = 18, valueW = 150, ticks = [0, 0.25, 0.5, 0.75, 1], fmt = (k, n) => `${k}/${n}`, axisLabel }) {
  let s = '';
  const px = x + labelW;
  const pw = w - labelW - valueW;
  let yy = y;
  if (title) {
    s += text(x, yy + 22, title, { size: 22, weight: 700 });
    yy += 44;
  }
  const y0 = yy;
  // rows first to know height
  let body = '';
  for (const r of rows) {
    const rh = r.bars.length * barH + (r.bars.length - 1) * barGap;
    if (r.sep) {
      body += line(x, yy - rowGap / 2, x + w, yy - rowGap / 2, { stroke: C.grid, sw: 1.5 });
    }
    const lines = Array.isArray(r.label) ? r.label : [r.label];
    lines.forEach((l, i) => (body += text(px - 14, yy + rh / 2 + 6 - ((lines.length - 1) * 10) + i * 20, l, { size: i === 0 ? 18 : 15, weight: r.bold && i === 0 ? 700 : 400, anchor: 'end', fill: i === 0 ? C.ink : C.muted })));
    r.bars.forEach((b, i) => {
      const by = yy + i * (barH + barGap);
      if (b.n === 0 || b.n == null) {
        body += text(px + 6, by + barH - 5, b.na ?? 'n/a', { size: 15, fill: C.muted, italic: true });
        return;
      }
      const p = b.k / b.n;
      const [lo, hi] = b.ci ?? wilson(b.k, b.n);
      body += rect(px, by, Math.max(1.5, p * pw), barH, { fill: b.color, rx: 3 });
      // whisker
      const wy = by + barH / 2;
      body += line(px + lo * pw, wy, px + hi * pw, wy, { stroke: C.ink, sw: 1.6 });
      body += line(px + lo * pw, wy - 6, px + lo * pw, wy + 6, { stroke: C.ink, sw: 1.6 });
      body += line(px + hi * pw, wy - 6, px + hi * pw, wy + 6, { stroke: C.ink, sw: 1.6 });
      body += text(px + pw + 12, by + barH - 4, b.label ?? fmt(b.k, b.n), { size: 16, weight: b.strong ? 700 : 400, fill: b.textColor ?? C.ink });
    });
    yy += rh + rowGap;
  }
  const y1 = yy - rowGap + 6;
  // grid
  for (const t of ticks) {
    const gx = px + t * pw;
    s += line(gx, y0 - 6, gx, y1, { stroke: t === 0 ? C.faint : C.grid, sw: 1 });
    s += text(gx, y1 + 22, t === 0 ? '0' : t === 1 ? '1.0' : String(t), { size: 15, fill: C.muted, anchor: 'middle' });
  }
  if (axisLabel) s += text(px + pw / 2, y1 + 46, axisLabel, { size: 15, fill: C.muted, anchor: 'middle' });
  s += body;
  return [s, y1 + (axisLabel ? 56 : 30) - y];
}

/** Legend items: [[color, label], ...] laid out in a row. Returns [svg, width]. */
export function legendRow(x, y, items, size = 17) {
  let s = '';
  let cx = x;
  for (const [col, lab, kind] of items) {
    if (kind === 'line') s += line(cx, y - 6, cx + 30, y - 6, { stroke: col, sw: 3 });
    else s += rect(cx, y - 15, 22, 18, { rx: 3, fill: col });
    s += text(cx + (kind === 'line' ? 38 : 30), y, lab, { size });
    cx += (kind === 'line' ? 38 : 30) + lab.length * size * 0.53 + 30;
  }
  return [s, cx - x];
}

export const whiskerNote = 'Bars: proportion; whiskers: 95% Wilson interval.';
