// F3 dev set before/after the fix round (author view), F3b author vs blind view.
import { C, FIG, W, frame, save, text, rect, wilson, f2, tw } from './kit.mjs';
import { pbars, legendRow, whiskerNote } from './charts.mjs';

const STYLES = ['clean-architecture', 'layered', 'nestjs', 'hexagonal', 'ddd'];
// Author view (cycle-normalised = the runner's view). Before = U-E baseline (baseline-pre-barrel);
// after = after-member-facts. Sources: after-fixes doc §1 ("Author: before"), after-member-facts doc §3.
const REC = { before: [[13, 13], [11, 11], [11, 11], [13, 13], [7, 9]], after: [[13, 13], [11, 11], [11, 11], [13, 13], [9, 9]] };
const PRE = { before: [[13, 14], [11, 64], [11, 11], [13, 14], [7, 7]], after: [[13, 13], [11, 11], [11, 11], [13, 13], [9, 9]] };
const POOL = { recB: [55, 57], recA: [57, 57], preB: [55, 110], preA: [57, 57] };
// Blind (expanded) view after member facts: after-member-facts doc §3 "Per style, blind (expanded), blocking".
const BREC = [[13, 15], [7, 10], [11, 14], [13, 19], [9, 9]];
const BPRE = [[13, 13], [7, 11], [11, 11], [13, 13], [9, 9]];
const BPOOL = { rec: [53, 67], pre: [53, 57] };

const rowsOf = (A, B, pooledA, pooledB, cA, cB) => [
  ...STYLES.map((s, i) => ({ label: s, bars: [{ k: A[i][0], n: A[i][1], color: cA }, { k: B[i][0], n: B[i][1], color: cB }] })),
  { label: 'pooled', bold: true, sep: true, bars: [{ k: pooledA[0], n: pooledA[1], color: cA, strong: true }, { k: pooledB[0], n: pooledB[1], color: cB, strong: true }] },
];

// ---------------- F3 ----------------
{
  const top = 150;
  const pw = (W - 96 - 60) / 2;
  const [l1, h1] = pbars(48, top, pw, { title: 'Blocking recall (planted violations found)', rows: rowsOf(REC.before, REC.after, POOL.recB, POOL.recA, C.s.before, C.s.after), labelW: 190, valueW: 90 });
  const [l2, h2] = pbars(48 + pw + 60, top, pw, { title: 'Blocking precision (reported findings that are expected)', rows: rowsOf(PRE.before, PRE.after, POOL.preB, POOL.preA, C.s.before, C.s.after), labelW: 190, valueW: 90 });
  let b = l1 + l2;
  let y = top + Math.max(h1, h2) + 20;
  const [lg] = legendRow(48, y, [[C.s.before, 'before: first run (baseline, before the barrel fix and fix round)'], [C.s.after, 'after: fixes + member facts']]);
  b += lg + text(W - 48, y, whiskerNote, { size: 15, fill: C.muted, anchor: 'end' });
  y += 40;
  // negative controls strip
  b += rect(48, y, W - 96, 150, { rx: 12, fill: C.panel, stroke: C.grid });
  b += text(72, y + 36, 'False alarms on code that should pass', { size: 21, weight: 700 });
  const items = [
    ['Clean variants that pass', '4/5', '5/5', 'layered failed on 4 FF-P06 rows'],
    ['Near-misses with a blocking false alarm', '5/14', '0/14', ''],
    ['Near-misses with any scored false alarm', '6/14', '1/14', 'left: nestjs n03, FF-P02 (advisory)'],
  ];
  items.forEach(([lab, a, bb, note], i) => {
    const x = 72 + i * 500;
    b += text(x, y + 76, lab, { size: 17, fill: C.muted });
    b += text(x, y + 114, a, { size: 30, weight: 700, fill: C.s.neutral });
    const aw = tw(a, 30, 700);
    b += text(x + aw + 14, y + 112, '→', { size: 28, fill: C.muted });
    b += text(x + aw + 56, y + 114, bb, { size: 30, weight: 700, fill: C.s.after });
    if (note) b += text(x, y + 138, note, { size: 15, fill: C.muted });
  });
  y += 150 + 30;
  const height = y + 90;
  const svg = frame({
    title: 'Development set: before and after the fix round',
    subtitle: 'Author-written manifests, 71 variants of 5 reference projects. Precision went from 55/110 to 57/57; recall from 55/57 to 57/57.',
    badgeKind: 'dev',
    body: b,
    height,
    footer: ['Before: Docs/DiagnosticRuns/v1.3-reference-after-fixes-2026-10-15.md §1 ("Author: before", cycle-normalised; results/v1.3-reference/baseline-pre-barrel/). After: Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md §3 (results/v1.3-reference/after-member-facts/scores.json).', 'Literal-key view of the baseline runner: precision 50/110 = 0.45 (after-fixes §1, "other two views"). Controls: after-fixes §1 "Negative control, near-misses"; unchanged after member facts (§3).'],
  });
  save(FIG, 'F3-devset-before-after', svg, `
# F3 · devset-before-after

**Title on slide:** Development set: before and after the fix round

**What it shows.** Blocking recall (left) and blocking precision (right) per reference style and pooled, against the author-written manifests, for the first run (grey: the U-E baseline, before the barrel fix and the fix round) and the current run (blue: after the fix round and the extractor's member facts). Bars are proportions, whiskers 95% Wilson intervals. The strip below gives the false alarms on code that should pass: the 5 clean variants and the 14 near-misses.

**One idea.** On the development set, the fixes removed every blocking false alarm without losing a planted violation. It is not a validity estimate: these are the cases the fixes were made against.

**Numbers and sources.**
- Before, author view (cycle-normalised): recall 13/13, 11/11, 11/11, 13/13, 7/9, pooled 55/57 = 0.96 [0.88, 0.99]; precision 13/14, **11/64**, 11/11, 13/14, 7/7, pooled **55/110 = 0.50** [0.41, 0.59]. \`Docs/DiagnosticRuns/v1.3-reference-after-fixes-2026-10-15.md\` §1, "Blocking recall" and "Blocking precision", column "Author: before".
- The often-quoted **0.45** is the same baseline in the runner's literal-key view: 50/110 (same doc §1, "The other two views"; also \`Docs/DiagnosticRuns/v1.3-reference-baseline-2026-10-15.md\`). The chart uses the cycle-normalised view on both sides so that before and after are comparable.
- After: recall 13/13, 11/11, 11/11, 13/13, 9/9, pooled **57/57 = 1.00 [0.94, 1.00]**; precision the same, pooled **57/57 = 1.00 [0.94, 1.00]**. \`Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md\` §3, "Per style, author view".
- Clean variants passing 4/5 → 5/5; near-misses with a blocking false positive 5/14 → 0/14; with any scored false positive 6/14 → 1/14. after-fixes §1, "Negative control, near-misses, planted rule"; unchanged after member facts (after-member-facts §3, "The unchanged rows").
- What changed: layered precision 11/64 → 11/11 is fix 3 (FF-P06 not applicable in layered, −53 rows); ddd recall 7/9 → 8/9 is fix 6 (barrel literal edge), 8/9 → 9/9 is member facts (B2).

**Caveats to say.** The development set is AI-written; the manifests are the author's (F3b shows the blind view); no style has more than 15 expected blocking findings, so no per-style Wilson lower bound reaches 0.90.
`);
}

// ---------------- F3b ----------------
{
  const top = 150;
  const pw = (W - 96 - 60) / 2;
  const [l1, h1] = pbars(48, top, pw, { title: 'Blocking recall', rows: rowsOf(REC.after, BREC, POOL.recA, BPOOL.rec, C.s.after, C.s.blind), labelW: 190, valueW: 90 });
  const [l2, h2] = pbars(48 + pw + 60, top, pw, { title: 'Blocking precision', rows: rowsOf(PRE.after, BPRE, POOL.preA, BPOOL.pre, C.s.after, C.s.blind), labelW: 190, valueW: 90 });
  let b = l1 + l2;
  let y = top + Math.max(h1, h2) + 20;
  const [lg] = legendRow(48, y, [[C.s.after, 'author manifests (written with the rules in view)'], [C.s.blind, 'blind manifests (written without the rule code)']]);
  b += lg;
  y += 26;
  b += text(W - 48, y, whiskerNote, { size: 15, fill: C.muted, anchor: 'end' });
  y += 30;
  b += rect(48, y, W - 96, 96, { rx: 12, fill: C.panel, stroke: C.grid });
  b += text(72, y + 36, 'The gap is a reading gap, not yet a tool error: 39 rows where the manifests and the tool disagree wait for the author.', { size: 18 });
  b += text(72, y + 66, 'Example: hexagonal adapter → adapter is FF-S03 (advisory) for the author, FF-S01 (blocking) for the blind reader — construct question Q5.', { size: 18, fill: C.muted });
  y += 96 + 30;
  const height = y + 80;
  const svg = frame({
    title: 'Same tool, two answer keys: author vs blind manifests',
    subtitle: 'Current run (after member facts). The blind manifests were written by a separate agent that never saw the Cypher or the presets.',
    badgeKind: 'dev',
    body: b,
    height,
    footer: ['Source: Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md §3 ("Per style, author view" and "Per style, blind (expanded), blocking"); adjudication rows: results/v1.3-reference/after-member-facts/adjudication.csv (39 rows).', 'Blind protocol: Docs/v1.3/validation-protocol.md §1. The blind manifests themselves are sealed and were not opened for this kit.'],
  });
  save(FIG, 'F3b-author-vs-blind', svg, `
# F3b · author-vs-blind

**Title on slide:** Same tool, two answer keys: author vs blind manifests

**What it shows.** The current tool run (after member facts) scored against two answer keys: the author-manifests (blue), written by the people who could see the rules, and the blind manifests (purple), written by a separate agent that saw only the source, the style sources and the rule names (validation protocol §1). Blocking recall and precision per style and pooled, 95% Wilson whiskers.

**One idea.** Against an independent answer key the tool looks weaker (recall 53/67), and most of the gap is a disagreement about what the style means, which the author must adjudicate.

**Numbers and sources.** \`Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md\` §3:
- Author: recall and precision 13/13, 11/11, 11/11, 13/13, 9/9; pooled 57/57 and 57/57.
- Blind (expanded): recall 13/15, 7/10, 11/14, 13/19, 9/9, pooled **53/67 = 0.79 [0.68, 0.87]**; precision 13/13, 7/11, 11/11, 13/13, 9/9, pooled **53/57 = 0.93 [0.83, 0.97]**.
- 39 adjudication rows: same doc §3 table ("adjudication rows 40 → 39") and \`results/v1.3-reference/after-member-facts/adjudication.csv\` (the \`adjudication\` column is empty).
- The reading gaps named in \`Docs/DiagnosticRuns/v1.3-reference-after-fixes-2026-10-15.md\` §5: hexagonal adapter-to-adapter as FF-S01 or FF-S03; layer cycles under FF-S02; FF-P01 or FF-S01 for \`express\` in layered. Q5: \`Docs/v1.3/construct-decisions.md\`.

**Caveats to say.** Both manifests are AI-written; neither is human ground truth. The blind manifests are sealed outside the repository and were read only through the scoring script; nothing from them is shown here beyond the committed scores.
`);
}
