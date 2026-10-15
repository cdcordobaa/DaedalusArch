// Plain mode of the presentation kit: large-type, jargon-free figures for a reader who does not know the
// project's vocabulary. Same palette and helpers as kit.mjs; no title, subtitle, footer or badge inside a figure
// (the slide carries them). Output: Docs/presentation-kit/figures-plain/<same basename as figures/>.
//
// Two canvases (from the deck session):
//   side figures   1430 x 900, smallest text 26 px
//   full width     2300 x 940, smallest text 30 px
import * as fs from 'node:fs';
import * as path from 'node:path';
import { C, KIT, FONT, MONO, esc, tw, wrap, rect, line, wilson } from './kit.mjs';

export { C, FONT, MONO, esc, tw, wrap, rect, line, wilson };
export const PLAIN = path.join(KIT, 'figures-plain');
export const SIDE = { w: 1430, h: 900, min: 26 };
export const FULL = { w: 2300, h: 940, min: 30 };

/** Text; size defaults to 28. */
export function T(x, y, s, o = {}) {
  const { size = 28, weight = 400, fill = C.ink, anchor = 'start', family = FONT, italic = false } = o;
  return `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${italic ? ' font-style="italic"' : ''}>${esc(s)}</text>`;
}

/** Wrapped paragraph. Returns [svg, height]. */
export function para(x, y, s, maxW, o = {}) {
  const size = o.size ?? 28;
  const lh = o.lh ?? size * 1.3;
  const ls = Array.isArray(s) ? s.flatMap((p) => wrap(p, maxW, size, o.weight ?? 400)) : wrap(s, maxW, size, o.weight ?? 400);
  return [ls.map((l, i) => T(x, y + i * lh, l, o)).join(''), ls.length * lh];
}

const defs = () => `<defs>
  <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="20" markerHeight="20" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.ink}"/></marker>
  <marker id="arrM" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="20" markerHeight="20" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.muted}"/></marker>
  <marker id="arrR" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="20" markerHeight="20" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.red}"/></marker>
  <marker id="arrG" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="20" markerHeight="20" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.layer.domain}"/></marker>
  <marker id="arrB" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="20" markerHeight="20" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.layer.application}"/></marker>
  <marker id="arrP" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="20" markerHeight="20" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.layer['adapters-inbound']}"/></marker>
  <marker id="arrO" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="20" markerHeight="20" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.layer['adapters-outbound']}"/></marker>
</defs>`;

/** Marker id for a stroke colour. */
export function mk(color) {
  return { [C.red]: 'arrR', [C.muted]: 'arrM', [C.layer.domain]: 'arrG', [C.layer.application]: 'arrB', [C.layer['adapters-inbound']]: 'arrP', [C.layer['adapters-outbound']]: 'arrO' }[color] ?? 'arr';
}

/** Arrow (straight). */
export function arrow(x1, y1, x2, y2, o = {}) {
  const { color = C.ink, sw = 4, dash } = o;
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''} marker-end="url(#${mk(color)})"/>`;
}

/** Polyline arrow. */
export function poly(pts, o = {}) {
  const { color = C.ink, sw = 4, dash } = o;
  return `<polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''} marker-end="url(#${mk(color)})"/>`;
}

/** Wrap a body in a plain canvas (no title, no footer, no badge). */
export function canvas(kind, body) {
  const { w, h } = kind;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n${defs()}\n${rect(0, 0, w, h, { fill: C.bg })}\n${body}\n</svg>\n`;
}

/** A titled box with wrapped lines. Returns svg. */
export function box(x, y, w, h, o = {}) {
  const { title, lines = [], color = C.ink, fill = '#FFFFFF', size = 28, titleSize = 32, dash, titleColor, sw = 3, pad = 22, lineFill = C.ink } = o;
  let s = rect(x, y, w, h, { rx: 14, fill, stroke: color, sw, dash });
  let ty = y + pad + titleSize * 0.85;
  if (title) {
    for (const l of wrap(title, w - 2 * pad, titleSize, 700)) {
      s += T(x + pad, ty, l, { size: titleSize, weight: 700, fill: titleColor ?? color });
      ty += titleSize * 1.22;
    }
    ty += 6;
  } else ty = y + pad + size * 0.85;
  for (const p of lines) {
    const [txt, col] = Array.isArray(p) ? p : [p, lineFill];
    for (const l of wrap(txt, w - 2 * pad, size)) {
      s += T(x + pad, ty, l, { size, fill: col });
      ty += size * 1.28;
    }
    ty += 4;
  }
  return s;
}

/** Status chip. kind: done | defined | sealed | open. Returns [svg, width]. */
export function chip(x, y, kind, label, size = 26) {
  const col = { done: C.status.done, defined: C.status.defined, sealed: C.status.sealed, open: C.status.open }[kind];
  const h = Math.round(size * 1.6);
  const lockW = kind === 'sealed' ? size * 1.05 : 0;
  const w = Math.round(tw(label, size, 700) + 34 + lockW);
  let s = rect(x, y, w, h, { rx: h / 2, fill: col });
  let tx = x + 17;
  if (kind === 'sealed') {
    const sc = size / 26;
    s += `<g transform="translate(${x + 14},${y + h / 2 - 13 * sc}) scale(${sc})"><rect x="0" y="9" width="18" height="14" rx="3" fill="#FFFFFF"/><path d="M4 9 V6 a5 5 0 0 1 10 0 V9" fill="none" stroke="#FFFFFF" stroke-width="2.6"/></g>`;
    tx += lockW;
  }
  s += T(tx, y + h / 2 + size * 0.35, label, { size, weight: 700, fill: '#FFFFFF' });
  return [s, w];
}

/** Legend row: items [[color, label, kind?]]. kind: 'line' | 'dash' | 'dot' | 'ring'. Returns [svg, width]. */
export function legend(x, y, items, size = 26, gap = 44) {
  let s = '';
  let cx = x;
  for (const [col, lab, kind] of items) {
    let sw = 30;
    if (kind === 'line') s += line(cx, y - size * 0.35, cx + 44, y - size * 0.35, { stroke: col, sw: 5 }), (sw = 44);
    else if (kind === 'dash') s += line(cx, y - size * 0.35, cx + 44, y - size * 0.35, { stroke: col, sw: 5, dash: '10 7' }), (sw = 44);
    else if (kind === 'dot') s += `<circle cx="${cx + 13}" cy="${y - size * 0.35}" r="12" fill="${col}"/>`, (sw = 26);
    else if (kind === 'ring') s += `<circle cx="${cx + 13}" cy="${y - size * 0.35}" r="11" fill="#fff" stroke="${col}" stroke-width="4"/>`, (sw = 26);
    else s += rect(cx, y - size * 0.85, 30, size * 0.85, { rx: 4, fill: col });
    s += T(cx + sw + 12, y, lab, { size });
    cx += sw + 12 + tw(lab, size) + gap;
  }
  return [s, cx - gap - x];
}

/**
 * Horizontal proportion bars with whiskers, sized for plain figures.
 * rows: [{ label: string | [main, sub], bold?, sep?, bars: [{ k, n, color, label?, strong?, ci?, nowhisker? }] }]
 * Returns [svg, height].
 */
export function hbars(x, y, w, { title, rows, labelW = 300, valueW = 160, barH = 26, barGap = 8, rowGap = 26, size = 26, ticks = [0, 0.5, 1], titleSize = 30 }) {
  let s = '';
  const px = x + labelW;
  const pw = w - labelW - valueW;
  let yy = y;
  if (title) {
    s += T(x, yy + titleSize * 0.85, title, { size: titleSize, weight: 700 });
    yy += titleSize * 1.7;
  }
  const y0 = yy;
  let body = '';
  for (const r of rows) {
    const lab = Array.isArray(r.label) ? r.label : [r.label];
    const barsH = r.bars.length * barH + (r.bars.length - 1) * barGap;
    const rh = Math.max(barsH, lab.length * size * 1.18);
    if (r.sep) body += line(x, yy - rowGap / 2, x + w, yy - rowGap / 2, { stroke: C.grid, sw: 2 });
    const ly = yy + rh / 2 - ((lab.length - 1) * size * 1.18) / 2 + size * 0.35;
    lab.forEach((l, i) => (body += T(px - 16, ly + i * size * 1.18, l, { size, weight: r.bold && i === 0 ? 700 : 400, anchor: 'end', fill: i === 0 ? C.ink : C.muted })));
    const by0 = yy + (rh - barsH) / 2;
    r.bars.forEach((b, i) => {
      const by = by0 + i * (barH + barGap);
      const p = b.k / b.n;
      const [lo, hi] = b.ci ?? wilson(b.k, b.n);
      body += rect(px, by, Math.max(2, p * pw), barH, { fill: b.color, rx: 4 });
      if (!b.nowhisker) {
        const wy = by + barH / 2;
        body += line(px + lo * pw, wy, px + hi * pw, wy, { stroke: C.ink, sw: 2.2 });
        body += line(px + lo * pw, wy - 8, px + lo * pw, wy + 8, { stroke: C.ink, sw: 2.2 });
        body += line(px + hi * pw, wy - 8, px + hi * pw, wy + 8, { stroke: C.ink, sw: 2.2 });
      }
      body += T(px + pw + 16, by + barH / 2 + size * 0.36, b.label ?? `${b.k}/${b.n}`, { size, weight: b.strong ? 700 : 400, fill: b.textColor ?? C.ink });
    });
    yy += rh + rowGap;
  }
  const y1 = yy - rowGap + 8;
  for (const t of ticks) {
    const gx = px + t * pw;
    s += line(gx, y0 - 8, gx, y1, { stroke: t === 0 ? C.faint : C.grid, sw: 1.5 });
    s += T(gx, y1 + size + 6, t === 0 ? '0' : t === 1 ? '1' : String(t), { size, fill: C.muted, anchor: 'middle' });
  }
  s += body;
  return [s, y1 + size + 12 - y];
}

/** Write <name>.svg and <name>.caption.md into figures-plain/. */
export function savePlain(name, svg, caption) {
  fs.mkdirSync(PLAIN, { recursive: true });
  fs.writeFileSync(path.join(PLAIN, `${name}.svg`), svg);
  fs.writeFileSync(path.join(PLAIN, `${name}.caption.md`), caption.trim() + '\n');
  return path.join(PLAIN, `${name}.svg`);
}

/** Standard caption: slide claim plus the NUMBERS.md rows used. */
export function caption(name, claim, rows, notes = []) {
  return `# ${name} (plain set)

**Slide claim.** ${claim}

**NUMBERS.md rows used.**
${rows.map((r) => `- ${r}`).join('\n')}
${notes.length ? `\n**Notes.**\n${notes.map((n) => `- ${n}`).join('\n')}\n` : ''}`;
}
