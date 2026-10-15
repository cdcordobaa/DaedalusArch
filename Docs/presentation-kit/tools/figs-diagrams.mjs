// D1 pipeline, D2 four-link chain, F1 measurement chain with status chips.
import { C, FIG, W, frame, save, text, rect, wrap, wrapPath, pill } from './kit.mjs';
import { box, arrow, path, chip, lock } from './diagram.mjs';

// ---------------- D1 pipeline ----------------
{
  const top = 170;
  const cw = 250;
  const gap = 62;
  const xs = [48, 48 + (cw + gap), 48 + 2 * (cw + gap), 48 + 3 * (cw + gap)];
  const x5 = 48 + 4 * (cw + gap) - 20;
  const w5 = W - 48 - x5;
  const rowA = top + 10;
  const rowB = top + 300;
  const hA = 235;
  let b = '';
  b += text(48, top - 8, 'SPEC SIDE', { size: 15, weight: 700, fill: C.muted });
  b += text(48, rowB - 18, 'CODE SIDE', { size: 15, weight: 700, fill: C.muted });
  b += box(xs[0], rowA, cw, hA, { title: 'Architecture spec (YAML)', lines: ['style, layers and their folders', 'allowed dependencies', 'which rules apply, with tiers'], color: C.layer.application });
  b += box(xs[1], rowA, cw, hA, { title: 'Fitness compiler', lines: ['picks a Cypher template per rule', 'binds layers and parameters from the spec'], color: C.layer.application });
  b += box(xs[2], rowA, cw, hA, { title: 'Fitness functions', lines: ['one Cypher query per rule', 'e.g. FF-S01 dependency direction'], color: C.layer.application });
  b += box(xs[0], rowB, cw, hA, { title: 'TypeScript code', lines: ['the project as written', '(a repository, or a generated tree)'], color: C.layer.domain });
  b += box(xs[1], rowB, cw, hA, { title: 'Extractor', lines: ['ts-morph + type checker', 'resolves imports, barrels, types'], color: C.layer.domain });
  b += box(xs[2], rowB, cw, hA, { title: 'APG in Neo4j', lines: ['nodes: File, Class, Interface, Method, Package', 'edges: IMPORTS, IMPLEMENTS, CALLS …', 'every node carries its layer'], color: C.layer.domain });
  const evY = rowA + 60;
  const evH = rowB + hA - 60 - evY;
  b += box(xs[3], evY, cw, evH, { title: 'Evaluate', lines: ['run every query on the graph', 'each returned row is a finding', 'deterministic: same code, same rows'], color: C.ink, fill: C.panel });
  for (const [r, col] of [[rowA, C.layer.application], [rowB, C.layer.domain]]) {
    b += arrow(xs[0] + cw + 4, r + hA / 2, xs[1] - 6, r + hA / 2, { color: C.ink });
    b += arrow(xs[1] + cw + 4, r + hA / 2, xs[2] - 6, r + hA / 2, { color: C.ink });
  }
  b += arrow(xs[2] + cw + 4, rowA + hA / 2, xs[3] - 6, Math.max(rowA + hA / 2, evY + 40));
  b += arrow(xs[2] + cw + 4, rowB + hA / 2, xs[3] - 6, Math.min(rowB + hA / 2, evY + evH - 40));
  // right column: findings -> judge -> verdict
  const h5 = 140;
  const g5 = 46;
  const y5 = [rowA - 20, rowA - 20 + h5 + g5, rowA - 20 + 2 * (h5 + g5)];
  b += box(x5, y5[0], w5, h5, { title: 'Findings, by tier', lines: ['blocking: defining constraints of the style', 'advisory: metrics, proxies, conventions'], color: C.ink });
  b += box(x5, y5[1], w5, h5, { title: 'LLM judge (frozen)', lines: ['FF-N01 integrity, FF-N02 intent, per unit', 'reported; never blocks in v1.3'], color: C.layer['adapters-inbound'], dash: '8 5' });
  b += box(x5, y5[2], w5, h5, { title: 'AHS score + verdict', lines: ['verdict fails on any blocking finding', 'AHS: weighted score per dimension'], color: C.ink, fill: C.panel });
  b += arrow(xs[3] + cw + 4, evY + evH / 2, x5 - 6, y5[0] + h5 / 2);
  b += arrow(x5 + w5 / 2, y5[0] + h5 + 4, x5 + w5 / 2, y5[1] - 6);
  b += arrow(x5 + w5 / 2, y5[1] + h5 + 4, x5 + w5 / 2, y5[2] - 6);
  const height = Math.max(rowB + hA, y5[2] + h5) + 110;
  const svg = frame({
    title: 'How the firewall works: code in, verdict out',
    subtitle: 'The spec becomes graph queries; the code becomes a graph; findings are the rows the queries return. The judge adds a reported, non-blocking reading.',
    badgeKind: 'design',
    badgeLabel: 'PIPELINE (v1.3 defaults)',
    body: b,
    height,
    footer: 'Sources: src/apg-extractor, src/fitness-compiler, src/evaluation-engine, src/llm-critic; tiers Docs/v1.3/rule-tiers.md; verdict rule "any blocking violation" Docs/DiagnosticRuns/v1.3-study1-rerun-2026-10-15.md (Instrument).',
  });
  save(FIG, 'D1-pipeline', svg, `
# D1 · pipeline

**Title on slide:** How the firewall works: code in, verdict out

**What it shows.** The DaedalusArch pipeline in v1.3. On the spec side, the YAML spec (style, layers, allowed dependencies, rules) is compiled into one Cypher query per rule. On the code side, the extractor turns the TypeScript project into the Architectural Property Graph (APG) in Neo4j, with a layer on every node. Evaluation runs every query on the graph; every returned row is a finding. Findings are split into blocking and advisory tiers. The frozen LLM judge reads units of code for two semantic dimensions (FF-N01 integrity, FF-N02 intent); in v1.3 its result is reported and never blocks. The verdict fails on any blocking finding; the AHS is the weighted score.

**One idea.** Rules are graph queries compiled from the spec; findings are rows.

**Sources.**
- Code: \`src/apg-extractor\`, \`src/fitness-compiler\`, \`src/evaluation-engine\`, \`src/llm-critic\` (module names).
- Tiers: \`Docs/v1.3/rule-tiers.md\`. The judge dimensions never block: \`Docs/v1.3/pilot-outcome-memo.md\` §4 ("They are reported per step and never block (rule-tiers.md)").
- Verdict rule in v1.3 ("any blocking violation"): \`Docs/DiagnosticRuns/v1.3-study1-rerun-2026-10-15.md\`, "Instrument and procedure".

**No numbers on this figure.**
`);
}

// ---------------- F1 measurement chain with status chips ----------------
const LINKS = [
  { group: 'Link 1 · code → graph', color: C.layer.domain, rows: [
    { name: 'Graph fidelity', ev: 'E1 (72 projects): 99.7% of tsc edges found, 99.2% confirmed; SO4 scoped vs tsc 96.6% / 94.3%. 0 unexplained disagreements.', status: [['done', 'done on dev set'], ['defined', 'adjudication pending']], file: 'Docs/DiagnosticRuns/v1.3-graph-fidelity-2026-10-14.md' },
  ] },
  { group: 'Link 2 · spec / ground truth', color: C.layer.application, rows: [
    { name: 'Reference set', ev: '5 reference projects, 71 variants (52 planted, 14 near-misses, 5 clean), hand-written expected graphs and manifests.', status: [['done', 'built']], file: 'Docs/v1.3-reference-notes.md · Docs/v1.3-ddd-notes.md' },
  ] },
  { group: 'Link 3 · rules', color: C.layer['adapters-outbound'], rows: [
    { name: 'Rules, author view', ev: 'Blocking recall 57/57, precision 57/57; clean controls 5/5 pass; 0/14 near-misses with a blocking false alarm.', status: [['done', 'done on dev set']], file: 'Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md' },
    { name: 'Rules, blind view', ev: 'Blocking recall 53/67, precision 53/57 against independently written manifests; 39 disagreement rows await the author.', status: [['done', 'done on dev set'], ['defined', 'adjudication pending']], file: 'same doc, §3 · results/v1.3-reference/after-member-facts/adjudication.csv' },
    { name: 'APG v2 rules', ev: 'APG v2 detects 25/27 planted cases (import graph: 0/27); 0 blocking rows on the 19 clean and near-miss variants after the scope fix.', status: [['done', 'done on dev set']], file: 'Docs/DiagnosticRuns/apg2-scope-2026-10-15.md' },
  ] },
  { group: 'Link 4 · meaning', color: C.layer['adapters-inbound'], rows: [
    { name: 'LLM judge', ev: 'Catches 30/35 planted anti-patterns; fails 4/50 neutral twins. Construct sensitivity, n = 35.', status: [['done', 'done on dev set']], file: 'Docs/DiagnosticRuns/v1.3-duprule-v2-2026-10-15.md' },
    { name: 'Labelling + hold-out', ev: '"Correct": 2,668/2,668 checkable findings. "Meaningful": not measured yet. Two-human protocol written. Hold-out run: once, after freeze.', status: [['defined', 'defined, not run'], ['sealed', 'sealed']], file: 'Docs/DiagnosticRuns/v1.3-labelling-2026-10-15.md · Docs/v1.3/human-labelling-protocol.md · Docs/v1.3/holdout-prespec.md' },
  ] },
];
{
  const top = 200;
  const gx = 48;
  const gw = 230;
  const nx = gx + gw + 20;
  const nw = 230;
  const ex = nx + nw + 10;
  const ew = 560;
  const sx = ex + ew + 20;
  let b = '';
  b += text(nx, top - 18, 'EVIDENCE', { size: 15, weight: 700, fill: C.muted });
  b += text(ex, top - 18, 'WHAT IT SHOWS (headline)', { size: 15, weight: 700, fill: C.muted });
  b += text(sx, top - 18, 'STATUS · BACKING FILE', { size: 15, weight: 700, fill: C.muted });
  let y = top;
  for (const g of LINKS) {
    const gy = y;
    for (const r of g.rows) {
      const evl = wrap(r.ev, ew - 10, 17);
      const fl = wrapPath(r.file, W - 48 - sx - 16, 14);
      const rh = Math.max(evl.length * 23 + 22, 26 + 16 + fl.length * 19 + 22, 70);
      b += rect(nx, y, W - 48 - nx, rh, { rx: 8, fill: '#FFFFFF', stroke: C.grid });
      b += text(nx + 14, y + 30, r.name, { size: 19, weight: 700 });
      evl.forEach((l, i) => (b += text(ex, y + 28 + i * 23, l, { size: 17 })));
      let cx = sx;
      for (const [k, lab] of r.status) {
        const [s, w] = chip(cx, y + 11, k, lab);
        b += s;
        cx += w + 8;
      }
      fl.forEach((l, i) => (b += text(sx, y + 58 + i * 19, l, { size: 14, fill: C.muted })));
      y += rh + 10;
    }
    const gh = y - 10 - gy;
    b += rect(gx, gy, gw, gh, { rx: 10, fill: g.color, stroke: 'none' });
    wrap(g.group, gw - 28, 20, 700).forEach((l, i) => (b += text(gx + 16, gy + 32 + i * 25, l, { size: 20, weight: 700, fill: '#FFFFFF' })));
    if (g !== LINKS[LINKS.length - 1]) b += arrow(gx + gw / 2, y - 8, gx + gw / 2, y + 6, { color: C.muted, sw: 2 });
    y += 14;
  }
  // legend
  let lx = 48;
  const ly = y + 14;
  for (const [k, lab] of [['done', 'done on dev set'], ['defined', 'defined, not run / pending'], ['sealed', 'sealed (not opened)']]) {
    const [s, w] = chip(lx, ly, k, lab);
    b += s;
    lx += w + 18;
  }
  b += text(lx + 6, ly + 18, 'A chain is only as strong as its weakest link: link 4 is the least measured.', { size: 17, fill: C.ink, weight: 600 });
  const height = ly + 26 + 100;
  const svg = frame({
    title: 'The measurement chain: what is measured, what is not yet',
    subtitle: 'Each link must hold for a finding to mean "this code breaks the architecture". Status per link on 2026-10-15.',
    badgeKind: 'dev',
    badgeLabel: 'DEVELOPMENT SET · nothing here is a validity estimate',
    body: b,
    height,
    footer: ['Every number is quoted from the backing file on its row. "Sealed" items (the hold-out manifests, the Study 2 tasks) live outside the repository and were not opened for this kit.'],
  });
  save(FIG, 'F1-measurement-chain', svg, `
# F1 · measurement-chain

**Title on slide:** The measurement chain: what is measured, what is not yet

**What it shows.** The four links a finding must pass to mean "this code breaks the architecture" (code → graph, spec/ground truth, rules, meaning), and the seven pieces of evidence behind them, each with a status chip and its backing file. Green = done on the development set; orange = defined or pending (not run, or waiting for the author's adjudication); grey with a lock = sealed, not opened.

**One idea.** Links 1 to 3 have development-set evidence; link 4 (meaning) is the least measured, and the hold-out has not run.

**Numbers and sources (row by row).**
- Graph fidelity: E1 72 projects, refCoveredByApg 0.996684 and apgConfirmedByRef 0.991602 against tsc (= dependency-cruiser on E1); SO4 scoped against tsc 0.966302 / 0.943257; extractor-bug (unexplained) 0 / 0. \`Docs/DiagnosticRuns/v1.3-graph-fidelity-2026-10-14.md\`, "Headline" and "Disagreement classes". The \`human_verdict\` column is still empty ("What to fix", item 5).
- Reference set: 5 projects, 71 variants; 5 clean, 14 near-misses, 52 planted (\`results/v1.3-reference/after-member-facts/report.md\`: variants 14+13+14+15+15 = 71; planted detected denominators 10+9+10+11+12 = 52). \`Docs/v1.3-reference-notes.md\`, \`Docs/v1.3-ddd-notes.md\`.
- Rules, author view: pooled blocking recall 57/57, precision 57/57; 5/5 clean variants pass; 0/14 near-misses with a blocking false positive. \`Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md\` §3.
- Rules, blind view: pooled blocking recall 53/67, precision 53/57 (blind, expanded); adjudication rows 39. Same doc §3 and \`results/v1.3-reference/after-member-facts/adjudication.csv\`.
- APG v2: ablation recall after scope 25/27; blocking rows on the 19 clean and near-miss variants 29 → 0. \`Docs/DiagnosticRuns/apg2-scope-2026-10-15.md\`, "Summary".
- LLM judge: pooled seeds 30/35 = 0.86 [0.71, 0.94]; twin false fail with v2 in place 4/50 = 0.08 [0.03, 0.19]. \`Docs/DiagnosticRuns/v1.3-duprule-v2-2026-10-15.md\` §3, "Pooled across rounds".
- Labelling: all 2,668 checkable findings correct; "meaningful" not measured (labeller hit its usage limit). \`Docs/DiagnosticRuns/v1.3-labelling-2026-10-15.md\`, "Summary". Human protocol "defined; nothing labelled yet": \`Docs/v1.3/human-labelling-protocol.md\`. Hold-out "draft, to be frozen", run once: \`Docs/v1.3/holdout-prespec.md\`.

**Caveats to say.** The development set is AI-written; no human labels exist yet; the hold-out has not run; the judge figures rest on n = 35 seeds.
`);
}

// ---------------- D2 the four links, conceptually ----------------
{
  const top = 190;
  const n = 4;
  const bw = 300;
  const gap = (W - 96 - n * bw) / (n - 1);
  const items = [
    ['1 · Code → graph', 'Is every import, class and layer in the graph, and nothing else?', 'Agreement with tsc and dependency-cruiser; hand-written expected graphs.', C.layer.domain],
    ['2 · Spec', 'Does the spec say what the style means?', 'Presets from the literature; construct decisions Q1–Q25; reference manifests.', C.layer.application],
    ['3 · Rules', 'Does each compiled query find exactly the violations of its rule?', 'Planted variants, near-misses and clean controls; author and blind manifests.', C.layer['adapters-outbound']],
    ['4 · Meaning', 'Would an architect want this finding fixed?', 'Judge catch test; labelling (model, then two humans); the sealed hold-out.', C.layer['adapters-inbound']],
  ];
  let b = '';
  items.forEach(([t, q, ev, col], i) => {
    const x = 48 + i * (bw + gap);
    b += rect(x, top, bw, 70, { rx: 12, fill: col, stroke: 'none' });
    b += text(x + bw / 2, top + 45, t, { size: 24, weight: 700, fill: '#fff', anchor: 'middle' });
    b += text(x + 4, top + 108, 'Question', { size: 15, weight: 700, fill: C.muted });
    wrap(q, bw - 8, 19).forEach((l, j) => (b += text(x + 4, top + 136 + j * 25, l, { size: 19 })));
    b += text(x + 4, top + 250, 'Evidence', { size: 15, weight: 700, fill: C.muted });
    wrap(ev, bw - 8, 17).forEach((l, j) => (b += text(x + 4, top + 276 + j * 23, l, { size: 17 })));
    if (i < n - 1) b += arrow(x + bw + 8, top + 35, x + bw + gap - 10, top + 35, { sw: 3 });
  });
  const height = top + 400 + 80;
  const svg = frame({
    title: 'Four links between code and a meaningful finding',
    subtitle: 'A finding is trustworthy only if every link holds. F1 shows the evidence and status of each link.',
    badgeKind: 'design',
    badgeLabel: 'METHOD',
    body: b,
    height,
    footer: 'Sources: Docs/v1.3/validation-protocol.md (links and targets) · Docs/v1.3/study2-outline.md §8 (link 1, link 3, links 3+4) · Docs/v1.3/construct-decisions.md',
  });
  save(FIG, 'D2-measurement-chain', svg, `
# D2 · measurement-chain (conceptual)

**Title on slide:** Four links between code and a meaningful finding

**What it shows.** The four links of the measurement chain as questions, with the kind of evidence each needs: (1) code → graph, (2) the spec says what the style means, (3) each rule finds exactly its violations, (4) the finding is meaningful to an architect. It differs from F1: D2 is the concept (no status, no numbers); F1 is the evidence and status per link.

**Sources.** \`Docs/v1.3/validation-protocol.md\` (§2 graph fidelity, §1 blind manifests, §3 labelling, §6 judge); \`Docs/v1.3/study2-outline.md\` §8 (the link numbering: link 1 graph, link 3 rules, links 3+4 precision "correct"); \`Docs/v1.3/construct-decisions.md\` (spec questions Q1 to Q25).

**No numbers on this figure.**
`);
}
