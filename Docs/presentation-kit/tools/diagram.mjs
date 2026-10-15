// Small helpers for box-and-arrow diagrams.
import { C, text, rect, wrap, esc, FONT } from './kit.mjs';

/** A titled box. lines: plain strings (wrapped). Returns svg. */
export function box(x, y, w, h, o = {}) {
  const { title, lines = [], color = C.ink, fill = '#FFFFFF', size = 17, titleSize = 20, dash, icon, align = 'start' } = o;
  let s = rect(x, y, w, h, { rx: 12, fill, stroke: color, sw: 2, dash });
  let ty = y + 34;
  const tx = align === 'middle' ? x + w / 2 : x + 18;
  if (title) {
    for (const l of wrap(title, w - 36, titleSize, 700)) {
      s += text(tx, ty, l, { size: titleSize, weight: 700, fill: color === C.ink ? C.ink : color, anchor: align });
      ty += titleSize * 1.25;
    }
    ty += 4;
  }
  for (const para of lines) {
    for (const l of wrap(para, w - 36, size)) {
      s += text(tx, ty, l, { size, fill: C.ink, anchor: align });
      ty += size * 1.32;
    }
    ty += 4;
  }
  if (icon) s += icon;
  return s;
}

/** Arrow from (x1,y1) to (x2,y2), optionally with a label at the middle. */
export function arrow(x1, y1, x2, y2, o = {}) {
  const { color = C.ink, sw = 2.5, label, labelDy = -10, dash, size = 15 } = o;
  const mk = color === C.red ? 'arrR' : color === C.muted ? 'arrM' : 'arr';
  let s = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''} marker-end="url(#${mk})"/>`;
  if (label) s += text((x1 + x2) / 2, (y1 + y2) / 2 + labelDy, label, { size, fill: C.muted, anchor: 'middle' });
  return s;
}

/** Polyline arrow through points. */
export function path(pts, o = {}) {
  const { color = C.ink, sw = 2.5, dash } = o;
  const mk = color === C.red ? 'arrR' : color === C.muted ? 'arrM' : 'arr';
  return `<polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''} marker-end="url(#${mk})"/>`;
}

/** A lock glyph (for sealed items). */
export function lock(x, y, s = 1, color = C.muted) {
  return `<g transform="translate(${x},${y}) scale(${s})"><rect x="0" y="9" width="18" height="14" rx="3" fill="${color}"/><path d="M4 9 V6 a5 5 0 0 1 10 0 V9" fill="none" stroke="${color}" stroke-width="2.6"/></g>`;
}

/** A status chip. kind: done | defined | sealed | open. */
export function chip(x, y, kind, label) {
  const col = { done: C.status.done, defined: C.status.defined, sealed: C.status.sealed, open: C.status.open }[kind];
  const w = Math.round(label.length * 15 * 0.58 + 26 + (kind === 'sealed' ? 18 : 0));
  let s = rect(x, y, w, 26, { rx: 13, fill: col, stroke: 'none' });
  let tx = x + 13;
  if (kind === 'sealed') {
    s += lock(x + 9, y + 3, 0.78, '#FFFFFF');
    tx += 18;
  }
  s += text(tx, y + 18, label, { size: 15, weight: 700, fill: '#FFFFFF' });
  return [s, w];
}
