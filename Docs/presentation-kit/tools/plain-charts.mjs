// Plain set, charts: F2, F3, F3b, F6, F7, F9, C7. Side figures, 1430 x 900, text >= 26 px.
// Every number is quoted from NUMBERS.md (see each caption); whiskers use kit.mjs wilson(), as in figures/.
import { C, SIDE, T, para, canvas, rect, line, legend, hbars, savePlain, caption, tw } from './plain-kit.mjs';

const W = SIDE.w;
const STYLES = ['Clean', 'Layered', 'NestJS', 'Hexagonal', 'DDD'];

// ---------------- F2: every disagreement with the compiler has a known cause ----------------
{
  const CLS = {
    barrel: ['#2F6DB5', 're-exports through index files'],
    excl: ['#8E5BB5', 'files left out on purpose (tests, data)'],
    out: ['#C2671B', 'imports from outside the project folder'],
    dts: ['#1B7F5A', 'type-declaration files'],
  };
  const rows = [
    { label: ['AI-built projects', '72 projects'], total: 39, parts: [['barrel', 39]], agree: '99.7% of the compiler’s imports found' },
    { label: ['7 real codebases', 'from Study 1'], total: 751, parts: [['barrel', 218], ['excl', 202], ['out', 329], ['dts', 2]], agree: '96.6% of the compiler’s imports found' },
  ];
  const x0 = 290;
  const bw = 860;
  let b = '';
  b += T(40, 56, 'Imports where the tool and the TypeScript compiler disagree, by cause', { size: 28, fill: C.muted });
  let y = 120;
  for (const r of rows) {
    b += T(x0 - 20, y + 42, r.label[0], { size: 30, weight: 700, anchor: 'end' });
    b += T(x0 - 20, y + 80, r.label[1], { size: 26, fill: C.muted, anchor: 'end' });
    let cx = x0;
    for (const [k, n] of r.parts) {
      const w = (n / r.total) * bw;
      b += rect(cx, y, Math.max(w, 4), 100, { fill: CLS[k][0] });
      if (w > 90) b += T(cx + w / 2, y + 60, String(n), { size: 30, weight: 700, fill: '#fff', anchor: 'middle' });
      cx += w;
    }
    b += T(x0 + bw + 24, y + 42, `${r.total}`, { size: 34, weight: 700 });
    b += T(x0 + bw + 24, y + 82, 'unexplained: 0', { size: 26, weight: 700, fill: C.status.done });
    b += T(x0, y + 140, r.agree, { size: 26, fill: C.muted });
    y += 230;
  }
  const items = Object.values(CLS);
  b += legend(x0, 580, items.slice(0, 2).map(([c, l]) => [c, l]), 26)[0];
  b += legend(x0, 632, items.slice(2).map(([c, l]) => [c, l]), 26)[0];
  b += rect(40, 700, W - 80, 150, { rx: 14, fill: C.panel });
  b += T(70, 760, 'The one cause the tool should handle, index files, was fixed:', { size: 28, weight: 700 });
  b += T(70, 808, 'the two AI-built projects that disagreed now match exactly (overlap 1.000).', { size: 28 });
  savePlain('F2-graph-fidelity-classes', canvas(SIDE, b), caption('F2-graph-fidelity-classes',
    'Every place where the tool’s map and the TypeScript compiler disagree has a known, harmless cause; none is unexplained, and the one fixable cause (re-exports through index files) was fixed.',
    [
      'Graph fidelity: "39 (11 + 28)", E1 disagreements vs tsc, all re-export/barrel.',
      'Graph fidelity: "218 (80 + 138), 202, 329, 2; total 751", SO4 vs tsc by class.',
      'Graph fidelity: "0 / 0", unexplained disagreements.',
      'Graph fidelity: "0.996684 (99.7%)" (E1 share of tsc edges found) and "0.966302 (96.6%)" (SO4, scoped).',
      'Graph fidelity: "Jaccard 0.3962 → 1.0000; 0.9435 → 1.0000", the two disagreeing E1 cells after the barrel fix.',
    ],
    ['The dependency-cruiser comparison of the original F2 is left out: the slide claim rests on the compiler comparison.']));
}

// ---------------- F3: before and after the fix round (author key) ----------------
{
  const BEF = C.s.before;
  const AFT = C.s.after;
  const rec = [[12, 12, 12, 12], [11, 11, 11, 11], [10, 10, 10, 10], [12, 12, 12, 12], [7, 9, 9, 9]];
  const pre = [[12, 13, 12, 12], [11, 64, 11, 11], [10, 10, 10, 10], [12, 13, 12, 12], [7, 7, 9, 9]];
  const mkRows = (d, pooled) => [
    ...STYLES.map((s, i) => ({ label: s, bars: [{ k: d[i][0], n: d[i][1], color: BEF }, { k: d[i][2], n: d[i][3], color: AFT }] })),
    { label: 'All five', bold: true, sep: true, bars: pooled },
  ];
  const opts = { labelW: 190, valueW: 150, barH: 28, barGap: 8, rowGap: 30 };
  const [l1, h1] = hbars(40, 30, 650, { title: 'Violations found', rows: mkRows(rec, [{ k: 52, n: 54, color: BEF, strong: true }, { k: 54, n: 54, color: AFT, strong: true }]), ...opts });
  const [l2] = hbars(740, 30, 650, { title: 'Reports right', rows: mkRows(pre, [{ k: 52, n: 107, color: BEF, strong: true }, { k: 54, n: 54, color: AFT, strong: true }]), ...opts });
  let b = l1 + l2;
  let y = 30 + h1 + 44;
  b += legend(40, y, [[BEF, 'before the fix round'], [AFT, 'after']], 26)[0];
  b += T(W - 40, y, 'whiskers: plausible range', { size: 26, fill: C.muted, anchor: 'end' });
  y += 34;
  b += rect(40, y, W - 80, 900 - y - 24, { rx: 14, fill: C.panel });
  const cx = [70, 520, 970];
  const stats = [['Clean apps that pass', '4/5', '5/5'], ['Look-alikes wrongly failed', '5/14', '0/14'], ['Reports right, all five', '0.49', '1.00']];
  stats.forEach(([lab, a, z], i) => {
    b += T(cx[i], y + 44, lab, { size: 26, fill: C.muted });
    b += T(cx[i], y + 102, a, { size: 46, weight: 700, fill: C.muted });
    const aw = tw(a, 46, 700);
    b += T(cx[i] + aw + 20, y + 100, '→', { size: 40, fill: C.muted });
    b += T(cx[i] + aw + 76, y + 102, z, { size: 46, weight: 700, fill: AFT });
  });
  savePlain('F3-devset-before-after', canvas(SIDE, b), caption('F3-devset-before-after',
    'Against the author key, the fix round took "reports right" for the defining rules from 52/107 = 0.49 to 54/54, with no planted violation lost and no false fail left on the clean apps or the look-alikes. Development set, not a validity estimate.',
    [
      'Development set: rules, "12/12, 11/11, 10/10, 12/12, 7/9; pooled 52/54 = 0.96 [0.87, 0.99]" (blocking recall before).',
      'Development set: rules, "12/13, 11/64, 10/10, 12/13, 7/7; pooled 52/107 = 0.49 [0.39, 0.58]" (blocking precision before).',
      'Development set: rules, "12/12, 11/11, 10/10, 12/12, 9/9; pooled 54/54 = 1.00 [0.93, 1.00]; 3 FF-P06 FLOWS_TO rows N/A" (recall and precision now, author view).',
      'Development set: rules, "4/5 → 5/5" (clean variants passing) and "5/14 → 0/14" (near-misses with a blocking false positive).',
    ],
    ['Plain words: violations found = blocking recall; reports right = blocking precision; author key = author manifest; look-alike = near-miss; clean app = clean variant.', 'The blind-key view of the same run is F3b.']));
}

// ---------------- F3b: author key vs blind key ----------------
{
  const AU = C.s.after;
  const BL = C.s.blind;
  const rec = [[12, 12, 12, 14], [11, 11, 7, 10], [10, 10, 10, 13], [12, 12, 12, 18], [9, 9, 9, 9]];
  const pre = [[12, 12, 12, 12], [11, 11, 7, 11], [10, 10, 10, 10], [12, 12, 12, 12], [9, 9, 9, 9]];
  const mkRows = (d, pooled) => [
    ...STYLES.map((s, i) => ({ label: s, bars: [{ k: d[i][0], n: d[i][1], color: AU }, { k: d[i][2], n: d[i][3], color: BL }] })),
    { label: 'All five', bold: true, sep: true, bars: pooled },
  ];
  const opts = { labelW: 190, valueW: 150, barH: 28, barGap: 8, rowGap: 30 };
  const [l1, h1] = hbars(40, 30, 650, { title: 'Violations found', rows: mkRows(rec, [{ k: 54, n: 54, color: AU, strong: true, ci: [0.93, 1.0] }, { k: 50, n: 64, color: BL, strong: true, ci: [0.67, 0.86] }]), ...opts });
  const [l2] = hbars(740, 30, 650, { title: 'Reports right', rows: mkRows(pre, [{ k: 54, n: 54, color: AU, strong: true, ci: [0.93, 1.0] }, { k: 50, n: 54, color: BL, strong: true, ci: [0.82, 0.97] }]), ...opts });
  let b = l1 + l2;
  let y = 30 + h1 + 44;
  b += legend(40, y, [[AU, 'author key'], [BL, 'blind key (written without the rules)']], 26)[0];
  y += 34;
  b += rect(40, y, W - 80, 900 - y - 24, { rx: 14, fill: C.panel });
  b += T(70, y + 40, 'All five, blind key: violations found 0.78 (plausible range 0.67–0.86);', { size: 28, weight: 700 });
  b += T(70, y + 76, 'reports right 0.93 (0.82–0.97). Author key: 54/54 (0.93–1.00).', { size: 28, weight: 700 });
  b += T(70, y + 114, '39 rows where the keys and the tool disagree wait for the author to rule on.', { size: 26, fill: C.muted });
  savePlain('F3b-author-vs-blind', canvas(SIDE, b), caption('F3b-author-vs-blind',
    'The same run scored against a second, blind answer key finds fewer of its expected violations (50/64 = 0.78) and is right on 50/54 = 0.93 of its reports; 39 disagreements wait for the author.',
    [
      'Development set: rules, "12/12, 11/11, 10/10, 12/12, 9/9; pooled 54/54 = 1.00 [0.93, 1.00]; 3 FF-P06 FLOWS_TO rows N/A" (author view now).',
      'Development set: rules, "12/14, 7/10, 10/13, 12/18, 9/9; pooled 50/64 = 0.78 [0.67, 0.86]" (blind recall).',
      'Development set: rules, "12/12, 7/11, 10/10, 12/12, 9/9; pooled 50/54 = 0.93 [0.82, 0.97]" (blind precision).',
      'Development set: rules, "39" (adjudication rows).',
    ],
    ['Pooled whiskers use the printed intervals; per-style whiskers are computed by kit.mjs wilson(), as in figures/.']));
}

// ---------------- F6: AI reviewer catch ----------------
{
  const R1 = '#8FB3DE';
  const R2 = '#2F6DB5';
  const V2 = '#173C6E';
  const rows = [
    { label: 'service skips the repository', bars: [{ k: 4, n: 4, color: R1 }] },
    { label: 'controller holds business logic', bars: [{ k: 1, n: 1, color: R1 }] },
    { label: 'database code in the core', bars: [{ k: 1, n: 1, color: R1 }, { k: 3, n: 3, color: R2 }] },
    { label: 'framework leaks into the core', bars: [{ k: 2, n: 4, color: R1 }, { k: 10, n: 13, color: R2 }] },
    { label: 'duplicated business rule', bars: [{ k: 1, n: 1, color: R1 }, { k: 8, n: 8, color: R2 }, { k: 9, n: 9, color: V2 }] },
    { label: ['two clean problem types', 'both rounds'], bold: true, sep: true, bars: [{ k: 16, n: 21, color: C.ink, strong: true, ci: [0.55, 0.89], label: '16/21 = 0.76' }] },
    { label: ['all rounds', 'includes confounded cases'], bars: [{ k: 30, n: 35, color: C.s.before, label: '30/35', textColor: C.muted, nowhisker: true }] },
  ];
  const [l1, h1] = hbars(40, 20, W - 80, { title: 'Planted problems the AI reviewer catches', rows, labelW: 520, valueW: 230, barH: 28, barGap: 7, rowGap: 28 });
  let b = l1;
  let y = 20 + h1 + 40;
  b += legend(40, y, [[R1, 'round 1 (one small app)'], [R2, 'round 2 (AI-built projects)'], [V2, 'repeat, fixed control']], 26, 34)[0];
  y += 30;
  b += rect(40, y, W - 80, 900 - y - 20, { rx: 14, fill: C.panel });
  b += T(70, y + 46, 'Harmless controls wrongly failed: 8/47 → 4/50 after the control fix', { size: 28, weight: 700 });
  b += T(70, y + 84, 'Two clean problem types: plausible range 0.55–0.89.', { size: 26, fill: C.muted });
  savePlain('F6-judge-catch', canvas(SIDE, b), caption('F6-judge-catch',
    'On the two problem types whose planted cases are not confounded (database code in the core, framework leaks into the core), the AI reviewer catches 16/21 = 0.76 (plausible range 0.55–0.89) over both rounds; the 30/35 over all rounds includes confounded cases. With the fixed harmless control it wrongly fails 4/50.',
    [
      'Judge and cheap proxies: "4/4, 1/1, 1/1, 1/1, 2/4; pooled 9/11" (round 1 catch per operator).',
      'Judge and cheap proxies: "8/8; 10/13 = 0.77 [0.50, 0.92] (E1 6/8, hand 4/5); 3/3; pooled 21/24" (round 2).',
      'Judge and cheap proxies: "9/9 = 1.00 [0.70, 1.00]" (DUP-RULE v2 seeds caught).',
      'Judge and cheap proxies: "30/35 = 0.86 [0.71, 0.94]", qualified: "both rounds 16/21 = 0.76 [0.55, 0.89]" on FRAMEWORK-LEAK + PERSIST-IN-DOMAIN.',
      'Judge and cheap proxies: "8/47 = 0.17 [0.09, 0.30] → 4/50 = 0.08 [0.03, 0.19]" (pooled twin false fails, v1 → v2 twin).',
    ],
    ['30/35 is shown without a whisker and in grey, labelled "includes confounded cases".', 'Plain words: AI reviewer = LLM judge; planted problem = seed; harmless control = twin.']));
}

// ---------------- F7: three instruments on the same planted problems ----------------
{
  const P = C.s.proxy;
  const J = C.s.judge;
  const R = C.s.rules;
  const rows = [
    { label: ['round 1', '11 planted'], bars: [{ k: 11, n: 11, color: P }, { k: 9, n: 11, color: J }, { k: 0, n: 11, color: R }] },
    { label: ['duplicated rule,', 'real copies, 9'], sep: true, bars: [{ k: 2, n: 9, color: P }, { k: 9, n: 9, color: J }, { k: 0, n: 9, color: R }] },
  ];
  const [l1, h1] = hbars(40, 20, 820, { title: 'Planted problems caught', rows, labelW: 270, valueW: 110, barH: 50, barGap: 14, rowGap: 80 });
  let b = l1;
  let y = 20 + h1 + 44;
  b += legend(40, y, [[P, 'simple detectors'], [J, 'AI reviewer'], [R, 'fixed rules']], 26, 34)[0];
  // cards
  const cx = 900;
  const cw = W - 40 - cx;
  const cards = [
    [P, '6/6', 'hand-written cases of the same problems, caught by the simple detectors'],
    [P, '14 flags', 'false flags by the simple detectors on 146 files of the 5 clean apps'],
    [R, '0/11', 'caught by the fixed rules in round 1: they do not read this'],
  ];
  let cy = 30;
  for (const [col, big, txt] of cards) {
    const [pt, ph] = para(cx + 34, cy + 112, txt, cw - 60, { size: 26, fill: C.ink });
    const h = 112 + ph + 8;
    b += rect(cx, cy, cw, h, { rx: 14, fill: '#fff', stroke: C.grid, sw: 2 }) + rect(cx, cy, 10, h, { rx: 4, fill: col });
    b += T(cx + 34, cy + 66, big, { size: 46, weight: 700, fill: col });
    b += pt;
    cy += h + 22;
  }
  y = 900 - 150;
  const [nt, nh] = para(70, y + 46, 'The simple detectors were written after reading round 1. On real copies they fall to 2/9 while the AI reviewer stays at 9/9.', W - 140, { size: 28 });
  b += rect(40, y, W - 80, nh + 40, { rx: 14, fill: C.devSoft });
  b += nt;
  savePlain('F7-proxies-judge-rules', canvas(SIDE, b), caption('F7-proxies-judge-rules',
    'Simple detectors catch every round-1 planted problem but were written after reading it, and fall to 2/9 on real duplicated-rule copies; the AI reviewer stays at 9/9; the fixed rules catch none, because they do not read this kind of evidence.',
    [
      'Judge and cheap proxies: "11/11 = 1.00 [0.74, 1.00]; 9/11; 0/11" (round-1 seeds: cheap proxy / judge / symbolic rules).',
      'Judge and cheap proxies: "1/9, 2/9, either 2/9; 0/9" (DUP-RULE v2: either proxy 2/9; symbolic rules 0/9).',
      'Judge and cheap proxies: "9/9 = 1.00 [0.70, 1.00]" (DUP-RULE v2 seeds caught by the judge).',
      'Judge and cheap proxies: "6/6 [0.61, 1.00]" (hand-written analogues flagged by the proxies).',
      'Judge and cheap proxies: "14 flags on 146 files (101 before one revision)".',
    ],
    ['Per-operator rows of the original F7 are left out; the claim rests on the pooled round-1 row and the duplicated-rule row.']));
}

// ---------------- F9: Study 1 data, read by the current version ----------------
{
  let b = '';
  b += T(40, 50, 'AI-built projects: findings from defining rules, per file', { size: 30, weight: 700 });
  const models = ['Opus', 'Sonnet', 'Haiku', 'gpt-5.6-terra'];
  const cols = [['no spec', '(folder hint only)'], ['short prose', ''], ['full spec', '']];
  const gx = 290;
  const cw = 350;
  cols.forEach(([a, z], i) => {
    b += T(gx + i * cw + cw / 2 - 6, 104, a, { size: 28, weight: 700, anchor: 'middle' });
    if (z) b += T(gx + i * cw + cw / 2 - 6, 138, z, { size: 26, fill: C.muted, anchor: 'middle' });
  });
  models.forEach((m, r) => {
    const y = 160 + r * 82;
    b += T(gx - 22, y + 48, m, { size: 28, anchor: 'end' });
    [0, 1, 2].forEach((i) => {
      b += rect(gx + i * cw, y, cw - 14, 70, { rx: 10, fill: C.layerSoft.domain, stroke: C.layer.domain, sw: 2 });
      b += T(gx + i * cw + 22, y + 46, '0', { size: 34, weight: 700, fill: C.layer.domain });
      b += T(gx + i * cw + cw - 36, y + 46, 'all warnings', { size: 26, fill: C.muted, anchor: 'end' });
    });
  });
  b += T(40, 520, 'Every finding on these projects is a warning (never fails).', { size: 28, weight: 700 });
  // SO4 bars
  const rows = [
    { label: ['import loaded', 'at run time'], bars: [{ k: 0, n: 6, color: C.s.before }, { k: 6, n: 6, color: C.s.after }] },
    { label: ['all planted', 'violations'], bold: true, sep: true, bars: [{ k: 67, n: 73, color: C.s.before, strong: true }, { k: 73, n: 73, color: C.s.after, strong: true }] },
  ];
  const [l2] = hbars(40, 560, 900, { title: '7 real codebases: planted violations found', rows, labelW: 250, valueW: 120, barH: 28, barGap: 6, rowGap: 30, titleSize: 30 });
  b += l2;
  b += legend(980, 690, [[C.s.before, 'Study 1 version']], 26)[0];
  b += legend(980, 740, [[C.s.after, 'current version']], 26)[0];
  savePlain('F9-study1-under-v13', canvas(SIDE, b), caption('F9-study1-under-v13',
    'Read by the current version, the Study 1 AI-built projects have no defining-rule finding in any cell (every finding is a warning), and on the 7 real codebases the planted violations found go from 67/73 to 73/73, the gain being the import loaded at run time (0/6 → 6/6). Descriptive, not a contrast.',
    [
      'Study 1 under v1.3: "0 blocking per file in all 65 cells (0 of all 72); advisory share 1.000".',
      'Study 1 under v1.3: "67/73 = 0.918 → 73/73 = 1.000; MO-X01 0/6 → 6/6".',
    ],
    ['Per-cell project counts of the original F9 are left out (NUMBERS.md gives only the 65-cell total).', 'The other eight operators of the original F9 (all unchanged) are left out.']));
}

// ---------------- C7: Study 1 in one chart ----------------
{
  const reg = C.ink;
  const ph = C.s.after;
  const groups = [
    ['7 real codebases, planted violations', [
      ['violations found', 0.893, [0.787, 0.974], 'reg'],
      ['reports right', 0.838, [0.719, 0.97], 'reg'],
    ]],
    ['Real code, findings checked by hand: reports right', [
      ['"unsure" counted as wrong', 0.328, [0.132, 0.609], 'reg'],
      ['"unsure" left out', 0.608, [0.351, 0.816], 'ph'],
      ['"unsure" counted as right', 0.789, [0.5, 0.933], 'ph'],
    ]],
    ['AI-built projects: health score by spec', [
      ['no spec (folder hint only)', 0.951, null, 'reg'],
      ['full spec', 0.92, null, 'reg'],
      ['short prose', 0.887, null, 'reg'],
    ]],
    ['AI reviewer agrees with a second AI panel', [
      ['agreement (36 items)', 0.982, [0.949, 1.0], 'reg'],
    ]],
  ];
  const lx = 470;
  const px = 500;
  const pw = 600;
  const sx = (v) => px + v * pw;
  let b = '';
  let y = 40;
  const y0 = y;
  let body = '';
  for (const [g, rows] of groups) {
    body += rect(34, y - 6, tw(g, 28, 700) + 16, 42, { fill: '#FFFFFF' }) + T(40, y + 26, g, { size: 28, weight: 700 });
    y += 52;
    for (const [lab, v, ci, kind] of rows) {
      const col = kind === 'reg' ? (g.startsWith('AI-built') ? C.layer.domain : g.startsWith('AI reviewer') ? C.layer['adapters-inbound'] : reg) : ph;
      body += T(lx, y + 9, lab, { size: 26, anchor: 'end' });
      if (ci) {
        body += line(sx(ci[0]), y, sx(ci[1]), y, { stroke: col, sw: 3 });
        body += line(sx(ci[0]), y - 9, sx(ci[0]), y + 9, { stroke: col, sw: 3 });
        body += line(sx(ci[1]), y - 9, sx(ci[1]), y + 9, { stroke: col, sw: 3 });
      }
      body += kind === 'reg' ? `<circle cx="${sx(v)}" cy="${y}" r="12" fill="${col}"/>` : `<circle cx="${sx(v)}" cy="${y}" r="11" fill="#fff" stroke="${col}" stroke-width="4"/>`;
      body += T(px + pw + 30, y + 9, v.toFixed(3), { size: 26, weight: 700 });
      if (ci) body += T(px + pw + 116, y + 9, `(${ci[0].toFixed(3)}–${ci[1].toFixed(3)})`, { size: 26, fill: C.muted });
      y += 46;
    }
    y += 10;
  }
  for (const t of [0, 0.5, 1]) {
    b += line(sx(t), y0, sx(t), y, { stroke: t === 0 ? C.faint : C.grid, sw: 1.5 });
    b += T(sx(t), y + 32, String(t), { size: 26, fill: C.muted, anchor: 'middle' });
  }
  b += body;
  b += legend(40, y + 90, [[C.ink, 'plan locked in advance', 'dot'], [ph, 'reading declared afterwards', 'ring']], 26)[0];
  b += T(40, y + 136, 'Ranges: plausible range as printed in the Study 1 report.', { size: 26, fill: C.muted });
  savePlain('C7-study1-headline', canvas(SIDE, b), caption('C7-study1-headline',
    'Study 1 (plan locked in advance): on 7 real codebases the tool found 0.893 of the planted violations and 0.838 of its reports were right; on real code the share of right reports depends on how "unsure" labels are read (0.328 to 0.789); in AI-built projects a spec did not raise the health score; the AI reviewer agreed with a second AI panel on 0.982 of items.',
    [
      'Study 1: "0.893 (0.787 to 0.974), N = 75" (SO4 recall, strict, registered).',
      'Study 1: "0.838 (0.719 to 0.970)" (SO4 seeded differential precision, strict).',
      'Study 1: "0.328 (0.132 to 0.609); 0.608 (0.351 to 0.816); 0.789 (0.500 to 0.933)" (real-code precision under three "uncertain" rules: registered, post-hoc, post-hoc).',
      'Study 1: "Holm p = 0.0003; means 0.951 / 0.887 / 0.920" (mean AHS none / minimal-prose / full-aac).',
      'Study 1: "0.982 (0.949 to 1.000), AC1 0.982, κ 0, n = 36" (judge P4 agreement with the Gemini panel).',
    ],
    ['The post-hoc SO4 readings (0.918 corrected and labelled) of the original C7 are left out; the claim rests on the registered values.', 'Health score = AHS; "unsure" = the labellers’ "uncertain".']));
}
