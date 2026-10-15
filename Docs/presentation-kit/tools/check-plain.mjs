// Verifier for the plain figure set (figures-plain/). Usage: node Docs/presentation-kit/tools/check-plain.mjs
// For every SVG it checks:
//   - the root viewBox is 0 0 1430 900 (side) or 0 0 2300 940 (full width), and width/height match it;
//   - the smallest rendered font size is >= 26 (side) or >= 30 (full width). Sizes are taken through nested
//     <svg width viewBox> scaling and <g transform="scale(...)">, so embedded Graphviz text is measured as drawn;
//   - no forbidden token appears in the drawn text.
// F8-timeline is copied unchanged from figures/ by design and is reported, not checked.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'figures-plain');
const FULL = new Set(['B1-example-ffs01-clean', 'B2-example-ffdt03-ddd', 'B3-example-adapter-isolation-hex', 'B4-example-apg2-tf1', 'D1-pipeline', 'A4-schema']);
const COPIED = new Set(['F8-timeline']);
const FORBIDDEN = ['FF-', 'ADR', 'v0', 'g0', 'n0', 'manifest', 'recall', 'precision', 'seed', 'APG', 'judge', 'E1'];

function scan(svg) {
  const re = /<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
  const stack = [];
  let scale = 1;
  let min = Infinity;
  let minText = '';
  const texts = [];
  let inText = 0;
  let last = 0;
  let root = null;
  let m;
  const attr = (a, k) => {
    const r = a.match(new RegExp(`(?:^|\\s)${k}="([^"]*)"`));
    return r ? r[1] : null;
  };
  while ((m = re.exec(svg))) {
    const [, close, tag, attrs, selfClose] = m;
    if (inText) texts.push(svg.slice(last, m.index));
    last = re.lastIndex;
    if (close) {
      const top = stack.pop();
      if (top) scale = top.prev;
      if (tag === 'text') inText--;
      continue;
    }
    let s = scale;
    if (tag === 'svg') {
      const vb = attr(attrs, 'viewBox');
      const w = attr(attrs, 'width');
      if (!root) root = { vb, w, h: attr(attrs, 'height') };
      else if (vb && w) s *= parseFloat(w) / parseFloat(vb.trim().split(/[\s,]+/)[2]);
    }
    const tf = attr(attrs, 'transform');
    if (tf) {
      const sm = tf.match(/scale\(\s*([-\d.]+)/);
      if (sm) s *= Math.abs(parseFloat(sm[1]));
    }
    const fsz = attr(attrs, 'font-size');
    if (fsz && (tag === 'text' || tag === 'tspan')) {
      const eff = parseFloat(fsz) * s;
      if (eff < min) {
        min = eff;
        minText = svg.slice(re.lastIndex, re.lastIndex + 40).replace(/<[^>]*>/g, '').trim();
      }
    }
    if (!selfClose) {
      stack.push({ tag, prev: scale });
      scale = s;
      if (tag === 'text') inText++;
    }
  }
  const drawn = texts.join(' ').replace(/<[^>]*>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
  return { root, min, minText, drawn };
}

let fail = 0;
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.svg')).sort();
for (const f of files) {
  const name = f.replace(/\.svg$/, '');
  const svg = fs.readFileSync(path.join(DIR, f), 'utf8');
  const { root, min, minText, drawn } = scan(svg);
  if (COPIED.has(name)) {
    console.log(`SKIP  ${name.padEnd(36)} copied unchanged from figures/ (viewBox ${root.vb}, min font ${min.toFixed(1)})`);
    continue;
  }
  const full = FULL.has(name);
  const want = full ? { vb: '0 0 2300 940', w: '2300', h: '940', min: 30 } : { vb: '0 0 1430 900', w: '1430', h: '900', min: 26 };
  const errs = [];
  if (root.vb !== want.vb) errs.push(`viewBox ${root.vb} != ${want.vb}`);
  if (root.w !== want.w || root.h !== want.h) errs.push(`size ${root.w}x${root.h} != ${want.w}x${want.h}`);
  if (min + 1e-6 < want.min) errs.push(`min font ${min.toFixed(2)} < ${want.min} ("${minText}")`);
  const hits = FORBIDDEN.filter((t) => drawn.toLowerCase().includes(t.toLowerCase()));
  if (hits.length) errs.push(`forbidden tokens: ${hits.join(', ')}`);
  if (!png(name)) errs.push('PNG missing');
  const ok = errs.length === 0;
  if (!ok) fail++;
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${name.padEnd(36)} ${full ? 'full' : 'side'}  viewBox ${root.vb}  min font ${min.toFixed(1)} (>= ${want.min})${ok ? '' : '  ' + errs.join('; ')}`);
}
function png(name) {
  return fs.existsSync(path.join(DIR, `${name}.png`));
}
console.log(`${files.length} SVGs, ${fail} failing`);
process.exit(fail ? 1 : 0);
