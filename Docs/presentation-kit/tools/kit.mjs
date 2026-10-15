// Shared palette, SVG helpers and statistics for the presentation kit figures.
// Every figure is a 1600-px-wide SVG (white background), rasterised at 2x by render.mjs.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export const KIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO = path.resolve(KIT, '..', '..');
export const FIG = path.join(KIT, 'figures');
export const EX = path.join(KIT, 'examples');
export const W = 1600;
export const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";
export const MONO = "Menlo, 'SF Mono', Consolas, monospace";

export const C = {
  ink: '#1F2937',
  muted: '#5B6472',
  faint: '#9CA3AF',
  grid: '#E5E7EB',
  panel: '#F6F8FA',
  bg: '#FFFFFF',
  red: '#C62828',
  redSoft: '#FDECEC',
  layer: {
    domain: '#1B7F5A',
    application: '#2F6DB5',
    'adapters-inbound': '#8E5BB5',
    'adapters-outbound': '#C2671B',
    config: '#5B6472',
    infrastructure: '#C2671B',
    presentation: '#8E5BB5',
  },
  layerSoft: {
    domain: '#E3F2EC',
    application: '#E4EDF8',
    'adapters-inbound': '#F0E8F6',
    'adapters-outbound': '#FBEBDD',
    config: '#ECEEF1',
    infrastructure: '#FBEBDD',
    presentation: '#F0E8F6',
  },
  s: {
    before: '#AEB6C2',
    after: '#2F6DB5',
    judge: '#2F6DB5',
    proxy: '#C2671B',
    rules: '#1B7F5A',
    blind: '#8E5BB5',
    neutral: '#5B6472',
  },
  status: { done: '#1B7F5A', defined: '#C2671B', sealed: '#5B6472', open: '#AEB6C2' },
  dev: '#A16207',
  devSoft: '#FEF3C7',
  study1: '#334155',
  study1Soft: '#E2E8F0',
};

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Rough Helvetica width estimate (px) for layout. */
export const tw = (s, size = 16, weight = 400) => String(s).length * size * (weight >= 600 ? 0.58 : 0.53);

export function text(x, y, s, o = {}) {
  const { size = 18, weight = 400, fill = C.ink, anchor = 'start', family = FONT, italic = false, extra = '' } = o;
  return `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${italic ? ' font-style="italic"' : ''} ${extra}>${esc(s)}</text>`;
}

/** Multi-line text, lines given explicitly. */
export function lines(x, y, arr, o = {}) {
  const lh = o.lh ?? (o.size ?? 18) * 1.3;
  return arr.map((l, i) => text(x, y + i * lh, l, o)).join('');
}

/** Greedy word wrap by estimated width. */
export function wrap(s, maxW, size = 18, weight = 400) {
  const words = String(s).split(/\s+/);
  const out = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (tw(t, size, weight) > maxW && cur) {
      out.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) out.push(cur);
  return out;
}

/** Word wrap that also breaks over-long paths after a '/'. */
export function wrapPath(v, max, size = 16) {
  const out = [];
  for (const l of wrap(v, max, size)) {
    if (tw(l, size) <= max) {
      out.push(l);
      continue;
    }
    let cur = '';
    for (const part of l.split(/(?<=\/)/)) {
      if (tw(cur + part, size) > max && cur) {
        out.push(cur);
        cur = part;
      } else cur += part;
    }
    if (cur) out.push(cur);
  }
  return out;
}

export const rect = (x, y, w, h, o = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx ?? 0}" fill="${o.fill ?? 'none'}" stroke="${o.stroke ?? 'none'}" stroke-width="${o.sw ?? 1}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}${o.opacity != null ? ` opacity="${o.opacity}"` : ''}/>`;
export const line = (x1, y1, x2, y2, o = {}) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${o.stroke ?? C.ink}" stroke-width="${o.sw ?? 1.5}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}${o.marker ? ` marker-end="url(#${o.marker})"` : ''}/>`;

/** A pill label. Returns [svg, width]. */
export function pill(x, y, label, o = {}) {
  const { fill = C.panel, stroke = C.grid, color = C.ink, size = 15, weight = 600, h = 28 } = o;
  const w = Math.round(tw(label, size, weight) * (label === label.toUpperCase() ? 1.16 : 1.0) + 26);
  return [rect(x, y, w, h, { rx: h / 2, fill, stroke }) + text(x + w / 2, y + h / 2 + size * 0.36, label, { size, weight, fill: color, anchor: 'middle' }), w];
}

/** The data-set badge every chart carries. kind: 'dev' | 'study1' | 'design' | 'mixed'. */
export function badge(x, y, kind, label) {
  const map = {
    dev: [C.devSoft, C.dev, label ?? 'DEVELOPMENT SET (not a validity estimate)'],
    study1: [C.study1Soft, C.study1, label ?? 'STUDY 1 (registered data)'],
    design: ['#EEF2F7', C.muted, label ?? 'DESIGN (nothing measured)'],
    v13onS1: [C.study1Soft, C.study1, label ?? 'STUDY 1 DATA, READ BY THE v1.3 DEV INSTRUMENT (descriptive)'],
  };
  const [fill, color, l] = map[kind];
  return pill(x, y, l, { fill, stroke: color, color, size: 15 })[0];
}

export const defs = () => `<defs>
  <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.ink}"/></marker>
  <marker id="arrM" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.muted}"/></marker>
  <marker id="arrR" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.red}"/></marker>
</defs>`;

/**
 * A full figure: title, subtitle, optional badge (top right), body (already-positioned SVG starting at y=top),
 * and a source footer. Returns the SVG string.
 */
export function frame({ title, subtitle, badgeKind, badgeLabel, body, height: h0, footer }) {
  const parts = [];
  const fl = footer ? (Array.isArray(footer) ? footer : [footer]).flatMap((f) => wrap(f, W - 110, 15)) : [];
  // The body ends at h0 - 60 or so; extra footer lines grow the figure instead of overlapping it.
  const height = Math.round(h0 + Math.max(0, (fl.length - 2) * 21));
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}">`);
  parts.push(defs());
  parts.push(rect(0, 0, W, height, { fill: C.bg }));
  // Keep the title clear of the badge: shrink it if both would not fit on one line.
  let bwid = 0;
  if (badgeKind) bwid = pill(0, 0, badgeLabel ?? { dev: 'DEVELOPMENT SET (not a validity estimate)', study1: 'STUDY 1 (registered data)', design: 'DESIGN (nothing measured)', v13onS1: 'STUDY 1 DATA, READ BY THE v1.3 DEV INSTRUMENT (descriptive)' }[badgeKind], { size: 15 })[1];
  const tsize = Math.min(34, Math.floor((W - 96 - bwid - 30) / (String(title).length * 0.6)));
  parts.push(text(48, 62, title, { size: tsize, weight: 700 }));
  if (subtitle) {
    const sl = Array.isArray(subtitle) ? subtitle : [subtitle];
    sl.forEach((s, i) => parts.push(text(48, 98 + i * 27, s, { size: 20, fill: C.muted })));
  }
  if (badgeKind) {
    const lab = badgeLabel ?? undefined;
    const [, bw] = pill(0, 0, lab ?? { dev: 'DEVELOPMENT SET (not a validity estimate)', study1: 'STUDY 1 (registered data)', design: 'DESIGN (nothing measured)', v13onS1: 'STUDY 1 DATA, READ BY THE v1.3 DEV INSTRUMENT (descriptive)' }[badgeKind], { size: 15 });
    parts.push(badge(W - 48 - bw, 32, badgeKind, lab));
  }
  parts.push(body);
  if (fl.length) {
    fl.forEach((f, i) => parts.push(text(48, height - 24 - (fl.length - 1 - i) * 21, f, { size: 15, fill: C.muted })));
  }
  parts.push('</svg>');
  return parts.join('\n');
}

export function wilson(k, n, z = 1.959964) {
  if (n === 0) return [NaN, NaN];
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}
export const f2 = (x) => (Math.round(x * 100) / 100).toFixed(2);

/** Write an SVG and its caption. */
export function save(dir, name, svg, caption) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.svg`), svg);
  if (caption) fs.writeFileSync(path.join(dir, `${name}.caption.md`), caption.trim() + '\n');
  return path.join(dir, `${name}.svg`);
}

/** Embed a Graphviz SVG (string) at x,y scaled to width w. Returns [svg, height]. */
export function embedGv(gvSvg, x, y, w) {
  const m = gvSvg.match(/viewBox="([\d.\s-]+)"/);
  const [, , vw, vh] = m[1].trim().split(/\s+/).map(Number);
  const h = (w * vh) / vw;
  const inner = gvSvg.replace(/<\?xml[^>]*>/, '').replace(/<!DOCTYPE[^>]*>/, '').replace(/<!--[\s\S]*?-->/g, '');
  const opened = inner.replace(/<svg[^>]*>/, `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${m[1]}" xmlns="http://www.w3.org/2000/svg">`);
  return [opened.replace(/<polygon fill="white" stroke="none"[^>]*\/>/, ''), h, w / vw];
}

let _gv;
export async function graphviz() {
  if (!_gv) {
    // The Graphviz build lives outside the repository: KIT_TOOLS = a directory whose node_modules holds it.
    const { createRequire } = await import('node:module');
    const req = createRequire(path.join(process.env.KIT_TOOLS ?? process.cwd(), 'noop.js'));
    const m = await import(req.resolve('@hpcc-js/wasm-graphviz'));
    _gv = await m.Graphviz.load();
  }
  return _gv;
}

export const readJson = (p) => JSON.parse(fs.readFileSync(path.isAbsolute(p) ? p : path.join(REPO, p), 'utf8'));
