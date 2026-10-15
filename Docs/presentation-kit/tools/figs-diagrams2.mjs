// D3 neuro-symbolic layers, D4 method, F4 construct questions, F8 timeline, F10 Study 2 design, F11 pilot decision,
// B0 rule anatomy.
import { C, FIG, W, MONO, frame, save, text, rect, line, wrap, wrapPath, esc, readJson } from './kit.mjs';
import { box, arrow, path, chip, lock } from './diagram.mjs';

// ---------------- D3 layered neuro-symbolic design ----------------
{
  const top = 160;
  const L = [
    { n: '4', t: 'Rules over both', d: 'Cypher rules that read graph facts and, later, the semantic layers\' outputs as ordinary node and edge properties.', ex: 'today: symbolic rules only; the judge is reported, never blocks', chip: ['defined', 'partly built'], col: C.ink },
    { n: '3', t: 'LLM judge  ·  grounded ontology', d: 'Frozen LLM judge reads one unit of code against the spec for integrity (FF-N01) and intent (FF-N02). An ontology grounded in the graph would name roles and concepts.', ex: 'judge: frozen, 30/35 planted anti-patterns (dev)  ·  ontology: not built live', chip: ['done', 'judge measured on dev set'], chip2: ['open', 'ontology not built'], col: C.layer['adapters-inbound'] },
    { n: '2', t: 'Cheap semantic proxies (pass 0.5)', d: 'Deterministic code analysis proposes candidate sites: clones, shared literals, persistence or framework in the core, repository bypass, logic density, cohesion. No LLM; ~50–130 ms per project.', ex: '11/11 round-1 seeds but 2/9 on E1 DUP-RULE copies: a candidate generator, not a verdict', chip: ['done', 'prototype on dev set'], col: C.layer['adapters-outbound'] },
    { n: '1', t: 'Symbolic facts: the APG', d: 'Extractor writes files, classes, methods, packages and typed edges (imports, implements, injects, calls, data flow); APG v2 adds signatures, components, channels, I/O.', ex: 'graph agrees with tsc (99.7% / 99.2% on E1); 57/57 blocking rows on the dev set', chip: ['done', 'done on dev set'], col: C.layer.domain },
  ];
  let b = '';
  const x = 48;
  const w = W - 96;
  const h = 132;
  let y = top;
  L.forEach((l, i) => {
    const inset = (3 - i) * 0;
    b += rect(x + inset, y, w - 2 * inset, h, { rx: 14, fill: '#FFFFFF', stroke: l.col, sw: 2.5 });
    b += rect(x + inset, y, 74, h, { rx: 14, fill: l.col });
    b += rect(x + inset + 60, y, 14, h, { fill: l.col });
    b += text(x + inset + 37, y + h / 2 + 14, l.n, { size: 40, weight: 700, fill: '#fff', anchor: 'middle' });
    b += text(x + 100, y + 38, l.t, { size: 24, weight: 700, fill: l.col === C.ink ? C.ink : l.col });
    wrap(l.d, 1180, 17).forEach((s, j) => (b += text(x + 100, y + 68 + j * 22, s, { size: 17 })));
    b += text(x + 100, y + h - 14, l.ex, { size: 15, fill: C.muted, italic: true });
    let cx = x + w - 20;
    for (const c of [l.chip2, l.chip].filter(Boolean)) {
      const [, cw] = chip(0, 0, c[0], c[1]);
      cx -= cw;
      b += chip(cx, y + 18, c[0], c[1])[0];
      cx -= 10;
    }
    if (i < L.length - 1) b += arrow(x + w / 2, y + h + 24, x + w / 2, y + h + 4, { color: C.muted, sw: 2.5 });
    y += h + 28;
  });
  b += text(x + w / 2 + 16, top + 4 * (h + 28) - 4, 'each layer feeds the one above; the cheaper layer runs first', { size: 15, fill: C.muted });
  const svg = frame({
    title: 'A layered neuro-symbolic design',
    subtitle: 'Deterministic facts first, cheap proxies next, the LLM last and only where code meaning is needed. Status chips as of 2026-10-15.',
    badgeKind: 'design',
    badgeLabel: 'DESIGN + STATUS',
    body: b,
    height: top + 4 * (h + 28) + 90,
    footer: ['Sources: layer 1 Docs/DiagnosticRuns/v1.3-graph-fidelity-2026-10-14.md, v1.3-reference-after-member-facts-2026-10-15.md; layer 2 Docs/v1.3/cheap-semantics-design.md ("Purpose"), Docs/DiagnosticRuns/cheap-semantics-2026-10-15.md, v1.3-duprule-v2-2026-10-15.md §5;', 'layer 3 Docs/DiagnosticRuns/v1.3-duprule-v2-2026-10-15.md §3 (judge); the grounded ontology has no committed design or run; layer 4 Docs/v1.3/rule-tiers.md (judge never blocks).'],
  });
  save(FIG, 'D3-neurosymbolic-layers', svg, `
# D3 · neurosymbolic-layers

**Title on slide:** A layered neuro-symbolic design

**What it shows.** Four layers, cheapest at the bottom. (1) Symbolic facts: the APG extracted from the code. (2) Cheap semantic proxies: deterministic analyses that propose candidate sites (no LLM). (3) The LLM judge and, as a planned companion, a grounded ontology. (4) Rules that read both the symbolic facts and the semantic layers' outputs. Each layer carries a status chip.

**One idea.** Spend the LLM only where code meaning is needed, after deterministic layers have done what they can.

**Numbers and sources.**
- Layer 1: E1 agreement with tsc 0.996684 / 0.991602 (\`Docs/DiagnosticRuns/v1.3-graph-fidelity-2026-10-14.md\`, Headline); 57/57 blocking recall and precision on the development set, author view (\`Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md\` §3).
- Layer 2: design and runtime (50 to 130 ms per reference project) in \`Docs/v1.3/cheap-semantics-design.md\`, "Purpose"; 11/11 on round-1 seeds (\`Docs/DiagnosticRuns/cheap-semantics-2026-10-15.md\` §2); 2/9 on DUP-RULE v2 (\`Docs/DiagnosticRuns/v1.3-duprule-v2-2026-10-15.md\` §5). "A proxy proposes candidate sites. It does not give a verdict." (design doc).
- Layer 3: judge pooled catch 30/35 (\`Docs/DiagnosticRuns/v1.3-duprule-v2-2026-10-15.md\` §3). The grounded ontology is not built: there is no committed design or run in the repository, so it is shown as an open item only.
- Layer 4: the judge dimensions are reported and never block (\`Docs/v1.3/rule-tiers.md\`, cited in \`Docs/v1.3/pilot-outcome-memo.md\` §4). Proxy flags are not yet persisted to Neo4j ("Nothing is written to Neo4j", design doc), so "rules over both" is partly built.

**Caveats to say.** The ontology is not built live. Layer 2 and 3 figures are development-set construct sensitivity, not validity estimates.
`);
}

// ---------------- D4 method ----------------
{
  const top = 170;
  const S = [
    { t: 'Study 1', s: 'frozen', d: ['v1.2E instrument', 'pre-registered (v25, 85 artefacts)', 'SO4 held-out seeds, E1 grid, E7 judge'], col: C.study1, chip: ['done', 'done, frozen'] },
    { t: 'v1.3 development set', s: 'now', d: ['5 AI-written reference projects, 71 variants', 'fixes, member facts, APG v2, judge catch', 'construct decisions Q1–Q25 for the author'], col: C.dev, chip: ['done', 'in progress'] },
    { t: 'Sealed hold-out', s: 'next', d: ['manifests sealed outside the repository', 'tool frozen first; run exactly once', 'no tuning afterwards, results as they come'], col: C.status.sealed, chip: ['sealed', 'not yet run'] },
    { t: 'Study 2', s: 'later', d: ['firewall in the loop over feature steps', 'tasks sealed; pre-registered only after', 'the hold-out validation passes'], col: C.layer['adapters-inbound'], chip: ['defined', 'pre-registered later'] },
  ];
  const n = S.length;
  const bw = 330;
  const gap = (W - 96 - n * bw) / (n - 1);
  let b = '';
  S.forEach((st, i) => {
    const x = 48 + i * (bw + gap);
    b += rect(x, top, bw, 300, { rx: 14, fill: '#FFFFFF', stroke: st.col, sw: 2.5, dash: st.chip[0] === 'sealed' ? '9 6' : undefined });
    b += rect(x, top, bw, 64, { rx: 14, fill: st.col });
    b += rect(x, top + 50, bw, 14, { fill: st.col });
    b += text(x + 20, top + 42, st.t, { size: 24, weight: 700, fill: '#fff' });
    if (st.chip[0] === 'sealed') b += lock(x + bw - 40, top + 18, 1.2, '#fff');
    b += chip(x + 20, top + 84, st.chip[0], st.chip[1])[0];
    st.d.forEach((d, j) => wrap(d, bw - 40, 18).forEach((l, k) => (b += text(x + 20, top + 150 + j * 46 + k * 22, l, { size: 18 }))));
    if (i < n - 1) b += arrow(x + bw + 8, top + 150, x + bw + gap - 10, top + 150, { sw: 3 });
  });
  b += rect(48, top + 330, W - 96, 64, { rx: 10, fill: C.panel });
  b += text(66, top + 370, 'Rules: no tuning on the hold-out, which is run once and then spent; the Study 2 tasks are sealed and no v1.3 generation uses them.', { size: 18 });
  const svg = frame({
    title: 'The method: what is frozen, what is open, what is sealed',
    subtitle: 'Study 1 is closed. v1.3 is built on a development set. Validity comes only from a sealed hold-out run once, before Study 2 is registered.',
    badgeKind: 'design',
    badgeLabel: 'METHOD',
    body: b,
    height: top + 394 + 90,
    footer: ['Sources: Docs/reports/director-report-2026-10.md §1 (pre-registration v25, 85 artefacts); Docs/v1.3/validation-protocol.md §1, §4; Docs/v1.3/holdout-prespec.md §1–§6; Docs/v1.3/study2-outline.md (banner, §8).'],
  });
  save(FIG, 'D4-method', svg, `
# D4 · method

**Title on slide:** The method: what is frozen, what is open, what is sealed

**What it shows.** The four stages of the thesis method in order: Study 1 (frozen, pre-registered, v1.2E instrument); the v1.3 development set (AI-written reference projects on which the tool is fixed and measured); the sealed hold-out (manifests sealed outside the repository, run exactly once on a frozen tool); Study 2 (firewall in the loop, pre-registered only after the hold-out validation passes).

**One idea.** Development numbers are for building; validity numbers come only from the hold-out, which nobody has run or tuned on.

**Sources.**
- Study 1 frozen: "registration now stands at version 25, with 85 registered artefacts" (\`Docs/reports/director-report-2026-10.md\` §1).
- Development set: \`Docs/v1.3-reference-notes.md\`, \`Docs/v1.3-ddd-notes.md\`; construct decisions \`Docs/v1.3/construct-decisions.md\`.
- Hold-out: "run once; after that it is spent", "No tuning on the hold-out, of any kind" (\`Docs/v1.3/holdout-prespec.md\` §2, §6); status "draft, to be frozen".
- Study 2: "NOT A PRE-REGISTRATION … Study 2 is not run in v1.3"; prerequisites §8 (\`Docs/v1.3/study2-outline.md\`). Tasks sealed (\`Docs/v1.3/validation-protocol.md\` §4).

**No numbers measured here.** No hash values are shown anywhere in the kit.
`);
}

// ---------------- F4 construct questions ----------------
{
  const top = 160;
  const Q = [
    ['Q3', 'Is a file cycle inside one layer an FF-S02 violation (blocking)?', '0', '4', 'clean, layered, hex', 'C: advisory for in-layer cycles', 'tier split by ADR; cycle classification'],
    ['Q5', 'Is adapter → adapter blocking, and under which rule?', '5', '1', 'hex, ddd', 'D: new rule id, blocking in hex and ddd', 'ADR, new template id'],
    ['Q10', 'Does FF-P01 domain purity apply to the layered business layer?', '3', '0', 'layered', 'C: not applicable; FF-S01 package mapping if declared', 'disable in layered; mapping mechanism'],
    ['Q2', 'Does a type-only import count as a dependency?', '0', '12', 'clean, layered, nestjs, ddd', 'A: yes (status quo)', 'none'],
    ['Q8 + Q14', 'A blocking rule that assumes a fact the extractor lacks (FF-P06 field initialisers; FF-DT03 tier)', '1', '4', 'clean, nestjs, hex, ddd', 'B / A: keep the tier; report the unsupported half as N/A', 'report N/A half'],
    ['Q6', 'Does hexagonal core-isolation (FF-S04) cover the application layer?', '2', '1', 'hex', 'B: yes', 'template binding'],
    ['Q13', 'NestJS: may an application service import a repository (RDQ-2)?', '3', '1', 'nestjs', 'B: yes; FF-P04 follows it', 'FF-P04 (advisory); fix ADR-V13-02 text'],
  ];
  const cols = [['', 110], ['Question', 520], ['Sheet rows', 110], ['Other rows', 110], ['Styles', 210], ['Recommended option', 290], ['Change it implies', 154]];
  let b = '';
  let x = 48;
  const xs = [];
  for (const [, w] of cols) {
    xs.push(x);
    x += w;
  }
  b += rect(48, top, W - 96, 44, { fill: C.ink, rx: 8 });
  cols.forEach(([t], i) => (b += text(xs[i] + 12, top + 29, t, { size: 16, weight: 700, fill: '#fff' })));
  let y = top + 44;
  Q.forEach((q, r) => {
    const cells = q.map((v, i) => wrap(v, cols[i][1] - 22, i === 0 ? 20 : 17, i === 0 ? 700 : 400));
    const rh = Math.max(...cells.map((c) => c.length)) * 22 + 22;
    b += rect(48, y, W - 96, rh, { fill: r % 2 ? '#FFFFFF' : C.panel });
    cells.forEach((c, i) => c.forEach((l, k) => (b += text(xs[i] + 12, y + 28 + k * 22, l, { size: i === 0 ? 20 : 17, weight: i === 0 || i === 5 ? 700 : 400, fill: i === 5 ? C.layer.application : i === 2 || i === 3 ? C.ink : C.ink }))));
    y += rh;
  });
  b += line(48, y, W - 48, y, { stroke: C.ink, sw: 1.5 });
  y += 30;
  wrap('"Sheet rows": rows of the 40-row adjudication sheet the question decides. "Other rows": rows both manifests agree on today that the option puts at stake. Recommended options are proposals: the author decides each one on its construct (literature first), not on the scores, and records it in an ADR before the hold-out freeze. Q8 + Q14 is one policy, so its rows are summed (Q8: 0 + 3; Q14: 1 + 1).', W - 120, 17).forEach((l, i) => (b += text(48, y + i * 23, l, { size: 17, fill: C.muted })));
  y += 4 * 23 + 10;
  const svg = frame({
    title: 'The seven high-stakes construct questions for the author',
    subtitle: 'Each one changes what a rule means. None may be settled by looking at scores; each needs a construct reason and an ADR before the freeze.',
    badgeKind: 'dev',
    badgeLabel: 'DEV SET: OPEN DECISIONS',
    body: b,
    height: y + 80,
    footer: ['Source: Docs/v1.3/construct-decisions.md, "Decide these yourself (high stakes)" and "Summary" table (revision 1); per-option figures in Docs/v1.3/construct-decisions-impact.csv.'],
  });
  save(FIG, 'F4-construct-questions', svg, `
# F4 · construct-questions

**Title on slide:** The seven high-stakes construct questions for the author

**What it shows.** The construct questions that \`Docs/v1.3/construct-decisions.md\` marks "Decide these yourself (high stakes)", in its order: Q3, Q5, Q10, Q2, Q8 + Q14 (one policy), Q6, Q13. For each: the question, how many rows of the 40-row adjudication sheet it decides, how many currently agreed rows it puts at stake, the styles it touches, the recommended option (revision 1) and the change it implies.

**One idea.** Some development-set "errors" are really open questions about what the style means; they are listed, with a recommendation, for the author to decide before the hold-out freeze.

**Source.** \`Docs/v1.3/construct-decisions.md\`, "Summary" table (columns Sheet rows, Other rows, Styles, Recommended, Change) and "Decide these yourself (high stakes)". Q8 + Q14 summed from their two rows (Q8 sheet 0, other 3, styles clean, nestjs, hex, "B: sealed tier, FLOWS_TO half N/A"; Q14 sheet 1, other 1, ddd, "A: blocking; accessor half N/A"). Per-option effects: \`Docs/v1.3/construct-decisions-impact.csv\`.

**Caveats to say.** These are recommendations, not decisions; the figures are development-set rows; revision 1 changed recommendations for Q3, Q5, Q8, Q10, Q14 and Q15 without re-scoring.
`);
}

// ---------------- F8 timeline ----------------
{
  const top = 200;
  const steps = [
    { t: 'Construct decisions', d: 'author answers Q1–Q25; ADRs; Q16 and Q25 each get one dev-set run', k: 'defined', s: 'open, with the author' },
    { t: 'Freeze', d: 'tool commit, tiers, presets, templates, matching frozen; nothing merges until the run', k: 'defined', s: 'not yet' },
    { t: 'Hold-out run', d: 'unseal the hold-out projects, one live run, outputs committed unchanged', k: 'sealed', s: 'sealed' },
    { t: 'Labelling: model', d: '"meaningful" labeller (single vendor) after the outputs are committed', k: 'defined', s: 'defined' },
    { t: 'Labelling: two humans', d: 'blind union sheets with decoys; author audit κ ≥ 0.60', k: 'defined', s: 'defined' },
    { t: 'Loop pilot', d: '3 tasks × 2 arms, k = 4; decides Study 2\'s primary outcome in advance', k: 'defined', s: 'defined, not run' },
    { t: 'Study 2 pre-registration', d: 'only if the validation report passes; tasks stay sealed until then', k: 'sealed', s: 'tasks sealed' },
  ];
  const n = steps.length;
  const bw = 196;
  const gap = (W - 96 - n * bw) / (n - 1);
  let b = '';
  b += line(48, top + 60, W - 48, top + 60, { stroke: C.grid, sw: 6 });
  steps.forEach((st, i) => {
    const x = 48 + i * (bw + gap);
    const sealed = st.k === 'sealed';
    b += `<circle cx="${x + bw / 2}" cy="${top + 60}" r="14" fill="${sealed ? C.status.sealed : C.status.defined}"/>`;
    b += rect(x, top + 100, bw, 270, { rx: 12, fill: sealed ? '#F1F2F4' : '#FFFFFF', stroke: sealed ? C.status.sealed : C.status.defined, sw: 2, dash: sealed ? '8 5' : undefined });
    if (sealed) b += lock(x + bw - 34, top + 112, 1.1, C.status.sealed);
    b += text(x + 12, top + 90 - 50, String(i + 1), { size: 22, weight: 700, fill: C.muted });
    wrap(st.t, bw - (sealed ? 50 : 24), 19, 700).forEach((l, k) => (b += text(x + 14, top + 132 + k * 23, l, { size: 19, weight: 700 })));
    wrap(st.d, bw - 26, 16).forEach((l, k) => (b += text(x + 14, top + 196 + k * 21, l, { size: 16 })));
    b += text(x + 14, top + 355, st.s, { size: 15, weight: 700, fill: sealed ? C.status.sealed : C.status.defined });
  });
  b += text(48, top + 10, 'NOW: development set done (F1–F3, F6, F7). Everything below is ahead, in this order.', { size: 18, weight: 600 });
  const svg = frame({
    title: 'What happens next, in order',
    subtitle: 'From the construct decisions to Study 2. Sealed items (locks) are outside the repository; their contents are not shown and were not opened.',
    badgeKind: 'design',
    badgeLabel: 'PLAN (nothing here has run)',
    body: b,
    height: top + 380 + 90,
    footer: ['Sources: Docs/v1.3/construct-decisions.md ("After answering"); Docs/v1.3/holdout-prespec.md §1, §2, §7; Docs/v1.3/labelling.md; Docs/v1.3/human-labelling-protocol.md; Docs/v1.3/pilot-outcome-memo.md; Docs/v1.3/study2-outline.md §8; Docs/v1.3/validation-protocol.md §4.'],
  });
  save(FIG, 'F8-timeline', svg, `
# F8 · timeline

**Title on slide:** What happens next, in order

**What it shows.** The ordered steps after the development set: (1) the author's construct decisions, (2) the freeze of the tool, (3) the one-time hold-out run, (4) labelling by the model labeller, (5) labelling by two humans (blind union sheets), (6) the loop pilot, (7) the Study 2 pre-registration. Sealed items are drawn as locked, dashed boxes; nothing of their content is shown.

**One idea.** Validation comes before Study 2, and each step is fixed before the data it depends on exist.

**Sources.**
- Construct decisions and their ADR: \`Docs/v1.3/construct-decisions.md\`, "After answering" (Q16 and Q25 need one development-set run before the hold-out).
- Freeze and run once: \`Docs/v1.3/holdout-prespec.md\` §1 ("Nothing merges between X and the run"), §2.
- Labelling only after the run, model then humans: same doc §7; \`Docs/v1.3/labelling.md\`; \`Docs/v1.3/human-labelling-protocol.md\` ("Status: defined; nothing labelled yet"; author audit κ ≥ 0.60: \`Docs/v1.3/validation-protocol.md\` §3).
- Pilot: \`Docs/v1.3/pilot-outcome-memo.md\` ("defined; no pilot run has started"; 3 tasks × 2 arms, k = 4).
- Study 2 pre-registration only after the validation report passes: \`Docs/v1.3/study2-outline.md\` §8; tasks sealed: \`Docs/v1.3/validation-protocol.md\` §4.

**Note on order.** The order follows the coordinator's brief and the documents: the hold-out pre-specification places labelling after the run; the pilot memo is independent of the hold-out and could run earlier; the Study 2 pre-registration is last in every document. No hash values are shown.
`);
}

// ---------------- F10 Study 2 design ----------------
{
  const top = 170;
  const arms = [
    { a: 'none', d: 'no tools; sees nothing', col: C.s.neutral },
    { a: 'daedalus-mcp', d: '7 spec-only MCP tools during each step', col: C.layer.application },
    { a: 'gate', d: 'after a step with blocking findings: one repair turn', col: C.layer['adapters-outbound'] },
  ];
  const lx = 48;
  const lw = 280;
  const k = 4;
  const sw = (W - 96 - lw - 40) / k;
  let b = '';
  for (let s = 0; s < k; s++) b += text(lx + lw + 20 + s * sw + sw / 2, top + 14, s === 0 ? 'Step 1: create the system' : `Step ${s + 1}: extend it`, { size: 18, weight: 700, anchor: 'middle' });
  b += text(lx + lw + 20 + (k - 0.5) * sw, top + 36, '… k ≈ 4–6 steps (set by the sealed tasks)', { size: 14, fill: C.muted, anchor: 'middle' });
  let y = top + 56;
  for (const arm of arms) {
    const rh = arm.a === 'gate' ? 150 : 110;
    b += rect(lx, y, lw, rh, { rx: 12, fill: arm.col });
    b += text(lx + 18, y + 40, arm.a, { size: 24, weight: 700, fill: '#fff' });
    wrap(arm.d, lw - 36, 16).forEach((l, i) => (b += text(lx + 18, y + 66 + i * 20, l, { size: 16, fill: '#fff' })));
    for (let s = 0; s < k; s++) {
      const x = lx + lw + 20 + s * sw;
      b += rect(x + 6, y + 10, sw - 70, 44, { rx: 8, fill: '#FFFFFF', stroke: arm.col, sw: 2 });
      b += text(x + 6 + (sw - 70) / 2, y + 38, 'agent turn', { size: 16, anchor: 'middle' });
      // snapshot + score point
      const cx = x + sw - 40;
      b += `<circle cx="${cx}" cy="${y + 32}" r="15" fill="${C.ink}"/>` + text(cx, y + 38, 'S', { size: 16, weight: 700, fill: '#fff', anchor: 'middle' });
      b += line(x + sw - 64, y + 32, cx - 17, y + 32, { stroke: C.ink, sw: 2, marker: 'arr' });
      if (s < k - 1) b += line(cx + 16, y + 32, x + sw + 4, y + 32, { stroke: C.muted, sw: 2, marker: 'arrM' });
      if (arm.a === 'gate') {
        b += rect(x + 6, y + 84, sw - 70, 44, { rx: 8, fill: C.redSoft, stroke: C.red, sw: 2, dash: '6 4' });
        b += text(x + 6 + (sw - 70) / 2, y + 104, 'repair turn', { size: 15, anchor: 'middle', fill: C.red });
        b += text(x + 6 + (sw - 70) / 2, y + 122, 'if blocking > 0', { size: 14, anchor: 'middle', fill: C.red });
        b += path([[cx, y + 48], [cx, y + 106], [x + sw - 62, y + 106]], { color: C.red, sw: 2 });
        b += `<circle cx="${cx}" cy="${y + 106}" r="0"/>`;
      }
    }
    y += rh + 20;
  }
  b += `<circle cx="${lx + 14}" cy="${y + 16}" r="13" fill="${C.ink}"/>` + text(lx + 14, y + 22, 'S', { size: 15, weight: 700, fill: '#fff', anchor: 'middle' });
  b += text(lx + 36, y + 22, 'snapshot outside the agent\'s folder, type-check, score with the firewall (v1.3 tiers, symbolic only). In gate, the step\'s outcome is the post-repair snapshot.', { size: 16 });
  y += 46;
  b += rect(48, y, W - 96, 96, { rx: 10, fill: C.panel });
  b += text(66, y + 30, 'Outcome: erosion slope = blocking violations per step (per KLOC as a sensitivity); repair success and cost for gate.', { size: 17 });
  b += text(66, y + 56, 'Working grid (a guess, not registered): 6 sealed tasks × 2–3 models × 3 replicates × 3 arms ≈ 162 runs; 54 blocks detect d_z ≈ 0.42.', { size: 17 });
  b += text(66, y + 82, 'If the pilot finds no blocking erosion in the none arm, the primary outcome becomes the advisory erosion rate (F11).', { size: 17, fill: C.muted });
  y += 96 + 20;
  const svg = frame({
    title: 'Study 2 design: the firewall in the loop',
    subtitle: 'One run = one model × task × arm × replicate. Each step starts from the tree the previous step left. Informal outline, not a pre-registration.',
    badgeKind: 'design',
    badgeLabel: 'DESIGN (not pre-registered, not run)',
    body: b,
    height: y + 80,
    footer: ['Source: Docs/v1.3/study2-outline.md §2 (design), §3 (arms), §4 (outcomes), §6 (working grid and power intuition); primary-outcome switch: Docs/v1.3/pilot-outcome-memo.md §5. Tasks are sealed and not shown.'],
  });
  save(FIG, 'F10-study2-design', svg, `
# F10 · study2-design

**Title on slide:** Study 2 design: the firewall in the loop

**What it shows.** The three arms (rows) over successive feature steps (columns). In every arm each step is an agent turn followed by a snapshot point S (snapshot outside the agent's working folder, type-check, firewall score). In \`daedalus-mcp\` the agent can query 7 spec-only MCP tools during the step. In \`gate\`, a step with blocking findings triggers one repair turn (red) and the step's outcome is the post-repair snapshot. Below: the outcome and the working grid.

**One idea.** Study 2 asks whether feedback during generation slows architectural erosion across steps.

**Sources.** \`Docs/v1.3/study2-outline.md\`: §2 (a run is one model, task, arm, replicate; steps share the project directory; snapshot after every step), §3 (arms; the 7 tools \`check_file\`, \`check_diff\`, \`suggest_placement\`, \`which_layer\`, \`check_import\`, \`explain_violation\`, \`get_architecture_spec\`; gate: at most 40 findings, one repair turn), §4 (outcomes), §6 (working grid: 6 tasks × 2–3 models × 3 replicates × 3 arms; 54 blocks → 162 runs; d_z ≈ 0.42 with 54 blocks, 0.51 with 36). Outcome switch: \`Docs/v1.3/pilot-outcome-memo.md\` §5.

**Caveats to say.** Informal outline: every number is a working guess, nothing is pre-registered, Study 2 is not run in v1.3, and its tasks are sealed (not named here).
`);
}

// ---------------- F11 pilot decision ----------------
{
  const top = 170;
  let b = '';
  const cx = W / 2;
  b += box(cx - 360, top, 720, 120, { title: 'Loop pilot (exploratory)', lines: ['3 tasks (Clean, Hexagonal, DDD) × arms none and gate · k = 4 steps · Claude Sonnet · 1 replicate'], align: 'middle', color: C.ink, fill: C.panel });
  // decision diamond
  const dy = top + 170;
  const dw = 1060;
  const dh = 170;
  b += `<polygon points="${cx},${dy} ${cx + dw / 2},${dy + dh / 2} ${cx},${dy + dh} ${cx - dw / 2},${dy + dh / 2}" fill="#FFFFFF" stroke="${C.ink}" stroke-width="2.5"/>`;
  b += text(cx, dy + 66, 'In the none arm, is there at least one NEW blocking finding', { size: 19, weight: 700, anchor: 'middle' });
  b += text(cx, dy + 92, 'after step 1, in at least one task?', { size: 19, weight: 700, anchor: 'middle' });
  b += text(cx, dy + 118, '(checked correct; identity = rule, template, file, target)', { size: 15, fill: C.muted, anchor: 'middle' });
  b += arrow(cx, top + 124, cx, dy - 6);
  const by = dy + dh + 80;
  const bw = 640;
  const lxb = 48;
  const rxb = W - 48 - bw;
  b += path([[cx - dw / 2, dy + dh / 2], [lxb + bw / 2, dy + dh / 2], [lxb + bw / 2, by - 6]], { color: C.red });
  b += text(lxb + bw / 2 - 14, dy + dh / 2 - 12, 'NO: zero erosion', { size: 20, weight: 700, fill: C.red, anchor: 'end' });
  b += path([[cx + dw / 2, dy + dh / 2], [rxb + bw / 2, dy + dh / 2], [rxb + bw / 2, by - 6]], { color: C.layer.domain });
  b += text(rxb + bw / 2 + 14, dy + dh / 2 - 12, 'YES: erosion exists', { size: 20, weight: 700, fill: C.layer.domain });
  b += box(lxb, by, bw, 250, {
    title: 'Primary outcome → advisory-tier erosion rate',
    lines: ['Per-run OLS slope of advisory findings per KLOC over steps 1–4, FF-CV05 excluded.', 'Why: deterministic, no new validity question, the tier where Study 1\'s differences lived.', 'Cost: a claim about design-quality signals, not defining constraints. gate must get the advisory subset, or be dropped (keep daedalus-mcp vs none).'],
    color: C.red,
  });
  b += box(rxb, by, bw, 250, {
    title: 'Primary outcome stays → blocking violations per step',
    lines: ['Blocking violations per step and their slope, as in the Study 2 outline §4.', 'The advisory rate becomes a secondary outcome.', 'Judge dimensions stay secondary in both branches.'],
    color: C.layer.domain,
  });
  const yb = by + 270;
  b += rect(48, yb, W - 96, 64, { rx: 10, fill: C.panel });
  b += text(66, yb + 27, 'Committed in advance: no other pilot result may change Study 2\'s primary outcome; nothing in the gate arm or in any arm difference can.', { size: 17 });
  b += text(66, yb + 51, 'Context: under v1.3 tiers every E1 finding was advisory (F9), so "zero" is a live possibility.', { size: 17, fill: C.muted });
  const svg = frame({
    title: 'Pilot decision, fixed before any run',
    subtitle: 'What the loop pilot decides for Study 2, and only that. The pilot estimates no arm effect.',
    badgeKind: 'design',
    badgeLabel: 'PRE-COMMITTED RULE (pilot not run)',
    body: b,
    height: yb + 64 + 90,
    footer: ['Source: Docs/v1.3/pilot-outcome-memo.md §2 (design), §3 (primary outcome), §4 (advisory slope definition), §5 (pre-committed decision); context: Docs/DiagnosticRuns/v1.3-study1-rerun-2026-10-15.md §1.'],
  });
  save(FIG, 'F11-pilot-decision', svg, `
# F11 · pilot-decision

**Title on slide:** Pilot decision, fixed before any run

**What it shows.** The decision rule the loop pilot memo commits to before any run. The pilot (3 tasks: Clean, Hexagonal, DDD; arms none and gate; k = 4; Claude Sonnet; one replicate) asks one question of the \`none\` arm: is there at least one new blocking finding after step 1 in at least one task (counted only if checked correct)? If no, Study 2's primary outcome moves to the advisory-tier erosion rate (per-run slope of advisory findings per KLOC, FF-CV05 excluded), with the stated costs. If yes, the primary outcome stays blocking violations per step.

**One idea.** The pilot can change exactly one thing, the primary outcome, and the rule for that is written down first.

**Source.** \`Docs/v1.3/pilot-outcome-memo.md\`: §2 (design table), §3 (primary outcome and the identity of a "new" finding), §4 (advisory slope per KLOC, also without FF-CV05), §5 (pre-committed decision, its reasons and costs, and "No other pilot result may change Study 2's primary outcome"). Context: every E1 finding is advisory under v1.3 (\`Docs/DiagnosticRuns/v1.3-study1-rerun-2026-10-15.md\` §1).

**Caveats to say.** The pilot has not run; single vendor; no test or interval with 3 runs. Task hashes are recorded in the memo and are deliberately not shown.
`);
}

// ---------------- B0 rule anatomy ----------------
{
  const compiled = readJson('Docs/presentation-kit/data/compiled-cypher.json');
  const top = 170;
  const n = 4;
  const bw = 352;
  const gap = (W - 96 - n * bw) / (n - 1);
  const panels = [
    { t: '1 · Spec entry', s: 'what the architect writes', col: C.layer.application, mono: ['- id: FF-S01', '  name: dependency-direction-graph', '  severity: critical', '', 'allowed_dependencies:', '  - from: adapters-outbound', '    to: [application, domain]', '  # … 3 more entries'] },
    { t: '2 · Template', s: 'chosen by the rule name', col: C.layer['adapters-inbound'], plain: ['dependency-direction-graph, in the hexagonal rule library', 'parameter: $allowedDependencies ← the spec\'s edges, as "from>to" strings', 'edge view: literal (barrel edges count at the barrel)', 'tier in hexagonal: blocking'] },
    { t: '3 · Cypher', s: 'compiled, run on the APG', col: C.layer['adapters-outbound'], mono: ['MATCH (src:File)-[i:IMPORTS|', '      RE_EXPORTS]->(tgt:File)', 'WHERE NOT i.viaReExport', ' AND src.layer <> tgt.layer', ' AND NOT (src.layer+">"+tgt.layer)', '     IN $allowedDependencies', ' AND (tgt.layer+">"+src.layer)', '     IN $allowedDependencies', 'RETURN src.filePath, tgt.filePath, …'] },
    { t: '4 · Violation row', s: 'one row = one finding', col: C.red, mono: ['functionId  FF-S01', 'severity    critical', 'filePath    src/domain/services/', '            PriceCalculator.ts', 'target      src/adapters/outbound/', '            payment/', '            FakePaymentGateway.ts', 'line        1'] },
  ];
  let b = '';
  panels.forEach((p, i) => {
    const x = 48 + i * (bw + gap);
    b += rect(x, top, bw, 380, { rx: 14, fill: '#FFFFFF', stroke: p.col, sw: 2.5 });
    b += rect(x, top, bw, 62, { rx: 14, fill: p.col });
    b += rect(x, top + 48, bw, 14, { fill: p.col });
    b += text(x + 18, top + 30, p.t, { size: 22, weight: 700, fill: '#fff' });
    b += text(x + 18, top + 52, p.s, { size: 15, fill: '#fff' });
    let yy = top + 96;
    if (p.mono) for (const l of p.mono) {
      b += `<text x="${x + 16}" y="${yy}" font-family="${MONO}" font-size="15" fill="${C.ink}" xml:space="preserve">${esc(l)}</text>`;
      yy += 24;
    }
    if (p.plain) for (const para of p.plain) {
      for (const l of wrap(para, bw - 36, 17)) {
        b += text(x + 18, yy, l, { size: 17 });
        yy += 23;
      }
      yy += 12;
    }
    if (i < n - 1) b += arrow(x + bw + 6, top + 190, x + bw + gap - 8, top + 190, { sw: 3 });
  });
  const svg = frame({
    title: 'Anatomy of a rule: spec → template → Cypher → violation row',
    subtitle: 'The same path for every symbolic rule. Example: hexagonal FF-S01 on variant v01 (the red edge of A2).',
    badgeKind: 'dev',
    badgeLabel: 'DEVELOPMENT SET: reference variant',
    body: b,
    height: top + 380 + 100,
    footer: ['Spec: tests/fixtures/v1.3-reference/hexagonal/spec.yaml · Template: src/fitness-compiler/hexagonal-templates.ts (dependency-direction-graph) · Cypher: Docs/presentation-kit/data/compiled-cypher.json (A2), abridged ·', 'Row: results/v1.3-reference/after-member-facts/evidence/hexagonal/v01-domain-uses-outbound-adapter-constant.json · Tier: Docs/v1.3/rule-tiers.md; report.md (hexagonal, blocking candidate yes).'],
  });
  save(FIG, 'B0-rule-anatomy', svg, `
# B0 · rule-anatomy

**Title on slide:** Anatomy of a rule: spec → template → Cypher → violation row

**What it shows.** The four stages every symbolic rule goes through, with one real example: the hexagonal rule FF-S01 \`dependency-direction-graph\`. (1) The spec entry names the rule and declares the allowed layer edges. (2) The compiler picks the template by the rule name and binds \`$allowedDependencies\` from the spec, under the literal edge view; its tier in hexagonal is blocking. (3) The compiled Cypher runs on the APG (shown abridged: the real text also has null checks, the \`coalesce\` on \`viaReExport\`, 9 RETURN columns and an ORDER BY; full text in \`Docs/presentation-kit/data/compiled-cypher.json\`, key A2). (4) Each returned row is a finding: here the planted edge of variant v01 (A2).

**One idea.** A rule is a parameterised graph query; the spec supplies the parameters.

**Sources.** \`tests/fixtures/v1.3-reference/hexagonal/spec.yaml\`; \`src/fitness-compiler/hexagonal-templates.ts\` (template \`dependency-direction-graph\`); \`Docs/presentation-kit/data/compiled-cypher.json\` (A2, produced with \`V13_COMPILE_OPTIONS\`); \`results/v1.3-reference/after-member-facts/evidence/hexagonal/v01-domain-uses-outbound-adapter-constant.json\`; edge views \`Docs/v1.3/edge-views.md\`; tier: \`results/v1.3-reference/after-member-facts/report.md\` (hexagonal FF-S01 blocking candidate yes).
`);
}
