// Plain set, diagrams: D1 and A4 (full width, 2300 x 940, text >= 30 px); F1, F10, F11 (side, 1430 x 900,
// text >= 26 px); F8 is copied unchanged from figures/.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { C, SIDE, FULL, PLAIN, T, para, canvas, rect, line, box, arrow, poly, chip, legend, savePlain, caption, tw } from './plain-kit.mjs';
import { FIG } from './kit.mjs';

const BLUE = C.layer.application;
const GREEN = C.layer.domain;
const PURPLE = C.layer['adapters-inbound'];
const ORANGE = C.layer['adapters-outbound'];

// ---------------- D1: how the tool works (full width) ----------------
{
  const W = FULL.w;
  let b = '';
  const cw = 400;
  const xs = [40, 520, 1000];
  const yS = 80;
  const yC = 530;
  const bh = 330;
  b += T(40, 50, 'WHAT THE TEAM WROTE', { size: 30, weight: 700, fill: C.muted });
  b += T(40, 500, 'THE CODE', { size: 30, weight: 700, fill: C.muted });
  const spec = [
    ['The spec', ['layers and their folders', 'allowed dependencies', 'which rules apply']],
    ['Compiler', ['turns each rule into a query on the map']],
    ['Queries', ['one per rule, e.g. “no import may point outward”']],
  ];
  const code = [
    ['TypeScript code', ['the project as written, by a team or by an AI']],
    ['Extractor', ['reads the code with the TypeScript compiler']],
    ['The tool’s map', ['files, classes, methods, each with its layer; imports, calls, …']],
  ];
  spec.forEach(([t, l], i) => (b += box(xs[i], yS, cw, bh, { title: t, lines: l, color: BLUE, size: 30, titleSize: 34 })));
  code.forEach(([t, l], i) => (b += box(xs[i], yC, cw, bh, { title: t, lines: l, color: GREEN, size: 30, titleSize: 34 })));
  for (let i = 0; i < 2; i++) {
    b += arrow(xs[i] + cw + 8, yS + bh / 2, xs[i + 1] - 10, yS + bh / 2);
    b += arrow(xs[i] + cw + 8, yC + bh / 2, xs[i + 1] - 10, yC + bh / 2);
  }
  const ex = 1470;
  const ew = 310;
  b += box(ex, 230, ew, 450, { title: 'Run the queries', lines: ['each row a query returns is a finding', 'same code, same rows'], color: C.ink, fill: C.panel, size: 30, titleSize: 34 });
  b += arrow(xs[2] + cw + 8, yS + bh / 2, ex - 10, yS + bh / 2 + 60);
  b += arrow(xs[2] + cw + 8, yC + bh / 2, ex - 10, yC + bh / 2 - 60);
  const rx = 1830;
  const rw = W - 40 - rx;
  b += box(rx, 40, rw, 290, { title: 'Findings', lines: [['defining rule (can fail)', C.red], ['warning (never fails)', C.muted]], color: C.ink, size: 30, titleSize: 34 });
  b += box(rx, 380, rw, 250, { title: 'AI reviewer', lines: ['reads the code, reports, never fails'], color: PURPLE, dash: '12 8', size: 30, titleSize: 34 });
  b += box(rx, 680, rw, 220, { title: 'Verdict', lines: ['fails on any defining-rule finding'], color: C.ink, size: 30, titleSize: 34 });
  b += arrow(ex + ew + 8, 455, rx - 10, 185);
  b += arrow(rx + rw / 2, 334, rx + rw / 2, 374);
  b += arrow(rx + rw / 2, 634, rx + rw / 2, 674);
  savePlain('D1-pipeline', canvas(FULL, b), caption('D1-pipeline',
    'The tool turns the team’s spec into queries and the code into a map; every row a query returns is a finding. Defining rules can fail the verdict; warnings and the AI reviewer never do.',
    ['None: a design figure (no measured number).'],
    ['The health score of the original D1 is left out; the verdict rule is kept ("verdict fails on any blocking finding").']));
}

// ---------------- A4: what the map records (full width) ----------------
{
  let b = '';
  const node = (x, y, w, h, title, sub, kind = 'core') => {
    const col = kind === 'v2' ? ORANGE : C.ink;
    let s = rect(x, y, w, h, { rx: 16, fill: '#fff', stroke: col, sw: 3.5, dash: kind === 'v2' ? '12 8' : undefined });
    s += T(x + w / 2, y + 48, title, { size: 36, weight: 700, anchor: 'middle', fill: col });
    (sub ?? []).forEach(([t, c], i) => (s += T(x + w / 2, y + 92 + i * 40, t, { size: 30, anchor: 'middle', fill: c ?? C.muted, italic: c == null })));
    return s;
  };
  const elab = (x, y, t, col = C.ink, anchor = 'middle') => T(x, y, t, { size: 30, fill: col, anchor });
  // nodes
  b += node(300, 60, 460, 170, 'File', [['imports other files', C.ink], ['its layer, from the spec']]);
  b += node(1000, 90, 340, 110, 'Package', [['(a library)']]);
  b += node(1500, 60, 380, 170, 'Component', [['layer · module · folder']], 'v2');
  b += node(40, 420, 250, 90, 'Function');
  b += node(400, 380, 600, 170, 'Class', [['extends, is handed', C.ink], ['setters, public fields', BLUE]]);
  b += node(1340, 420, 320, 90, 'Interface');
  b += node(640, 730, 300, 140, 'Method', [['calls methods', C.ink]]);
  b += node(1140, 740, 300, 130, 'Channel', [['event, queue']], 'v2');
  b += node(1500, 740, 440, 130, 'I/O kind', [['database, network, clock']], 'v2');
  // core edges
  b += arrow(760, 145, 990, 145);
  b += elab(875, 130, 'imports');
  b += arrow(420, 232, 180, 412);
  b += elab(240, 330, 'declares', C.ink, 'end');
  b += arrow(560, 232, 620, 372);
  b += elab(605, 300, 'declares', C.ink, 'start');
  b += arrow(760, 210, 1400, 412);
  b += elab(1110, 300, 'declares', C.ink, 'start');
  b += arrow(1000, 465, 1330, 465);
  b += elab(1165, 450, 'implements');
  b += arrow(720, 552, 770, 722);
  b += elab(770, 640, 'contains', C.ink, 'start');
  // richer-map edges (orange dashed)
  b += poly([[700, 58], [1000, 20], [1640, 20], [1660, 52]], { color: ORANGE, dash: '12 8' });
  b += elab(1180, 54, 'belongs to', ORANGE);
  b += arrow(1690, 234, 1520, 412, { color: ORANGE, dash: '12 8' });
  b += elab(1620, 340, 'exports', ORANGE, 'start');
  b += arrow(940, 740, 1400, 516, { color: ORANGE, dash: '12 8' });
  b += elab(1220, 680, 'uses in signature', ORANGE, 'start');
  b += arrow(942, 810, 1130, 810, { color: ORANGE, dash: '12 8' });
  b += elab(1036, 790, 'publishes', ORANGE);
  b += poly([[790, 872], [790, 920], [1720, 920], [1720, 880]], { color: ORANGE, dash: '12 8' });
  b += elab(810, 908, 'does I/O', ORANGE, 'start');
  // legend
  const lx = 1940;
  b += T(lx, 470, 'Legend', { size: 32, weight: 700 });
  b += line(lx, 520, lx + 60, 520, { stroke: C.ink, sw: 4 });
  b += T(lx + 76, 530, 'original map', { size: 30 });
  b += T(lx + 76, 570, '(Study 1)', { size: 30, fill: C.muted });
  b += rect(lx, 600, 60, 30, { rx: 4, fill: '#fff', stroke: BLUE, sw: 3 });
  b += T(lx + 76, 626, 'added in v1.3', { size: 30, fill: BLUE });
  b += line(lx, 680, lx + 60, 680, { stroke: ORANGE, sw: 4, dash: '12 8' });
  b += T(lx + 76, 690, 'richer map', { size: 30, fill: ORANGE });
  b += T(lx + 76, 730, '(optional)', { size: 30, fill: C.muted });
  savePlain('A4-schema', canvas(FULL, b), caption('A4-schema',
    'The tool’s map records files, packages, classes, interfaces, functions and methods, and how they relate (imports, declares, implements, contains, calls); the richer map adds components, signatures, channels and kinds of input/output.',
    ['Graph: "6 node / 9 edge types (v1.2E); 3 MODULE_* edge types (v1.3); 3 node / 8 edge types (APG v2)" (the APG schema).'],
    ['Plain set shows the node types and a selection of edge labels in plain words; it prints no counts. Blue marks the member facts on Class nodes added in v1.3.', 'Plain words: richer map = APG v2; original map = the v1.2E graph used in Study 1.']));
}

// ---------------- F1: the measurement chain (side) ----------------
{
  const W = SIDE.w;
  const links = [
    ['1', 'Code → map', GREEN, [['AI-built projects: 99.7% of the compiler’s imports found; 0 disagreements unexplained.', [['done', 'done']]]]],
    ['2', 'Answer keys', BLUE, [['5 projects, 71 variants: 52 planted violations, 14 look-alikes, 5 clean apps.', [['done', 'built']]]]],
    ['3', 'Rules', ORANGE, [['Defining rules, author key: 54/54 found (0.93–1.00). Blind key: 50/64 found, 50/54 reports right.', [['done', 'done'], ['defined', '39 to decide']]]]],
    ['4', 'Meaning', PURPLE, [
      ['AI reviewer, two clean problem types: 16/21 = 0.76 (0.55–0.89). 30/35 includes confounded cases.', [['done', 'done']]],
      ['Human labels and the sealed test: not run yet.', [['defined', 'not run'], ['sealed', 'sealed']]],
    ]],
  ];
  let b = '';
  let y = 24;
  const lx = 30;
  const lw = 250;
  const ex = 310;
  const ew = 780;
  const sx = 1110;
  for (const [n, name, col, rows] of links) {
    const parts = [];
    let hsum = 0;
    for (const [txt, chips] of rows) {
      const [pt, ph] = para(ex + 22, 0, txt, ew - 40, { size: 30 });
      const h = Math.max(ph + 44, 70 + (chips.length - 1) * 54);
      parts.push([pt, h, chips]);
      hsum += h;
    }
    hsum += (rows.length - 1) * 12;
    b += rect(lx, y, lw, hsum, { rx: 14, fill: col });
    b += T(lx + 22, y + 42, `Link ${n}`, { size: 28, weight: 700, fill: '#fff' });
    b += T(lx + 22, y + 82, name, { size: 30, weight: 700, fill: '#fff' });
    let ry = y;
    for (const [pt, h, chips] of parts) {
      b += rect(ex, ry, W - 30 - ex, h, { rx: 12, fill: '#fff', stroke: C.grid, sw: 2 });
      b += `<g transform="translate(0,${ry + 48})">${pt}</g>`;
      chips.forEach(([k, l], i) => (b += chip(sx, ry + 16 + i * 54, k, l)[0]));
      ry += h + 12;
    }
    y += hsum + 22;
  }
  let cx = lx;
  for (const [k, l] of [['done', 'done on the development set'], ['defined', 'defined, not run'], ['sealed', 'sealed']]) {
    const [s, w] = chip(cx, y + 6, k, l);
    b += s;
    cx += w + 22;
  }
  savePlain('F1-measurement-chain', canvas(SIDE, b), caption('F1-measurement-chain',
    'Each link from code to meaning has evidence on the development set; the last link, meaning, is the least measured: the AI reviewer is checked on 21 clean planted cases, and the human labels and the sealed test have not run.',
    [
      'Graph fidelity: "0.996684 (99.7%)" and "0 / 0" unexplained disagreements.',
      'Development set: rules, "71 variants; 5 clean, 14 near-miss, 52 planted; 146 files".',
      'Development set: rules, "12/12, 11/11, 10/10, 12/12, 9/9; pooled 54/54 = 1.00 [0.93, 1.00]; 3 FF-P06 FLOWS_TO rows N/A".',
      'Development set: rules, "pooled 50/64 = 0.78 [0.67, 0.86]" (blind recall) and "pooled 50/54 = 0.93 [0.82, 0.97]" (blind precision); "39" adjudication rows.',
      'Judge and cheap proxies: "30/35 = 0.86 [0.71, 0.94]", qualified: "both rounds 16/21 = 0.76 [0.55, 0.89]".',
    ],
    ['The richer-map row (25/27) and the backing-file column of the original F1 are left out.']));
}

// ---------------- F10: Study 2 design (side) ----------------
{
  const W = SIDE.w;
  let b = '';
  const arms = [
    ['No tool', 'the AI works alone', C.s.neutral],
    ['Tool on request', 'the AI can ask the tool', BLUE],
    ['Tool as a gate', 'one repair turn after a failing step', ORANGE],
  ];
  const ax = 30;
  const aw = 330;
  const sx0 = 400;
  const sw = 250;
  for (let s = 0; s < 4; s++) b += T(sx0 + s * sw + 100, 50, `Step ${s + 1}`, { size: 28, weight: 700, anchor: 'middle' });
  b += T(sx0 + 100, 86, 'build', { size: 26, fill: C.muted, anchor: 'middle' });
  for (let s = 1; s < 4; s++) b += T(sx0 + s * sw + 100, 86, 'extend', { size: 26, fill: C.muted, anchor: 'middle' });
  const ys = [120, 300, 480];
  arms.forEach(([n, d, col], r) => {
    const y = ys[r];
    const h = r === 2 ? 260 : 150;
    b += rect(ax, y, aw, h, { rx: 14, fill: col });
    b += T(ax + 20, y + 46, n, { size: 30, weight: 700, fill: '#fff' });
    const [pt] = para(ax + 20, y + 88, d, aw - 40, { size: 26, fill: '#fff' });
    b += pt;
    for (let s = 0; s < 4; s++) {
      const x = sx0 + s * sw;
      b += rect(x, y + 40, 180, 70, { rx: 10, fill: '#fff', stroke: col, sw: 3 });
      b += T(x + 90, y + 84, 'AI turn', { size: 26, anchor: 'middle' });
      b += `<circle cx="${x + 208}" cy="${y + 75}" r="18" fill="${C.ink}"/>`;
      if (s < 3) b += arrow(x + 228, y + 75, x + sw - 6, y + 75, { color: C.muted, sw: 3 });
      if (r === 2) {
        b += rect(x, y + 150, 180, 80, { rx: 10, fill: C.redSoft, stroke: C.red, sw: 2.5, dash: '9 6' });
        b += T(x + 90, y + 186, 'repair', { size: 26, anchor: 'middle', fill: C.red });
        b += T(x + 90, y + 218, 'if it fails', { size: 26, anchor: 'middle', fill: C.red });
        b += poly([[x + 208, y + 94], [x + 208, y + 190], [x + 190, y + 190]], { color: C.red, sw: 3 });
      }
    }
  });
  b += `<circle cx="48" cy="784" r="18" fill="${C.ink}"/>`;
  b += T(80, 794, 'snapshot, then the tool checks it (fixed rules only)', { size: 26 });
  b += T(30, 850, 'Outcome: new defining-rule violations per step.', { size: 28, weight: 700 });
  savePlain('F10-study2-design', canvas(SIDE, b), caption('F10-study2-design',
    'Study 2 compares three setups over several build steps: the AI alone, the AI that can ask the tool, and the tool as a gate with one repair turn; after each step the code is snapshotted and checked. Informal outline, not a locked plan.',
    [
      'Design figures: "7 tools; at most 40 findings; one repair turn" (Study 2 arms).',
      'Design figures: "k ≈ 4–6" (steps per Study 2 task); four steps drawn.',
    ],
    ['Plain names for the arms: none = No tool; daedalus-mcp = Tool on request; gate = Tool as a gate.', 'The working grid and power intuition of the original F10 are left out.']));
}

// ---------------- F11: pilot decision (side) ----------------
{
  const W = SIDE.w;
  let b = '';
  b += box(215, 20, 1000, 130, { title: 'Pilot run', lines: ['3 tasks (Clean, Hexagonal, DDD) · 2 setups · 4 steps'], color: C.ink, fill: C.panel, size: 28, titleSize: 30 });
  b += arrow(715, 152, 715, 196);
  const dy = 200;
  const dh = 250;
  b += `<polygon points="715,${dy} 1180,${dy + dh / 2} 715,${dy + dh} 250,${dy + dh / 2}" fill="#fff" stroke="${C.ink}" stroke-width="3"/>`;
  b += T(715, dy + 100, 'With no tool, does any new', { size: 28, weight: 700, anchor: 'middle' });
  b += T(715, dy + 136, 'defining-rule finding appear', { size: 28, weight: 700, anchor: 'middle' });
  b += T(715, dy + 172, 'after step 1?', { size: 28, weight: 700, anchor: 'middle' });
  b += poly([[250, dy + dh / 2], [190, dy + dh / 2], [190, 540]], { color: C.red });
  b += poly([[1180, dy + dh / 2], [1240, dy + dh / 2], [1240, 540]], { color: GREEN });
  b += T(150, dy + dh / 2 - 20, 'No', { size: 30, weight: 700, fill: C.red, anchor: 'middle' });
  b += T(1280, dy + dh / 2 - 20, 'Yes', { size: 30, weight: 700, fill: GREEN, anchor: 'middle' });
  b += box(30, 550, 660, 230, { title: 'Main outcome becomes the warning rate per step', lines: ['defining rules would show nothing to compare'], color: C.red, size: 28, titleSize: 30 });
  b += box(740, 550, 660, 230, { title: 'Main outcome stays: defining-rule violations per step', lines: ['warnings become a second outcome'], color: GREEN, size: 28, titleSize: 30 });
  b += T(30, 840, 'Fixed before the pilot runs. Every finding on the AI-built projects was a warning.', { size: 26, fill: C.muted });
  savePlain('F11-pilot-decision', canvas(SIDE, b), caption('F11-pilot-decision',
    'A rule fixed before the pilot: if the AI working alone produces no new defining-rule finding after step 1, Study 2’s main outcome becomes the warning rate per step; otherwise it stays defining-rule violations per step.',
    [
      'Design figures: "3 tasks × 2 arms, k = 4, 1 replicate, 6 runs, 24 step turns" (loop pilot design).',
      'Study 1 under v1.3: "0 blocking per file in all 65 cells (0 of all 72); advisory share 1.000" (why zero is plausible).',
    ],
    ['Plain words: blocking = defining rule (can fail); advisory = warning (never fails); none arm = no tool.']));
}

// ---------------- F8: copied unchanged ----------------
for (const ext of ['svg', 'png', 'caption.md']) fs.copyFileSync(path.join(FIG, `F8-timeline.${ext}`), path.join(PLAIN, `F8-timeline.${ext}`));
