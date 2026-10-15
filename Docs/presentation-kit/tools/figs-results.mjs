// F2 graph fidelity classes, F9 Study 1 under v1.3, C7 Study 1 headline, C6 ISE, C4 APG v2 uniqueness, F5 ablation grid.
import { C, FIG, W, frame, save, text, rect, line, wrap, tw, wilson, readJson } from './kit.mjs';
import { pbars, legendRow, whiskerNote } from './charts.mjs';

// ---------------- F2 graph fidelity: disagreement classes ----------------
{
  const top = 160;
  const CLS = [
    ['barrel', 're-export / barrel', '#2F6DB5'],
    ['excluded', 'excluded files (tests, JSON)', '#8E5BB5'],
    ['oor', 'outside the project root', '#C2671B'],
    ['dts', '.d.ts', '#1B7F5A'],
    ['alias', 'path alias not resolved by the reference', '#AEB6C2'],
  ];
  const ROWS = [
    { label: ['E1, 72 projects', 'vs tsc (primary)'], v: { barrel: 39 }, agree: 'agreement: 99.7% found, 99.2% confirmed (3306 shared edges)' },
    { label: ['SO4, 7 real bases', 'vs tsc (primary)'], v: { barrel: 218, excluded: 202, oor: 329, dts: 2 }, agree: 'scoped agreement: 96.6% found, 94.3% confirmed (2294 shared edges)' },
    { label: ['SO4, 7 real bases', 'vs dependency-cruiser'], v: { barrel: 218, excluded: 308, oor: 639, dts: 2, alias: 829 }, agree: 'secondary reference: misses the ${configDir} path aliases', muted: true },
  ];
  let b = '';
  const lx = 48;
  const lw = 250;
  const bx = lx + lw + 20;
  const bw = W - 48 - bx - 150;
  let y = top + 10;
  b += text(bx, y, 'Share of disagreeing edges by class (each bar = 100% of that comparison\'s disagreements)', { size: 17, fill: C.muted });
  y += 26;
  for (const r of ROWS) {
    const tot = Object.values(r.v).reduce((a, c) => a + c, 0);
    b += text(lx + lw, y + 26, r.label[0], { size: 19, weight: 700, anchor: 'end', fill: r.muted ? C.muted : C.ink });
    b += text(lx + lw, y + 48, r.label[1], { size: 15, anchor: 'end', fill: C.muted });
    let cx = bx;
    for (const [k, , col] of CLS) {
      const v = r.v[k] ?? 0;
      if (!v) continue;
      const w = (v / tot) * bw;
      b += rect(cx, y, w, 46, { fill: col, opacity: r.muted ? 0.55 : 1 });
      if (w > 44) b += text(cx + w / 2, y + 29, String(v), { size: 17, weight: 700, fill: '#fff', anchor: 'middle' });
      cx += w;
    }
    b += text(bx + bw + 14, y + 22, `${tot} edges`, { size: 17, weight: 700 });
    b += text(bx + bw + 14, y + 44, 'unexplained: 0', { size: 15, weight: 700, fill: C.status.done });
    b += text(bx, y + 70, r.agree, { size: 15, fill: C.muted });
    y += 108;
  }
  const [lg] = legendRow(bx, y, CLS.map(([, l, c]) => [c, l]), 16);
  b += lg;
  y += 40;
  // barrel fix inset
  b += rect(48, y, W - 96, 150, { rx: 12, fill: C.panel, stroke: C.grid });
  b += text(72, y + 36, 'The one in-scope class, barrels, was fixed (ADR-V13-01): the extractor now keeps the literal edge to the barrel too', { size: 19, weight: 700 });
  const cells = [['E1 cell opus · task-management · none · run-1', '0.396', '1.000'], ['E1 cell opus · order-fulfilment · full-aac · run-1', '0.944', '1.000']];
  cells.forEach(([lab, a, c], i) => {
    const x = 72 + i * 760;
    b += text(x, y + 74, lab, { size: 16, fill: C.muted });
    b += text(x, y + 112, `Jaccard ${a}`, { size: 26, weight: 700, fill: C.s.neutral });
    const aw = tw(`Jaccard ${a}`, 26, 700);
    b += text(x + aw + 14, y + 110, '→', { size: 26, fill: C.muted });
    b += text(x + aw + 52, y + 112, c, { size: 26, weight: 700, fill: C.s.after });
    b += text(x, y + 136, 'v1.2E graph → v1.3 literal view; the other 70 E1 cells already agreed exactly', { size: 15, fill: C.muted });
  });
  y += 150 + 24;
  const svg = frame({
    title: 'Graph fidelity: every disagreement with the compiler is explained',
    subtitle: 'The APG\'s file-to-file import edges against tsc (primary) and dependency-cruiser. They are second extractors, not ground truth: figures are agreement.',
    badgeKind: 'dev',
    badgeLabel: 'DEV DATA: E1 + SO4 (agreement, not precision)',
    body: b,
    height: y + 80,
    footer: ['Classes and counts: Docs/DiagnosticRuns/v1.3-graph-fidelity-2026-10-14.md, "Disagreement classes" (missing-in-APG + missing-in-reference summed per class) and "Headline"; results/v1.3-fidelity/{e1,so4}/aggregate.json.', 'Barrel fix: aidlc-docs/construction/v1.3-barrels/barrels-notes.md §4 (results/v1.3-barrels/fidelity/). Human adjudication (human_verdict) is still empty.'],
  });
  save(FIG, 'F2-graph-fidelity-classes', svg, `
# F2 · graph-fidelity-classes

**Title on slide:** Graph fidelity: every disagreement with the compiler is explained

**What it shows.** For each comparison of the APG's file-to-file import edges against a second extractor, the disagreeing edges split by cause (each bar is 100% of that comparison's disagreements; the count is on the right). tsc (the TypeScript compiler's own resolution) is the primary reference; dependency-cruiser is secondary because it does not expand \`\${configDir}\` path aliases. No disagreement is unexplained. Below: the effect of the barrel fix on the two E1 cells that disagreed.

**One idea.** The graph agrees with the compiler; the remaining differences are by design (excluded tests, code outside the root, declaration files), and the one real defect class, barrels, was fixed.

**Numbers and sources.** \`Docs/DiagnosticRuns/v1.3-graph-fidelity-2026-10-14.md\`:
- Headline, E1 (72) vs tsc: both 3306, APG 3334, ref 3317; refCoveredByApg 0.996684, apgConfirmedByRef 0.991602, Jaccard 0.988341 (dependency-cruiser identical on E1). SO4 (7) vs tsc, scoped: 2294 / 2432 / 2374; 0.966302 / 0.943257 / 0.913217.
- Classes (missing-in-APG + missing-in-ref): E1 vs tsc re-export/barrel 11 + 28 = 39. SO4 vs tsc: barrel 80 + 138 = 218; excluded-file 202; out-of-root 329; .d.ts 2 (total 751 = 613 + 138, matching the raw headline). SO4 vs dependency-cruiser: barrel 218; path-alias 0 + 829; excluded-file 308; out-of-root 639; .d.ts 2. extractor-bug (unexplained): 0 / 0.
- Barrel fix: \`aidlc-docs/construction/v1.3-barrels/barrels-notes.md\` §4: task-management/none/run-1 Jaccard 0.3962 → 1.0000; order-fulfilment/full-aac/run-1 0.9435 → 1.0000 (v1.3 literal view). "The other 70 E1 cells and SO4 were not rerun"; those 70 already agreed exactly (fidelity doc, "Per project").

**Caveats to say.** Agreement with other extractors, not precision: the human adjudication sheet (\`human_verdict\`) is still empty. E1 is AI-generated code; SO4 bases were known while v1.3 was built.
`);
}

// ---------------- F9 Study 1 under v1.3 ----------------
{
  const top = 160;
  const rows = [];
  const csv = readJson ? null : null;
  const lines = (await import('node:fs')).readFileSync(new URL('../../../results/v1.3-study1-rerun/e1/by_level_model.csv', import.meta.url), 'utf8').trim().split('\n');
  const head = lines[0].split(',');
  const recs = lines.slice(1).map((l) => Object.fromEntries(l.split(',').map((v, i) => [head[i], v])));
  const MODELS = [['claude-opus-5-5', 'Opus'], ['claude-sonnet-5-5', 'Sonnet'], ['claude-haiku-4-5', 'Haiku'], ['gpt-5.6-terra', 'gpt-5.6-terra (Codex)']];
  const LEVELS = ['none', 'minimal-prose', 'full-aac'];
  const get = (lv, m) => recs.find((r) => r.spec_level === lv && r.model === m);
  let b = '';
  const gx = 48;
  const cw = 190;
  const lab = 230;
  b += text(gx, top + 20, 'E1: blocking findings per file, by spec level × model (65 accepted cells)', { size: 21, weight: 700 });
  let y = top + 50;
  LEVELS.forEach((lv, j) => (b += text(gx + lab + j * cw + cw / 2, y + 16, lv, { size: 17, weight: 700, anchor: 'middle' })));
  y += 30;
  for (const [m, name] of MODELS) {
    b += text(gx + lab - 14, y + 36, name, { size: 18, anchor: 'end' });
    LEVELS.forEach((lv, j) => {
      const r = get(lv, m);
      const x = gx + lab + j * cw;
      b += rect(x + 4, y, cw - 8, 62, { rx: 8, fill: C.layerSoft.domain, stroke: C.layer.domain });
      b += text(x + cw / 2, y + 28, r ? `${Number(r.v13_mean_blocking_per_file).toFixed(0)} blocking` : '—', { size: 19, weight: 700, fill: C.layer.domain, anchor: 'middle' });
      b += text(x + cw / 2, y + 50, r ? `n=${r.n_cells} · advisory ${Math.round(Number(r.v13_advisory_share) * 100)}%` : '', { size: 15, fill: C.muted, anchor: 'middle' });
    });
    y += 70;
  }
  y += 6;
  wrap('Every cell: 0 blocking findings, so 100% of findings are advisory (74–89% of them FF-CV05 test-file pairing). The Study 1 spec-level difference lives entirely in the advisory tier.', 3 * cw + lab - 10, 16).forEach((l, i) => (b += text(gx, y + 18 + i * 21, l, { size: 16, fill: C.ink })));
  // right: SO4 recall by operator
  const rx = gx + lab + 3 * cw + 60;
  const rw = W - 48 - rx;
  const OPS = [['MO-C04 orphan file', 14, 14, 14, 14], ['MO-CV02', 12, 12, 12, 12], ['MO-DF01', 5, 5, 5, 5], ['MO-P01', 13, 13, 13, 13], ['MO-S01', 8, 8, 8, 8], ['MO-S03', 2, 2, 2, 2], ['MO-SO01', 11, 11, 11, 11], ['MO-SO02', 2, 2, 2, 2], ['MO-X01 dynamic import', 0, 6, 6, 6]];
  const prow = OPS.map(([l, a, n1, c, n2]) => ({ label: l, bars: [{ k: a, n: n1, color: C.s.before }, { k: c, n: n2, color: C.s.after }] }));
  prow.push({ label: 'Total', bold: true, sep: true, bars: [{ k: 67, n: 73, color: C.s.before, strong: true }, { k: 73, n: 73, color: C.s.after, strong: true }] });
  const [p, ph] = pbars(rx, top, rw, { title: 'SO4: seeded recall by operator', rows: prow, labelW: 210, valueW: 70, barH: 13, barGap: 3, rowGap: 9 });
  b += p;
  let yb = Math.max(y + 70, top + ph + 10);
  const [lg] = legendRow(rx, yb, [[C.s.before, 'Study 1 (v1.2E)'], [C.s.after, 'v1.3 dev instrument']], 16);
  b += lg;
  b += text(rx, yb + 26, 'Twin specificity: 68/73 → 67/73 (one advisory FF-C03 row).', { size: 15, fill: C.muted });
  yb += 50;
  const svg = frame({
    title: 'Study 1 data, re-read by the v1.3 instrument',
    subtitle: 'Descriptive only. v1.3 verdicts are not comparable with Study 1\'s registered ones; this is a reading aid, not a contrast.',
    badgeKind: 'v13onS1',
    body: b,
    height: yb + 80,
    footer: ['E1 grid: results/v1.3-study1-rerun/e1/by_level_model.csv (columns v13_mean_blocking_per_file, v13_advisory_share, v13_cv05_share); Docs/DiagnosticRuns/v1.3-study1-rerun-2026-10-15.md §1.', 'SO4: same doc §2 table; results/v1.3-study1-rerun/so4/{score.json, by_operator.csv}. The MO-X01 gain is the dynamicImports option; the SO4 bases were known while v1.3 was built.'],
  });
  save(FIG, 'F9-study1-under-v13', svg, `
# F9 · study1-under-v13

**Title on slide:** Study 1 data, re-read by the v1.3 instrument

**What it shows.** Left: for the 65 accepted E1 cells (generated projects, Study 1's SO5 grid), blocking findings per file by spec level and model under v1.3 tiers: zero in every cell, so 100% of findings are advisory. Right: SO4 seeded recall per mutation operator, Study 1's instrument v2 (grey) against the v1.3 development instrument (blue): only the dynamic-import operator changes (0/6 → 6/6).

**One idea.** In v1.3 terms, the generated projects never break a defining constraint; Study 1's spec-level differences were all in advisory metrics. And v1.3 closes Study 1's only seeded-detection gap (dynamic imports).

**Numbers and sources.**
- E1 grid: \`results/v1.3-study1-rerun/e1/by_level_model.csv\`, \`v13_mean_blocking_per_file\` = 0 for every row; \`v13_advisory_share\` = 1.000 for every row; \`v13_cv05_share\` 0.742 to 0.887 across the 12 level × model rows (shown as 74–89%). \`Docs/DiagnosticRuns/v1.3-study1-rerun-2026-10-15.md\` §1: "0 of 65 accepted cells, and 0 of all 72".
- SO4: same doc §2: total recall 67/73 = 0.918 (v1.2E, v2) → **73/73 = 1.000** (v1.3); MO-X01 0/6 → 6/6; twin specificity 68/73 = 0.932 → 67/73 = 0.918 (realworld-test MO-C04n:1, an advisory FF-C03 row).

**Caveats to say.** Descriptive, not a registered result; no CIs by design. E1 contains no planted violation, so 0 blocking is not a recall figure. The SO4 bases and MO-X01 were known while v1.3 was built (MO-X01 motivated \`dynamicImports\`), so 73/73 is not a held-out estimate. E1 had 0 blocking violations.
`);
}

// ---------------- C7 Study 1 headline (forest plot) ----------------
{
  const top = 150;
  const ITEMS = [
    { sec: 'SO4 seeded detection (held-out, symbolic-only)' },
    { l: 'Recall, strict (registered, N = 75)', p: 0.893, ci: [0.787, 0.974], tag: 'registered' },
    { l: 'Recall, corrected rule (N = 73)', p: 0.918, ci: [0.818, 1.0], tag: 'post-hoc' },
    { l: 'Recall, labelled reading (N = 73)', p: 0.918, ci: [0.818, 1.0], tag: 'post-hoc' },
    { l: 'Seeded precision, strict', p: 0.838, ci: [0.719, 0.97], tag: 'registered' },
    { l: 'Precision, corrected', p: 1.0, ci: null, tag: 'post-hoc' },
    { l: 'Precision, labelled', p: 0.957, ci: [0.893, 1.0], tag: 'post-hoc' },
    { sec: 'Real-code precision (24 labelled findings, effective n 11.5)' },
    { l: '"uncertain" = not real', p: 0.328, ci: [0.132, 0.609], tag: 'registered' },
    { l: '"uncertain" excluded', p: 0.608, ci: [0.351, 0.816], tag: 'post-hoc' },
    { l: '"uncertain" = real', p: 0.789, ci: [0.5, 0.933], tag: 'post-hoc' },
    { sec: 'E1: spec level × model (47 Claude cells), mean AHS' },
    { l: 'no spec ("none")', p: 0.951, ci: null, tag: 'registered', color: C.layer.domain },
    { l: 'full-aac spec', p: 0.92, ci: null, tag: 'registered', color: C.layer.domain },
    { l: 'minimal-prose spec', p: 0.887, ci: null, tag: 'registered', color: C.layer.domain },
    { sec: 'Judge validation (P4) vs Gemini panel' },
    { l: 'Agreement, E1 (n = 36)', p: 0.982, ci: [0.949, 1.0], tag: 'registered', color: C.layer['adapters-inbound'] },
  ];
  const lx = 48;
  const lw = 560;
  const px = lx + lw + 20;
  const pw = 640;
  const nx = px + pw + 30;
  let b = '';
  let y = top + 10;
  const rows = [];
  for (const it of ITEMS) {
    if (it.sec) {
      y += 14;
      b += text(lx, y + 18, it.sec, { size: 19, weight: 700 });
      y += 32;
      continue;
    }
    rows.push([it, y]);
    y += 30;
  }
  const y0 = top + 20;
  const y1 = y;
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    b += line(px + t * pw, y0, px + t * pw, y1, { stroke: t === 0 ? C.faint : C.grid, sw: 1 });
    b += text(px + t * pw, y1 + 22, t === 1 ? '1.0' : String(t), { size: 15, fill: C.muted, anchor: 'middle' });
  }
  for (const [it, yy] of rows) {
    const cy = yy + 10;
    b += text(px - 14, cy + 6, it.l, { size: 17, anchor: 'end' });
    const col = it.color ?? (it.tag === 'registered' ? C.ink : C.s.after);
    if (it.ci) {
      b += line(px + it.ci[0] * pw, cy, px + it.ci[1] * pw, cy, { stroke: col, sw: 2.5 });
      b += line(px + it.ci[0] * pw, cy - 6, px + it.ci[0] * pw, cy + 6, { stroke: col, sw: 2 });
      b += line(px + it.ci[1] * pw, cy - 6, px + it.ci[1] * pw, cy + 6, { stroke: col, sw: 2 });
    }
    b += it.tag === 'registered' ? `<circle cx="${px + it.p * pw}" cy="${cy}" r="8" fill="${col}"/>` : `<circle cx="${px + it.p * pw}" cy="${cy}" r="7.5" fill="#fff" stroke="${col}" stroke-width="3"/>`;
    b += text(nx, cy + 6, it.p.toFixed(3) + (it.ci ? `  [${it.ci[0].toFixed(3)}, ${it.ci[1].toFixed(3)}]` : ''), { size: 16 });
  }
  y = y1 + 44;
  b += `<circle cx="${lx + 8}" cy="${y - 6}" r="8" fill="${C.ink}"/>` + text(lx + 24, y, 'registered analysis', { size: 16 });
  b += `<circle cx="${lx + 228}" cy="${y - 6}" r="7.5" fill="#fff" stroke="${C.s.after}" stroke-width="3"/>` + text(lx + 244, y, 'post-hoc reading (declared)', { size: 16 });
  b += text(lx + 520, y, 'Intervals: as printed in the report (bootstrap for SO4; Kish-Wilson for real code).', { size: 15, fill: C.muted });
  y += 26;
  b += rect(48, y, W - 96, 70, { rx: 10, fill: C.study1Soft });
  b += text(66, y + 28, 'E1: spec level has an effect (Holm p = 0.0003), in the reverse direction: no spec scores best. At equal size, full-aac beats minimal-prose', { size: 17 });
  b += text(66, y + 54, '(Cliff\'s δ 0.52; 0.47 after a LOC adjustment). Judge P4: AC1 0.982, Cohen\'s κ 0 (the judge passed all 36 items: a weak test of fail detection).', { size: 17 });
  y += 70 + 20;
  const svg = frame({
    title: 'Study 1 in one chart',
    subtitle: 'The frozen v1.2E study: seeded detection, real-code precision, the spec-level effect in generated code, and judge agreement.',
    badgeKind: 'study1',
    body: b,
    height: y + 80,
    footer: ['All values: Docs/reports/director-report-2026-10.md §1 "Main findings" items 1, 3, 8 and 9 (with their result files: results/so4-heldout/agg-strict/prf_overall.csv, agg-corrected/prf_overall.csv, score.json, agg/precision_baseline.csv;', 'results/e1-grid/agg/so5_tests.csv, agg-size/size_tests.csv; results/e1-grid/label-plan-p4-api/labelling.json).'],
  });
  save(FIG, 'C7-study1-headline', svg, `
# C7 · study1-headline

**Title on slide:** Study 1 in one chart

**What it shows.** The headline numbers of Study 1 (the frozen v1.2E study) on one 0-to-1 axis: SO4 seeded detection (recall and precision in three readings), real-code precision under three treatments of "uncertain" labels, the E1 mean AHS by spec level (Claude arm), and the judge's P4 agreement with the Gemini panel. Filled dots are registered analyses; open dots are declared post-hoc readings. Whiskers are the intervals printed in the report.

**One idea.** Study 1 shows strong seeded detection, uncertain real-code precision, a reversed spec-level effect explained by project size, and a judge that agrees with a panel but was barely tested on failing code.

**Numbers and sources** (all from \`Docs/reports/director-report-2026-10.md\` §1, "Main findings"):
- Item 1, SO4: strict recall 0.893 (0.787 to 0.974), seeded differential precision 0.838 (0.719 to 0.970), N = 75 [results/so4-heldout/agg-strict/prf_overall.csv]; corrected recall 0.918 (0.818 to 1.000), precision 1.000, F1 0.957, N = 73 [agg-corrected]; labelled recall 0.918 (0.818 to 1.000), precision 0.957 (0.893 to 1.000), F1 0.937 [results/so4-heldout/score.json; agg/prf_overall.csv].
- Item 3, real-code precision: 0.328 (Kish-Wilson 0.132 to 0.609), 0.608 (0.351 to 0.816), 0.789 (0.500 to 0.933); n = 24 labelled items, effective n 11.5 [results/so4-heldout/agg/precision_baseline.csv].
- Item 8, E1: spec level Holm p = 0.0003; model p = 0.438; interaction p = 0.026; means none 0.951, minimal-prose 0.887, full-aac 0.920 [results/e1-grid/agg/so5_tests.csv]; at equal size full-aac beats minimal-prose, Cliff's δ 0.52 (0.47 after LOC adjustment) [results/e1-grid/agg-size/size_tests.csv].
- Item 9, judge P4: n = 36, agreement 0.982 (0.949 to 1.000), Gwet's AC1 0.982, Cohen's κ 0 [results/e1-grid/label-plan-p4-api/labelling.json].

**Caveats to say.** The golden set is below its registered floor (N = 75 vs 80, item 2). Real-code precision rests on 24 items and depends on the "uncertain" rule. κ = 0 is a prevalence effect; the panel is one model, not ground truth. E1 is one vendor arm, two tasks.
`);
}

// ---------------- C6 ISE ----------------
{
  const top = 150;
  const T = ['clean-architecture', 'layered', 'nestjs', 'hexagonal', 'ddd'];
  const styleRows = [
    ...[[14, 14], [13, 13], [14, 14], [15, 15], [15, 15]].map(([k, n], i) => ({ label: T[i], bars: [{ k, n, color: C.s.after }] })),
    ...[['P1 clean, renamed', 14, 14], ['P2 layered, renamed', 13, 13], ['P3 nestjs, renamed', 14, 14], ['P4 hexagonal, renamed', 0, 15, '0/15 → read as clean'], ['P5 ddd, renamed', 0, 15, '0/15 → read as clean']].map(([l, k, n, lab], i) => ({ label: l, sep: i === 0, bars: [{ k, n, color: k === 0 ? C.red : C.s.blind, label: lab, textColor: k === 0 ? C.red : undefined }] })),
  ];
  const layerRows = [
    { label: '5 reference projects', bars: [{ k: 146, n: 146, color: C.s.after }] },
    { label: 'P1 clean, renamed', sep: true, bars: [{ k: 29, n: 29, color: C.s.blind }] },
    { label: 'P2 layered, renamed', bars: [{ k: 27, n: 27, color: C.s.blind }] },
    { label: 'P3 nestjs, renamed', bars: [{ k: 28, n: 29, color: C.s.blind }] },
    { label: 'P4 hexagonal, renamed', bars: [{ k: 20, n: 30, color: C.red, textColor: C.red }] },
    { label: 'P5 ddd, renamed', bars: [{ k: 6, n: 31, color: C.red, textColor: C.red }] },
  ];
  const pw = (W - 96 - 60) / 2;
  const [a, ha] = pbars(48, top, pw, { title: 'Style classified correctly (variants)', rows: styleRows, labelW: 230, valueW: 190, barH: 20 });
  const [c, hc] = pbars(48 + pw + 60, top, pw, { title: 'Files given the right layer (clean variant)', rows: layerRows, labelW: 230, valueW: 90, barH: 20 });
  let b = a + c;
  let y = top + Math.max(ha, hc) + 16;
  const [lg] = legendRow(48, y, [[C.s.after, 'reference projects (preset folder names)'], [C.s.blind, 'rename probes (layer folders renamed)'], [C.red, 'probe failure']], 16);
  b += lg + text(W - 48, y, whiskerNote, { size: 15, fill: C.muted, anchor: 'end' });
  y += 26;
  b += rect(48, y, W - 96, 70, { rx: 10, fill: C.devSoft });
  b += text(66, y + 28, 'Weakness: when the folder names stop matching the presets, a hexagonal or DDD project is read as Clean Architecture, and findings', { size: 17 });
  b += text(66, y + 54, 'follow the wrong spec (planted violations touched under the inferred spec: P4 5/11, P5 0/12). On preset names, inference is close to a lookup.', { size: 17 });
  y += 90;
  const svg = frame({
    title: 'Inferring the spec from the graph (ISE): accurate until folders are renamed',
    subtitle: 'Exploratory. The inferrer reads only the graph and picks the closest style preset; rename probes give the layer folders names no vocabulary contains.',
    badgeKind: 'dev',
    body: b,
    height: y + 70,
    footer: ['Source: Docs/DiagnosticRuns/ise-prototype-2026-10-15.md §2 (a) style classification, (b) per-file layer accuracy, (d) downstream; results/v1.3-ise/2026-10-15/{measure.json, downstream.json}.'],
  });
  save(FIG, 'C6-ise', svg, `
# C6 · ise

**Title on slide:** Inferring the spec from the graph (ISE): accurate until folders are renamed

**What it shows.** Implicit Specification Extraction (ISE) infers a project's architecture spec from its own graph. Left: share of variants whose style is classified correctly, for the five reference projects and five rename probes (P1–P5: the layer folders renamed to names outside any vocabulary). Right: share of files assigned the right layer in the clean variant. Red marks the two probes that fail.

**One idea.** ISE is accurate when folder names follow the presets and breaks for hexagonal and DDD once they do not: the style is misread and the findings follow the wrong spec.

**Numbers and sources.** \`Docs/DiagnosticRuns/ise-prototype-2026-10-15.md\` §2:
- (a) Variants correct: clean 14/14, layered 13/13, nestjs 14/14, hexagonal 15/15, ddd 15/15; P1 14/14, P2 13/13, P3 14/14, **P4 0/15** (classified clean-architecture, confidence 0.67), **P5 0/15** (clean-architecture, 1.00).
- (b) Per-file layers: 5 reference projects 146/146; P1 29/29; P2 27/27; P3 28/29; **P4 20/30 (67%)**; **P5 6/31 (19%)**.
- (d) Planted violations under the inferred spec: P4 5/11, P5 0/12 (true spec 11/11, 11/12).
- Threat: the reference projects use the presets' folder names, so inference there "is close to a lookup" (§5).

**Caveats to say.** Exploratory, not pre-registered; development set; one probe per style; the rename probes are the real test and two of five fail.
`);
}

// ---------------- C4 APG v2 uniqueness ----------------
{
  const top = 150;
  const rows = [
    { label: ['APG v2', 'after the scope fix'], bold: true, bars: [{ k: 25, n: 27, color: C.s.after, strong: true, label: '25/27' }] },
    { label: ['APG v2', 'before the scope fix'], bars: [{ k: 27, n: 27, color: '#8FB3DE' }] },
    { label: ['same template', 'on the v1.3 graph'], sep: true, bars: [{ k: 0, n: 27, color: C.s.neutral }] },
    { label: ['v1.3 rules', 'at the case locus'], bars: [{ k: 0, n: 27, color: C.s.neutral }] },
    { label: ['import graph', 'dependency-cruiser, translated'], bars: [{ k: 0, n: 27, color: C.s.proxy }] },
    { label: ['dependency-cruiser', 'best hand-written rules'], bars: [{ k: 10, n: 27, color: C.s.proxy }] },
    { label: ['graphify', 'code graph, from its schema'], bars: [{ k: 0, n: 27, color: C.s.blind, label: '0/27 as a rule (6 derivable)' }] },
  ];
  const lw = 900;
  const [a, ha] = pbars(48, top, lw, { title: 'Planted cases detected (27 cases, 5 enrichments)', rows, labelW: 290, valueW: 230, barH: 24 });
  const rx = 48 + lw + 50;
  const rw = W - 48 - rx;
  let b = a;
  let y = top;
  b += text(rx, y + 22, 'False alarms on the dev set', { size: 22, weight: 700 });
  y += 44;
  b += text(rx, y + 16, '19 clean and near-miss variants', { size: 16, fill: C.muted });
  y += 30;
  const bars = [['blocking rows', 29, 0], ['advisory rows', 40, 21]];
  const maxv = 40;
  for (const [lab, bf, af] of bars) {
    b += text(rx, y + 18, lab, { size: 18, weight: 700 });
    y += 28;
    for (const [v, col, t] of [[bf, '#8FB3DE', 'before'], [af, C.s.after, 'after']]) {
      b += text(rx, y + 17, t, { size: 15, fill: C.muted });
      b += rect(rx + 60, y, Math.max(2, (v / maxv) * (rw - 120)), 22, { fill: col, rx: 3 });
      b += text(rx + 66 + Math.max(2, (v / maxv) * (rw - 120)), y + 17, String(v), { size: 17, weight: 700 });
      y += 30;
    }
    y += 12;
  }
  wrap('The scope fix (test code, composition roots, a 4-type minimum) was decided and committed before re-measuring. It cost CP4 and CP5 (2-type components).', rw, 16).forEach((l, i) => (b += text(rx, y + 16 + i * 21, l, { size: 16 })));
  y += 100;
  let yb = Math.max(top + ha, y) + 10;
  b += rect(48, yb, W - 96, 64, { rx: 10, fill: C.devSoft });
  b += text(66, yb + 27, 'Expressiveness, not prevalence: the 27 cases were planted by the enrichment\'s author. 17 of them are reported by APG v2 and by no other arm;', { size: 17 });
  b += text(66, yb + 51, 'the public-API cases (PA1–PA4) are also caught by one hand-written dependency-cruiser rule, so they are a convenience gain, not an expressiveness gain.', { size: 17 });
  yb += 84;
  const svg = frame({
    title: 'What only the APG can express: APG v2 against import and code graphs',
    subtitle: 'Planted cases for type flow, components, public API, async coupling and I/O. Live Cypher on Neo4j equals the in-memory mirrors (63/63 runs).',
    badgeKind: 'dev',
    badgeLabel: 'DEV DATA: planted fixtures',
    body: b,
    height: yb + 80,
    footer: ['Detection: Docs/DiagnosticRuns/apg2-ablation-2026-10-15.md, "Results" summary table (before scope); Docs/DiagnosticRuns/apg2-scope-2026-10-15.md, "Summary" (25/27 after; false-alarm rows 29 → 0 and 40 → 21).', 'Per-case data: Docs/DiagnosticRuns/apg2-ablation-2026-10-15/ablation.json; Docs/DiagnosticRuns/apg2-scope-2026-10-15/{fixtures-live.json, reference-live.json}.'],
  });
  save(FIG, 'C4-apg2-uniqueness', svg, `
# C4 · apg2-uniqueness

**Title on slide:** What only the APG can express: APG v2 against import and code graphs

**What it shows.** Left: of 27 planted cases, how many each representation detects: APG v2 (after and before the scope fix), the same templates on the v1.3 graph, the nearest v1.3 rules, dependency-cruiser with translated rules and with the best hand-written rules, and graphify read from its export schema. Right: APG v2 false alarms on the 19 clean and near-miss variants of the development set, before and after the a-priori scope fix.

**One idea.** APG v2 states facts an import graph cannot hold (inferred type flow, named channels, global I/O calls); a hand-written import rule gets 10 of 27, the translated rules none.

**Numbers and sources.**
- \`Docs/DiagnosticRuns/apg2-ablation-2026-10-15.md\`, "Results" summary: APG v2 27/27; APG v1.3 graph (same template) 0/27; v1.3 rules at locus 0/27; dependency-cruiser translated 0/27; hand-written 10/27; graphify 0/27 as a rule, 6 derivable by post-processing (CP1–CP3, CP6, PA1, PA2). 17 of 27 reported by APG v2 alone (TF1–TF4, CP4–CP6, AS1–AS5, IO1–IO5).
- \`Docs/DiagnosticRuns/apg2-scope-2026-10-15.md\`, "Summary": after the scope fixes 25/27 (lost CP4 and CP5, 2 types each, under the a-priori minimum of 4); live Cypher equals the mirrors 63/63; blocking rows on the 19 clean and near-miss variants 29 → **0**; advisory rows 40 → **21**.

**Caveats to say.** Planted by the enrichment's author (expressiveness, not prevalence); development data; the hand-written dependency-cruiser rules are "our best effort"; graphify was not run (schema reading).
`);
}

// ---------------- F5 ablation grid ----------------
{
  const top = 160;
  const cases = JSON.parse((await import('node:fs')).readFileSync(new URL('../../../Docs/DiagnosticRuns/apg2-ablation-2026-10-15/ablation.json', import.meta.url), 'utf8')).filter((c) => c.kind === 'planted');
  const GRAPHIFY = { CP1: 'd', CP2: 'd', CP3: 'd', CP6: 'd', PA1: 'd', PA2: 'd', TF5: 'p', IO6: 'p', IO7: 'p', PA4: 'p' };
  const ARMS = ['APG v2', 'APG v1.3 graph', 'v1.3 rules', 'dep-cruiser translated', 'dep-cruiser hand-written', 'graphify (schema)'];
  const lx = 48;
  const lw = 520;
  const cw = (W - 96 - lw) / ARMS.length;
  let b = '';
  ARMS.forEach((a, j) => {
    const x = lx + lw + j * cw + cw / 2;
    wrap(a, cw - 10, 16, 700).forEach((l, i) => (b += text(x, top + 18 + i * 19, l, { size: 16, weight: 700, anchor: 'middle' })));
  });
  let y = top + 52;
  const rh = 24.5;
  let lastEnr = null;
  for (const c of cases) {
    if (c.enrichment !== lastEnr) {
      if (lastEnr) y += 6;
      lastEnr = c.enrichment;
    }
    const dropped = c.id === 'CP4' || c.id === 'CP5';
    b += text(lx, y + 17, c.id, { size: 15, weight: 700 });
    const title = c.title.length > 52 ? c.title.slice(0, 51) + '…' : c.title;
    b += text(lx + 48, y + 17, title, { size: 15, fill: C.muted });
    const vals = [c.apg2 && !dropped ? 'y' : dropped ? 'x' : 'n', c.v13Graph ? 'y' : 'n', c.v13Rules.length ? 'y' : 'n', c.dcTranslated.length ? 'y' : 'n', c.dcHand.length ? 'y' : 'n', GRAPHIFY[c.id] ?? 'n'];
    vals.forEach((v, j) => {
      const x = lx + lw + j * cw + 6;
      const col = { y: C.s.after, n: '#F1F3F6', d: '#D9C6EA', p: '#EADFF3', x: '#FBE3D2' }[v];
      b += rect(x, y + 1, cw - 12, rh - 4, { rx: 4, fill: col, stroke: v === 'x' ? C.s.proxy : 'none', dash: v === 'x' ? '4 3' : undefined });
      const lab = { y: 'detected', n: '', d: 'derivable', p: 'partial', x: 'dropped (4-type min.)' }[v];
      if (lab) b += text(x + (cw - 12) / 2, y + 16, lab, { size: v === 'x' ? 13.5 : 14, weight: 600, fill: v === 'y' ? '#fff' : v === 'x' ? C.s.proxy : C.s.blind, anchor: 'middle' });
    });
    y += rh;
  }
  const tot = [25, 0, 0, 0, 10, 0];
  y += 8;
  b += line(lx, y, W - 48, y, { stroke: C.ink, sw: 1.5 });
  b += text(lx, y + 26, 'Detected (after the scope fix)', { size: 17, weight: 700 });
  tot.forEach((t, j) => (b += text(lx + lw + j * cw + cw / 2, y + 26, `${t}/27`, { size: 18, weight: 700, anchor: 'middle', fill: j === 0 ? C.s.after : C.ink })));
  y += 50;
  const svg = frame({
    title: 'APG v2 ablation: 27 planted cases × 6 representations',
    subtitle: 'One row per planted case, one column per representation. Blue = reported. The 19 near-misses and the control (all silent) are not shown.',
    badgeKind: 'dev',
    badgeLabel: 'DEV DATA: planted fixtures',
    body: b,
    height: y + 80,
    footer: ['Per case: Docs/DiagnosticRuns/apg2-ablation-2026-10-15/ablation.json (apg2, v13Graph, v13Rules, dcTranslated, dcHand) and the case table in Docs/DiagnosticRuns/apg2-ablation-2026-10-15.md (graphify column).', 'CP4, CP5 after the scope fix: Docs/DiagnosticRuns/apg2-scope-2026-10-15.md §1 (lost to the a-priori minimum of 4 types; reported again with minTypes 0).'],
  });
  save(FIG, 'F5-apg2-ablation-grid', svg, `
# F5 · apg2-ablation-grid

**Title on slide:** APG v2 ablation: 27 planted cases × 6 representations

**What it shows.** The full case grid behind C4: each of the 27 planted APG v2 cases (type flow TF, components CP, public API PA, async coupling AS, I/O IO) against six representations: APG v2, the same template on the v1.3 graph, the nearest v1.3 rules, dependency-cruiser with translated rules, dependency-cruiser with the best hand-written rules, and graphify (read from its export schema: "derivable" = by post-processing its import edges, "partial" = sees the import, not the use). CP4 and CP5 are marked "dropped": the scope fix's a-priori minimum of 4 types per component removed them.

**One idea.** Only the APG v2 column is filled; the import tools reach the cases that are about imports (component cycles, public API, imported I/O packages) and nothing else.

**Sources.** Per case: \`Docs/DiagnosticRuns/apg2-ablation-2026-10-15/ablation.json\` (fields \`apg2\`, \`v13Graph\`, \`v13Rules\`, \`dcTranslated\`, \`dcHand\`); graphify column from the case table of \`Docs/DiagnosticRuns/apg2-ablation-2026-10-15.md\` (adapter notes; graphify was not run). CP4/CP5: \`Docs/DiagnosticRuns/apg2-scope-2026-10-15.md\` §1. Column totals after the scope fix: 25, 0, 0, 0, 10, 0 (graphify 0 as a rule).

**Caveats to say.** Planted by the enrichment's author: expressiveness, not prevalence. Development data. The 19 near-misses and the control are all silent under APG v2 (not drawn).
`);
}
