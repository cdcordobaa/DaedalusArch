// Labelling (unit U-F): correctness, samples, call estimates and the audit sheet of
// Docs/DiagnosticRuns/v1.3-labelling-2026-10-15.md, Docs/v1.3/labelling.md and Docs/v1.3/human-labelling-protocol.md.
// Regenerated offline with labelling-jobs.ts / sample-findings.ts / check-correct.ts / label-meaningful.ts --estimate on
// the committed reference evidence and E1 reports; the E1 correctness and the v1.3 E1 reports are re-derived from the
// committed rows (their regeneration needs ../daedalus-e1-outcomes and Neo4j); the one Codex answer is replayed from its
// cassette (--mode replay, never calls).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readAt, treeAt } from '../lib/at-commit.mjs';

const LD = 'Docs/DiagnosticRuns/v1.3-labelling-2026-10-15.md';
const LD_COMMIT = '2c1098c7'; // the doc's commit; its sheet and test counts describe the tree at this commit
const LM = 'Docs/v1.3/labelling.md';
const HP = 'Docs/v1.3/human-labelling-protocol.md';
const fmt = (n) => n.toLocaleString('en-US');
const W = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const z = 1.959964;
function wilson(k, n) {
  const p = k / n; const d = 1 + (z * z) / n; const c = p + (z * z) / (2 * n);
  const h = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - h) / d), Math.min(1, (c + h) / d)];
}
const estimate = (ctx, sample, jobs) => {
  const m = ctx.sh(`npx tsx scripts/v1.3/label-meaningful.ts --sample "${sample}" --jobs "${jobs}" --estimate`).match(/estimate: (\d+) calls \((\d+) items x 2 runs\); worst case with re-asks and retries (\d+)/);
  return { calls: Number(m[1]), items: Number(m[2]), worst: Number(m[3]) };
};
const ruleCounts = (sample) => Object.fromEntries(sample.rules.map((r) => [r.rule, r]));

// ---- reference dev set: the per-rule correctness table (doc lines 53-80) ------------------------------------------
const REF_TABLE = [
  ['FF-DS01/bounded-context-modules', 53, '1', '1', '0', '0', '[0.207, 1.000]'],
  ['FF-DS02/context-isolation', 54, '2', '2', '0', '0', '[0.342, 1.000]'],
  ['FF-DT01/aggregate-boundary', 55, '1', '1', '0', '0', '[0.207, 1.000]'],
  ['FF-DT02/repository-aggregate-root', 56, '1', '1', '0', '0', '[0.207, 1.000]'],
  ['FF-DT03/value-object-immutability', 57, '2', '2', '0', '0', '[0.342, 1.000]'],
  ['FF-DT04/domain-purity', 58, '1', '1', '0', '0', '[0.207, 1.000]'],
  ['FF-P01/domain-purity', 59, '7', '7', '0', '0', '[0.646, 1.000]'],
  ['FF-P03/port-adapter-pattern', 60, '2', '2', '0', '0', '[0.342, 1.000]'],
  ['FF-P03/repository-pattern', 61, '2', '2', '0', '0', '[0.342, 1.000]'],
  ['FF-P06/domain-state-purity', 62, '3', '0', '0', '3 (FLOWS_TO half, N/A by rule-tiers.md)', '-'],
  ['FF-S01/dependency-direction', 63, '11', '11', '0', '0', '[0.741, 1.000]'],
  ['FF-S01/dependency-direction-graph', 64, '6', '6', '0', '0', '[0.610, 1.000]'],
  ['FF-S02/no-cyclic-deps', 65, '5', '5', '0', '0', '[0.566, 1.000]'],
  ['FF-S03/no-layer-skip', 66, '5', '5', '0', '0', '[0.566, 1.000]'],
  ['FF-S04/core-isolation', 67, '3', '3', '0', '0', '[0.439, 1.000]'],
  ['FF-S04/no-domain-outward-dep', 68, '5', '5', '0', '0', '[0.566, 1.000]'],
  ['FF-CV03/naming-repos', 69, '2', '2', '0', '0', '[0.342, 1.000]'],
  ['FF-CV05/test-file-pairing', 70, '1426', '1426', '0', '0', '[0.997, 1.000]'],
  ['FF-S03/layer-skip-graph', 71, '3', '3', '0', '0', '[0.439, 1.000]'],
  ['FF-C01/domain-stability', 72, '3', '0', '0', '3', '-'],
  ['FF-C02/module-fan-out', 73, '30', '0', '0', '30', '-'],
  ['FF-C03/component-instability', 74, '120', '0', '0', '120', '-'],
  ['FF-C06/abstraction-ratio', 75, '14', '0', '0', '14', '-'],
  ['FF-DT05/domain-event-placement', 76, '1', '0', '0', '1', '-'],
  ['FF-DT06/application-service-thin', 77, '1', '0', '0', '1', '-'],
  ['FF-P02/dependency-inversion', 78, '3', '0', '0', '3', '-'],
  ['FF-P02/port-dependency-inversion', 79, '1', '0', '0', '1', '-'],
  ['FF-P04/use-case-isolation', 80, '2', '0', '0', '2', '-'],
];
const E1_TABLE = [
  ['FF-CV05/test-file-pairing', 88, '1184', '1184', '0', '0', '[0.997, 1.000]'],
  ['FF-C02/module-fan-out', 89, '21', '0', '0', '21', '-'],
  ['FF-C03/component-instability', 90, '159', '0', '0', '159', '-'],
  ['FF-C04/no-orphan-files', 91, '2', '0', '0', '2', '-'],
  ['FF-C06/abstraction-ratio', 92, '6', '0', '0', '6', '-'],
  ['FF-P02/dependency-inversion', 93, '51', '0', '0', '51', '-'],
  ['FF-SO01/single-responsibility-proxy', 94, '3', '0', '0', '3', '-'],
  ['FF-SO02/interface-segregation-proxy', 95, '2', '0', '0', '2', '-'],
];
const COLS = ['n', 'correct', 'incorrect', 'nc', 'wilson'];
const slug = (r) => r.replace(/^FF-/, '').replace(/[/]/g, '-').toLowerCase();
const tableNumbers = (tab, prefix, set) => tab.flatMap(([rule, line, ...v]) => COLS.map((c, i) => ({ id: `${prefix}-${slug(rule)}-${c}`, doc: LD, line, what: `${set} correctness table, ${rule}: ${c}`, stated: v[i] })));
function tableValues(corr, tab, prefix) {
  const by = Object.fromEntries(corr.summary.map((s) => [s.rule, s]));
  const r = {};
  for (const [rule] of tab) {
    const s = by[rule];
    const p06 = corr.results.filter((x) => x.rule === rule && x.verdict === 'not-checkable').every((x) => /FLOWS_TO/.test(x.reason ?? ''));
    const nc = rule.startsWith('FF-P06') && p06 && s.notCheckable > 0 ? `${s.notCheckable} (FLOWS_TO half, N/A by rule-tiers.md)` : String(s.notCheckable);
    const vals = [String(s.n), String(s.correct), String(s.incorrect), nc, s.wilsonLow == null ? '-' : `[${s.wilsonLow.toFixed(3)}, ${s.wilsonHigh.toFixed(3)}]`];
    COLS.forEach((c, i) => { r[`${prefix}-${slug(rule)}-${c}`] = vals[i]; });
  }
  return r;
}
const totals = (corr) => {
  const t = { n: 0, correct: 0, incorrect: 0, nc: 0 };
  for (const x of corr.results) { t.n++; if (x.verdict === 'correct') t.correct++; else if (x.verdict === 'incorrect') t.incorrect++; else t.nc++; }
  return t;
};

// The reference regeneration is shared by two groups of this file within one runner process.
let refRun;
function regenRef(ctx) {
  if (refRun) return refRun;
  const o = ctx.out('c-lab-ref');
  ctx.sh(`npx tsx scripts/v1.3/labelling-jobs.ts --reference results/v1.3-reference/after-member-facts/evidence --materialise "${o}/variants" --out "${o}/jobs.json"`);
  ctx.sh(`npx tsx scripts/v1.3/sample-findings.ts --jobs "${o}/jobs.json" --seed 20261015 --tiers all --out "${o}/sample-all.json"`);
  ctx.sh(`npx tsx scripts/v1.3/check-correct.ts --jobs "${o}/jobs.json" --tiers all --out "${o}/correctness-all"`);
  const drift = [['sample-all.json', 'sample-all.json'], ['correctness-all/correctness.json', 'correctness-all/correctness.json'], ['correctness-all/correctness.csv', 'correctness-all/correctness.csv']]
    .filter(([a, b]) => ctx.read(join(o, a)) !== ctx.read(`results/v1.3-labelling/reference/${b}`)).map(([a]) => a);
  if (drift.length) throw new Error(`regenerated reference labelling outputs differ from the committed ones: ${drift.join(', ')}`);
  refRun = { dir: o, jobs: ctx.json(join(o, 'jobs.json')), sample: ctx.json(join(o, 'sample-all.json')), corr: ctx.json(join(o, 'correctness-all/correctness.json')), est: estimate(ctx, join(o, 'sample-all.json'), join(o, 'jobs.json')) };
  return refRun;
}
// E1: the committed jobs hold the author's absolute paths; point report and spec into this checkout (as replication/README §3.5).
function e1Jobs(ctx) {
  const o = ctx.out('c-lab-e1');
  const j = ctx.json('results/v1.3-labelling/e1/jobs.json');
  for (const x of j.jobs) { x.report = join(ctx.repo, 'results/v1.3-labelling/e1/reports', x.report.split('/').pop()); x.spec = join(ctx.repo, 'specs/clean-arch.yaml'); }
  writeFileSync(join(o, 'jobs.json'), JSON.stringify(j, null, 2));
  return o;
}
function symbolicCounts(ctx, dir) {
  const c = {}; let n = 0;
  for (const f of ctx.ls(dir)) { n++; for (const v of ctx.json(`${dir}/${f}`).violations) if (v.route === 'symbolic') c[v.functionId] = (c[v.functionId] ?? 0) + 1; }
  return { files: n, c };
}

const S1_RULES = ['FF-CV05', 'FF-C03', 'FF-P02', 'FF-C02', 'FF-C06', 'FF-SO01', 'FF-C04', 'FF-SO02'];
const S1_V13 = ['1184', '159', '51', '21', '6', '3', '2', '2'];
const S1_STUDY1 = ['1184', '154', '51', '21', '6', '3', '2', '2'];

export default [
  {
    id: 'c-lab-ref',
    title: 'Labelling, reference dev set: correctness, sample, call estimate (v1.3-labelling)',
    needs: 'offline',
    basis: 'regenerated',
    slow: true,
    how: 'npx tsx scripts/v1.3/labelling-jobs.ts --reference results/v1.3-reference/after-member-facts/evidence --materialise W/variants --out W/jobs.json; sample-findings.ts --seed 20261015 --tiers all; check-correct.ts --tiers all; label-meaningful.ts --estimate',
    numbers: [
      { id: 'c-lab-ref-16-variants', doc: LD, line: 16, what: 'reference set: variants and styles', stated: '71 variants, 5 styles' },
      { id: 'c-lab-ref-16-findings', doc: LD, line: 16, what: 'reference findings (symbolic, all tiers)', stated: '1,663 (3 of them FF-P06 FLOWS_TO rows, N/A)' },
      { id: 'c-lab-ref-6-ref', doc: LD, line: 6, what: 'reference findings correct, of all', stated: '1,485 of 1,663' },
      ...tableNumbers(REF_TABLE, 'c-lab-ref-t', 'reference'),
      { id: 'c-lab-ref-82-n', doc: LD, line: 82, what: 'reference totals: findings', stated: '1,663 findings' },
      { id: 'c-lab-ref-82-correct', doc: LD, line: 82, what: 'reference totals: correct', stated: '1,485 correct' },
      { id: 'c-lab-ref-82-incorrect', doc: LD, line: 82, what: 'reference totals: incorrect', stated: '0 incorrect' },
      { id: 'c-lab-ref-82-nc', doc: LD, line: 82, what: 'reference totals: not-checkable', stated: '178 not-checkable' },
      { id: 'c-lab-ref-82-blocking', doc: LD, line: 82, what: 'blocking findings with a deterministic check, correct', stated: '54 of 54' },
      { id: 'c-lab-ref-134-items', doc: LD, line: 134, what: 'reference sample items', stated: '194 (3 FF-P06 FLOWS_TO rows excluded as N/A)' },
      { id: 'c-lab-ref-134-rules', doc: LD, line: 134, what: 'reference sample rules', stated: '27' },
      { id: 'c-lab-ref-134-calls', doc: LD, line: 134, what: 'reference --estimate calls', stated: '388' },
      { id: 'c-lab-ref-134-worst', doc: LD, line: 134, what: 'reference worst case calls', stated: '1,552' },
      { id: 'c-lab-ref-168', doc: LD, line: 168, what: 'budget split: reference blocking items and calls', stated: '54 items, 108 calls' },
    ],
    run(ctx) {
      const { jobs, sample, corr, est } = regenRef(ctx);
      const r = tableValues(corr, REF_TABLE, 'c-lab-ref-t');
      const t = totals(corr);
      const p06 = sample.excludedNotApplicable['FF-P06/domain-state-purity'] ?? 0;
      const styles = new Set(jobs.jobs.map((j) => j.projectId.split('/')[0])).size;
      r['c-lab-ref-16-variants'] = `${jobs.jobs.length} variants, ${styles} styles`;
      r['c-lab-ref-16-findings'] = `${fmt(t.n)} (${p06} of them FF-P06 FLOWS_TO rows, N/A)`;
      r['c-lab-ref-6-ref'] = `${fmt(t.correct)} of ${fmt(t.n)}`;
      r['c-lab-ref-82-n'] = `${fmt(t.n)} findings`;
      r['c-lab-ref-82-correct'] = `${fmt(t.correct)} correct`;
      r['c-lab-ref-82-incorrect'] = `${t.incorrect} incorrect`;
      r['c-lab-ref-82-nc'] = `${t.nc} not-checkable`;
      const blk = corr.results.filter((x) => x.tier === 'blocking' && x.verdict !== 'not-checkable');
      r['c-lab-ref-82-blocking'] = `${blk.filter((x) => x.verdict === 'correct').length} of ${blk.length}`;
      r['c-lab-ref-134-items'] = `${sample.items.length} (${p06} FF-P06 FLOWS_TO rows excluded as N/A)`;
      r['c-lab-ref-134-rules'] = String(sample.rules.length);
      r['c-lab-ref-134-calls'] = String(est.calls);
      r['c-lab-ref-134-worst'] = fmt(est.worst);
      const bi = sample.items.filter((x) => x.tier === 'blocking').length;
      r['c-lab-ref-168'] = `${bi} items, ${bi * 2} calls`;
      return r;
    },
  },
  {
    id: 'c-lab-e1',
    title: 'Labelling, E1 cells: sample and estimate (regenerated); v1.3 reports and correctness (re-derived from committed rows)',
    needs: 'offline',
    basis: 'regenerated',
    slow: false,
    how: 'rewrite results/v1.3-labelling/e1/jobs.json paths into this checkout; sample-findings.ts --seed 20261015 --tiers all; label-meaningful.ts --estimate; counts from results/v1.3-labelling/e1/{reports,correctness-all}, results/e1-grid/{runs,reports}',
    numbers: [
      { id: 'c-lab-e1-6', doc: LD, line: 6, what: 'E1 findings correct, of all', stated: '1,184 of 1,428', basis: 're-derived' },
      { id: 'c-lab-e1-6-all', doc: LD, line: 6, what: 'checkable findings, both sets, all correct', stated: 'All 2,669 checkable findings', basis: 're-derived' },
      { id: 'c-lab-e1-6-none', doc: LD, line: 6, what: 'incorrect findings, both sets, after the checker fix', stated: 'no finding was incorrect', basis: 're-derived' },
      { id: 'c-lab-e1-17-cells', doc: LD, line: 17, what: 'accepted E1 cells and the grid', stated: '65 accepted cells (4 models × 2 tasks × 3 spec levels × 3 runs, less 7 not accepted)', basis: 're-derived' },
      { id: 'c-lab-e1-17-findings', doc: LD, line: 17, what: 'E1 findings (v1.3 re-evaluation)', stated: '1,428', basis: 're-derived' },
      { id: 'c-lab-e1-26', doc: LD, line: 26, what: 'E1 cells evaluated (reports committed)', stated: 'All 65 cells', basis: 're-derived' },
      { id: 'c-lab-e1-30', doc: LD, line: 30, what: 'blocking-tier findings in the E1 cells under v1.3', stated: 'no blocking-tier finding', basis: 're-derived' },
      ...S1_RULES.flatMap((rule, i) => [
        { id: `c-lab-e1-s1-${slug(rule)}-v13`, doc: LD, line: 34 + i, what: `E1 ${rule} findings, v1.3 run`, stated: S1_V13[i], basis: 're-derived' },
        { id: `c-lab-e1-s1-${slug(rule)}-study1`, doc: LD, line: 34 + i, what: `E1 ${rule} findings, Study 1 report`, stated: S1_STUDY1[i], basis: 're-derived' },
      ]),
      { id: 'c-lab-e1-43', doc: LD, line: 43, what: 'difference v1.3 vs Study 1', stated: '5 more FF-C03 rows', basis: 're-derived' },
      ...tableNumbers(E1_TABLE, 'c-lab-e1-t', 'E1').map((n) => ({ ...n, basis: 're-derived' })),
      { id: 'c-lab-e1-97-n', doc: LD, line: 97, what: 'E1 totals: findings', stated: '1,428 findings', basis: 're-derived' },
      { id: 'c-lab-e1-97-correct', doc: LD, line: 97, what: 'E1 totals: correct', stated: '1,184 correct', basis: 're-derived' },
      { id: 'c-lab-e1-97-incorrect', doc: LD, line: 97, what: 'E1 totals: incorrect', stated: '0 incorrect', basis: 're-derived' },
      { id: 'c-lab-e1-97-nc', doc: LD, line: 97, what: 'E1 totals: not-checkable', stated: '244 not-checkable', basis: 're-derived' },
      { id: 'c-lab-e1-135-items', doc: LD, line: 135, what: 'E1 sample items', stated: '154' },
      { id: 'c-lab-e1-135-rules', doc: LD, line: 135, what: 'E1 sample rules', stated: '8' },
      { id: 'c-lab-e1-135-calls', doc: LD, line: 135, what: 'E1 --estimate calls', stated: '308' },
      { id: 'c-lab-e1-135-worst', doc: LD, line: 135, what: 'E1 worst case calls', stated: '1,232' },
      { id: 'c-lab-tot-136-items', doc: LD, line: 136, what: 'sample items, both sets (reference from the committed sample, regenerated byte-identical in c-lab-ref)', stated: '348' },
      { id: 'c-lab-tot-136-rules', doc: LD, line: 136, what: 'sample rules, both sets', stated: '35' },
      { id: 'c-lab-tot-136-calls', doc: LD, line: 136, what: '--estimate calls, both sets', stated: '696' },
      { id: 'c-lab-tot-136-worst', doc: LD, line: 136, what: 'worst case calls, both sets', stated: '2,784' },
      { id: 'c-lab-tot-138', doc: LD, line: 138, what: 'calls the protocol sample needs', stated: '696 calls' },
      { id: 'c-lab-tot-167-full', doc: LD, line: 167, what: 'full sample calls', stated: '(696 calls)' },
      { id: 'c-lab-tot-167-split', doc: LD, line: 167, what: 'calls of the split and calls left under the 400 cap', stated: 'uses 374 calls and leaves 26 for re-asks' },
      { id: 'c-lab-e1-169', doc: LD, line: 169, what: 'budget split: E1 FF-C03, FF-P02, FF-CV05', stated: '120 items, 240 calls' },
      { id: 'c-lab-e1-170', doc: LD, line: 170, what: 'budget split: E1 FF-C06, FF-SO01, FF-C04, FF-SO02', stated: '13 items, 26 calls' },
      { id: 'c-lab-e1-213', doc: LD, line: 213, what: 'E1 cells (one ts.Program each)', stated: '65 `ts.Program`s', basis: 're-derived' },
    ],
    run(ctx) {
      const o = e1Jobs(ctx);
      ctx.sh(`npx tsx scripts/v1.3/sample-findings.ts --jobs "${o}/jobs.json" --seed 20261015 --tiers all --out "${o}/sample-all.json"`);
      if (ctx.read(join(o, 'sample-all.json')) !== ctx.read('results/v1.3-labelling/e1/sample-all.json')) throw new Error('regenerated E1 sample-all.json differs from the committed one');
      const sample = ctx.json(join(o, 'sample-all.json'));
      const est = estimate(ctx, join(o, 'sample-all.json'), join(o, 'jobs.json'));
      const corr = ctx.json('results/v1.3-labelling/e1/correctness-all/correctness.json');
      const refCorr = ctx.json('results/v1.3-labelling/reference/correctness-all/correctness.json');
      const t = totals(corr); const rt = totals(refCorr);
      const r = tableValues(corr, E1_TABLE, 'c-lab-e1-t');
      r['c-lab-e1-6'] = `${fmt(t.correct)} of ${fmt(t.n)}`;
      r['c-lab-e1-6-all'] = `All ${fmt(t.correct + rt.correct)} checkable findings`;
      if (t.n - t.nc !== t.correct || rt.n - rt.nc !== rt.correct) r['c-lab-e1-6-all'] += ' (not all correct)';
      r['c-lab-e1-6-none'] = t.incorrect + rt.incorrect === 0 ? 'no finding was incorrect' : `${t.incorrect + rt.incorrect} incorrect`;
      const runs = ctx.ls('results/e1-grid/runs').map((f) => ctx.json(`results/e1-grid/runs/${f}`));
      const u = (k) => new Set(runs.map((x) => x.cell[k])).size;
      const acc = runs.filter((x) => x.status === 'accepted').length;
      const grid = u('requestedModelId') * u('taskId') * u('specLevel') * u('runIndex');
      r['c-lab-e1-17-cells'] = `${acc} accepted cells (${u('requestedModelId')} models × ${u('taskId')} tasks × ${u('specLevel')} spec levels × ${u('runIndex')} runs, less ${grid - acc} not accepted)`;
      r['c-lab-e1-17-findings'] = fmt(t.n);
      const v13 = symbolicCounts(ctx, 'results/v1.3-labelling/e1/reports');
      const s1 = symbolicCounts(ctx, 'results/e1-grid/reports');
      r['c-lab-e1-26'] = `All ${v13.files} cells`;
      r['c-lab-e1-213'] = `${v13.files} \`ts.Program\`s`;
      const blocking = corr.results.filter((x) => x.tier === 'blocking').length;
      r['c-lab-e1-30'] = blocking === 0 ? 'no blocking-tier finding' : `${blocking} blocking-tier findings`;
      S1_RULES.forEach((rule) => { r[`c-lab-e1-s1-${slug(rule)}-v13`] = String(v13.c[rule] ?? 0); r[`c-lab-e1-s1-${slug(rule)}-study1`] = String(s1.c[rule] ?? 0); });
      const diff = Object.keys({ ...v13.c, ...s1.c }).filter((k) => (v13.c[k] ?? 0) !== (s1.c[k] ?? 0));
      r['c-lab-e1-43'] = diff.length === 1 ? `${v13.c[diff[0]] - s1.c[diff[0]]} more ${diff[0]} rows` : `differences in ${diff.join(', ')}`;
      r['c-lab-e1-97-n'] = `${fmt(t.n)} findings`; r['c-lab-e1-97-correct'] = `${fmt(t.correct)} correct`;
      r['c-lab-e1-97-incorrect'] = `${t.incorrect} incorrect`; r['c-lab-e1-97-nc'] = `${t.nc} not-checkable`;
      r['c-lab-e1-135-items'] = String(sample.items.length); r['c-lab-e1-135-rules'] = String(sample.rules.length);
      r['c-lab-e1-135-calls'] = String(est.calls); r['c-lab-e1-135-worst'] = fmt(est.worst);
      const ref = ctx.json('results/v1.3-labelling/reference/sample-all.json');
      const items = ref.items.length + sample.items.length; const calls = 2 * items;
      r['c-lab-tot-136-items'] = String(items); r['c-lab-tot-136-rules'] = String(ref.rules.length + sample.rules.length);
      r['c-lab-tot-136-calls'] = String(calls); r['c-lab-tot-136-worst'] = fmt(8 * items);
      r['c-lab-tot-138'] = `${calls} calls`; r['c-lab-tot-167-full'] = `(${calls} calls)`;
      const rc = ruleCounts(sample);
      const big = ['FF-C03/component-instability', 'FF-P02/dependency-inversion', 'FF-CV05/test-file-pairing'].reduce((a, k) => a + rc[k].sampled, 0);
      const small = ['FF-C06/abstraction-ratio', 'FF-SO01/single-responsibility-proxy', 'FF-C04/no-orphan-files', 'FF-SO02/interface-segregation-proxy'].reduce((a, k) => a + rc[k].sampled, 0);
      const refBlocking = ref.items.filter((x) => x.tier === 'blocking').length;
      const split = 2 * (refBlocking + big + small);
      r['c-lab-tot-167-split'] = `uses ${split} calls and leaves ${400 - split} for re-asks`;
      r['c-lab-e1-169'] = `${big} items, ${2 * big} calls`;
      r['c-lab-e1-170'] = `${small} items, ${2 * small} calls`;
      return r;
    },
  },
  {
    id: 'c-lab-meaningful',
    title: 'Labelling, meaningful: the one stored Codex answer (cassette replay, no call)',
    needs: 'offline',
    basis: 'replayed',
    slow: false,
    how: 'npx tsx scripts/v1.3/label-meaningful.ts --sample results/v1.3-labelling/reference/sample-all.json --jobs <regenerated reference jobs> --provider codex --model gpt-5.6-terra --mode replay --cassette-dir results/v1.3-labelling/cassettes-codex --seed 20261015 --rule FF-S01/dependency-direction --limit 1 (run 0 replays, run 1 is a CASSETTE_MISS); tokens from the cassette file',
    numbers: [
      { id: 'c-lab-m-one-item', doc: LD, line: 7, what: 'items answered / answers stored', stated: 'One item got one answer' },
      { id: 'c-lab-m-run0', doc: LD, line: 142, what: 'run 0: answer and tokens', stated: 'Run 0 answered `yes` (8,050 input tokens, 30 output tokens)' },
      { id: 'c-lab-m-answered', doc: LD, line: 153, what: 'answered Codex calls (stored cassettes)', stated: '1 answered' },
      { id: 'c-lab-m-tokens', doc: LD, line: 153, what: 'tokens of the answered call', stated: '8,050 input and 30 output tokens' },
      { id: 'c-lab-m-second', doc: LD, line: 7, what: 'the call that hit the usage limit', stated: 'second call', needs: 'needs-LLM', note: 'The refused call was not stored by design; only the live Codex run shows it.' },
      { id: 'c-lab-m-2calls', doc: LD, line: 141, what: 'Codex calls of the smoke run', stated: '2 Codex calls', needs: 'needs-LLM', note: 'One call is stored (replayed here); the refused second call is not stored.' },
      { id: 'c-lab-m-2calls-cost', doc: LD, line: 153, what: 'Codex calls (cost line)', stated: '2 Codex calls', needs: 'needs-LLM', note: 'As line 141.' },
      { id: 'c-lab-m-refused', doc: LD, line: 153, what: 'refused calls', stated: '1 refused by the usage limit', needs: 'needs-LLM', note: 'Not stored by design.' },
      { id: 'c-lab-m-gemini', doc: LD, line: 153, what: 'Gemini calls', stated: '0 Gemini calls', needs: 'not-checkable', note: 'An absence of calls leaves no file (no Gemini cassette directory is committed, consistent with 0).' },
    ],
    run(ctx) {
      const { dir } = regenRefJobsOnly(ctx);
      let msg = '';
      try {
        ctx.sh(`npx tsx scripts/v1.3/label-meaningful.ts --sample results/v1.3-labelling/reference/sample-all.json --jobs "${dir}/jobs.json" --provider codex --model gpt-5.6-terra --mode replay --cassette-dir results/v1.3-labelling/cassettes-codex --seed 20261015 --rule FF-S01/dependency-direction --limit 1 --out "${dir}/labels-replay.json"`);
        msg = 'completed';
      } catch (e) { msg = String(e.stderr ?? '') + String(e.stdout ?? ''); }
      // run 0 replays from the cassette when the replay stops at run 1
      const run0 = /CASSETTE_MISS: no cassette for \w+ run 1\b/.test(msg);
      const files = ctx.ls('results/v1.3-labelling/cassettes-codex').flatMap((d) => ctx.ls(`results/v1.3-labelling/cassettes-codex/${d}`).map((f) => `results/v1.3-labelling/cassettes-codex/${d}/${f}`));
      const c = ctx.json(files[0]);
      const choice = JSON.parse(c.answer.text).choice;
      const answer = { A: 'yes', B: 'no', C: 'uncertain' }[choice]; // run 0 shows the canonical order yes / no / uncertain
      const items = new Set(files.map((f) => ctx.json(f).itemKey)).size;
      return {
        'c-lab-m-one-item': run0 && items === 1 && files.length === 1 ? 'One item got one answer' : `${items} items, ${files.length} answers (run 0 replayed: ${run0})`,
        'c-lab-m-run0': run0 ? `Run 0 answered \`${answer}\` (${fmt(c.answer.inputTokens)} input tokens, ${c.answer.outputTokens} output tokens)` : `run 0 did not replay: ${msg.slice(0, 120)}`,
        'c-lab-m-answered': `${files.length} answered`,
        'c-lab-m-tokens': `${fmt(c.answer.inputTokens)} input and ${c.answer.outputTokens} output tokens`,
      };
    },
  },
  {
    id: 'c-lab-audit',
    title: 'Labelling, author audit sheet (40 items), from the committed sheet and key',
    needs: 'offline',
    basis: 're-derived',
    slow: false,
    how: 'audit/view/v1.3-labels-audit.md, audit/key/v1.3-labels-audit.key.json, results/v1.3-labelling/{reference,e1}/sample-all.json',
    numbers: [
      { id: 'c-lab-a-8', doc: LD, line: 8, what: 'audit sheet items', stated: 'with 40 items' },
      { id: 'c-lab-a-188', doc: LD, line: 188, what: 'audit draw items', stated: '40 items' },
      { id: 'c-lab-a-189', doc: LD, line: 189, what: 'FF- ids on the sheet', stated: 'no `FF-` id in it' },
      { id: 'c-lab-a-190-rules', doc: LD, line: 190, what: 'sampled rules of both sets', stated: 'the 35 sampled rules' },
      { id: 'c-lab-a-190-cover', doc: LD, line: 190, what: 'rules covered by the audit items', stated: 'covering 30 rules' },
      { id: 'c-lab-a-190-split', doc: LD, line: 190, what: 'reference and E1 audit items', stated: '33 reference items and 7 E1 items' },
      { id: 'c-lab-a-174', doc: LD, line: 174, what: 'answer-leaking excerpt lines on the audit sheet, at the doc commit', stated: '9 excerpt lines',
        note: `the sheet as the doc describes it, at ${LD_COMMIT}; commit 10968ceb later re-generated it with the comments stripped (0 such lines at HEAD, audit E-8)` },
    ],
    run(ctx) {
      const key = ctx.json('audit/key/v1.3-labels-audit.key.json');
      const sheet = ctx.read('audit/view/v1.3-labels-audit.md');
      const ref = ctx.json('results/v1.3-labelling/reference/sample-all.json'); const e1 = ctx.json('results/v1.3-labelling/e1/sample-all.json');
      const refKeys = new Set(ref.items.map((x) => x.key));
      const n = key.rows.length; const nr = key.rows.filter((x) => refKeys.has(x.key)).length;
      const ff = (sheet.match(/FF-/g) ?? []).length;
      const leak = readAt(ctx, LD_COMMIT, 'audit/view/v1.3-labels-audit.md').split('\n').filter((l) => /violation/i.test(l)).length;
      return {
        'c-lab-a-8': `with ${n} items`, 'c-lab-a-188': `${n} items`,
        'c-lab-a-189': ff === 0 ? 'no `FF-` id in it' : `${ff} \`FF-\` ids in it`,
        'c-lab-a-190-rules': `the ${ref.rules.length + e1.rules.length} sampled rules`,
        'c-lab-a-190-cover': `covering ${new Set(key.rows.map((x) => x.rule)).size} rules`,
        'c-lab-a-190-split': `${nr} reference items and ${n - nr} E1 items`,
        'c-lab-a-174': `${leak} excerpt lines`,
      };
    },
  },
  {
    id: 'c-lab-tests',
    title: 'Labelling unit tests (jest, targeted directory)',
    needs: 'offline',
    basis: 'regenerated',
    slow: true,
    how: `npx jest tests/unit/scripts/v1.3/labelling --maxWorkers=2 --json, in a git archive of the doc commit ${LD_COMMIT}`,
    numbers: [
      { id: 'c-lab-tests-37', doc: LD, line: 218, what: 'labelling unit tests passing, at the doc commit', stated: '38 pass',
        note: `the test directory as the doc describes it, at ${LD_COMMIT}; later commits added tests (59 at the replication-2 HEAD)` },
    ],
    run(ctx) {
      const out = join(ctx.out('c-lab-tests'), 'jest.json');
      try { ctx.sh(`env -i PATH="$PATH" HOME="$HOME" TMPDIR="${ctx.out('c-lab-tests-tmp')}" npx jest tests/unit/scripts/v1.3/labelling --maxWorkers=2 --json --outputFile="${out}"`, { cwd: treeAt(ctx, LD_COMMIT) }); } catch { /* counted below */ }
      const j = ctx.json(out);
      return { 'c-lab-tests-37': j.numFailedTests === 0 ? `${j.numPassedTests} pass` : `${j.numPassedTests} pass, ${j.numFailedTests} fail` };
    },
  },
  {
    id: 'c-lab-unrun',
    title: 'Labelling: run facts that need the E1 outcomes, Neo4j or the original machine',
    needs: 'needs-external',
    basis: '',
    how: 'scripts/v1.3/e1-v13-evaluate.ts (Neo4j + ../daedalus-e1-outcomes); the first checker pass and the run notes are not committed',
    numbers: [
      { id: 'c-lab-x-0-failures', doc: LD, line: 26, what: 'E1 evaluation failures', stated: '0 failures', needs: 'needs-Neo4j', note: 'The evaluation (e1-v13-evaluate.ts) needs Neo4j and ../daedalus-e1-outcomes; its 65 reports are committed (c-lab-e1-26).' },
      { id: 'c-lab-x-63', doc: LD, line: 28, what: 'E1 cells without a tsconfig.json', stated: '63 cells', note: 'Needs ../daedalus-e1-outcomes (not in the repository).' },
      { id: 'c-lab-x-first-pass', doc: LD, line: 105, what: 'findings flagged incorrect by the first checker pass', stated: '2 findings', needs: 'not-checkable', note: 'The first-pass output was not committed; the fixed checker gives 0 incorrect (c-lab-ref-82-incorrect).' },
      { id: 'c-lab-x-mem', doc: LD, line: 222, what: 'free memory during the run', stated: '33-37%', needs: 'not-checkable', note: 'Machine state of the original run.' },
      { id: 'c-lab-x-swap', doc: LD, line: 222, what: 'swap during the run', stated: '12.3-12.7 GB', needs: 'not-checkable', note: 'Machine state of the original run.' },
    ],
  },
  // ---- Docs/v1.3/labelling.md ---------------------------------------------------------------------------------------
  {
    id: 'c-labmd-study1',
    title: 'labelling.md dry run on the committed Study 1 E1 reports (results/e1-grid)',
    needs: 'offline',
    basis: 'regenerated',
    slow: false,
    how: 'npx tsx scripts/v1.3/labelling-jobs.ts --e1-runs results/e1-grid/runs --e1-plan experiments/e1-grid/plan.json --out W/jobs.json; sample-findings.ts --seed 20261015 [--tiers all]; label-meaningful.ts --estimate',
    numbers: [
      { id: 'c-labmd-s1-cells', line: 57, what: 'accepted E1 cells', stated: '65 accepted cells' },
      { id: 'c-labmd-s1-blocking', line: 57, what: 'blocking-tier findings', stated: 'no blocking-tier finding' },
      ...['FF-CV05 1184', 'FF-C03 154', 'FF-P02 51', 'FF-C02 21', 'FF-C06 6', 'FF-SO01 3', 'FF-C04 2', 'FF-SO02 2'].map((s) => ({ id: `c-labmd-s1-${slug(s.split(' ')[0])}`, line: 57, what: `Study 1 E1 ${s.split(' ')[0]} findings`, stated: s })),
      { id: 'c-labmd-s1-0calls', line: 57, what: 'blocking sample calls', stated: 'costs 0 calls' },
      { id: 'c-labmd-s1-all', line: 57, what: '--tiers all sample', stated: '154 findings over 8 rules' },
      { id: 'c-labmd-s1-est', line: 57, what: '--estimate calls and worst case', stated: '308 calls (worst case 1232)' },
    ].map((n) => ({ doc: LM, ...n })),
    run(ctx) {
      const o = ctx.out('c-labmd-study1');
      ctx.sh(`npx tsx scripts/v1.3/labelling-jobs.ts --e1-runs results/e1-grid/runs --e1-plan experiments/e1-grid/plan.json --out "${o}/jobs.json"`);
      ctx.sh(`npx tsx scripts/v1.3/sample-findings.ts --jobs "${o}/jobs.json" --seed 20261015 --out "${o}/sample.json"`);
      ctx.sh(`npx tsx scripts/v1.3/sample-findings.ts --jobs "${o}/jobs.json" --seed 20261015 --tiers all --out "${o}/sample-all.json"`);
      const blk = estimate(ctx, `${o}/sample.json`, `${o}/jobs.json`); const all = estimate(ctx, `${o}/sample-all.json`, `${o}/jobs.json`);
      const sa = ctx.json(`${o}/sample-all.json`);
      const pop = Object.fromEntries(sa.rules.map((r) => [r.ruleId, (r.population)]));
      const blockingPop = sa.rules.filter((r) => r.tier === 'blocking').length;
      const r = {
        'c-labmd-s1-cells': `${ctx.json(`${o}/jobs.json`).jobs.length} accepted cells`,
        'c-labmd-s1-blocking': blockingPop === 0 && ctx.json(`${o}/sample.json`).items.length === 0 ? 'no blocking-tier finding' : `${blockingPop} blocking rules`,
        'c-labmd-s1-0calls': `costs ${blk.calls} calls`,
        'c-labmd-s1-all': `${sa.items.length} findings over ${sa.rules.length} rules`,
        'c-labmd-s1-est': `${all.calls} calls (worst case ${all.worst})`,
      };
      for (const id of ['FF-CV05', 'FF-C03', 'FF-P02', 'FF-C02', 'FF-C06', 'FF-SO01', 'FF-C04', 'FF-SO02']) r[`c-labmd-s1-${slug(id)}`] = `${id} ${pop[id] ?? 0}`;
      return r;
    },
  },
  {
    id: 'c-labmd-afterfixes',
    title: 'labelling.md dry run on the reference after-fixes evidence',
    needs: 'offline',
    basis: 'regenerated',
    slow: true,
    how: 'npx tsx scripts/v1.3/labelling-jobs.ts --reference results/v1.3-reference/after-fixes/evidence --materialise W/variants --out W/jobs.json; sample-findings.ts --seed 20261015; label-meaningful.ts --estimate; check-correct.ts --tiers all',
    numbers: [
      { id: 'c-labmd-af-variants', line: 72, what: 'variants', stated: '71 variants' },
      { id: 'c-labmd-af-blocking', line: 72, what: 'blocking findings correct of checkable, rule/template pairs', stated: '53 of 53 checkable, over 15 rule/template pairs' },
      { id: 'c-labmd-af-p06', line: 72, what: 'FF-P06 FLOWS_TO rows, not-checkable', stated: 'the 3 FF-P06 rows' },
      { id: 'c-labmd-af-sample', line: 72, what: 'blocking sample', stated: '53 findings over 15 rules' },
      { id: 'c-labmd-af-est', line: 72, what: '--estimate calls and worst case', stated: '106 calls (worst case 424)' },
      { id: 'c-labmd-af-cv05', line: 72, what: 'FF-CV05 findings, all correct', stated: 'FF-CV05 (1426 findings)' },
    ].map((n) => ({ doc: LM, ...n })),
    run(ctx) {
      const o = ctx.out('c-labmd-afterfixes');
      ctx.sh(`npx tsx scripts/v1.3/labelling-jobs.ts --reference results/v1.3-reference/after-fixes/evidence --materialise "${o}/variants" --out "${o}/jobs.json"`);
      ctx.sh(`npx tsx scripts/v1.3/sample-findings.ts --jobs "${o}/jobs.json" --seed 20261015 --out "${o}/sample.json"`);
      const est = estimate(ctx, `${o}/sample.json`, `${o}/jobs.json`);
      ctx.sh(`npx tsx scripts/v1.3/check-correct.ts --jobs "${o}/jobs.json" --tiers all --out "${o}/cc"`);
      const corr = ctx.json(`${o}/cc/correctness.json`);
      const s = ctx.json(`${o}/sample.json`);
      const blk = corr.results.filter((x) => x.tier === 'blocking');
      const chk = blk.filter((x) => x.verdict !== 'not-checkable');
      const pairs = new Set(chk.map((x) => x.rule)).size;
      const p06 = blk.filter((x) => x.ruleId === 'FF-P06' && x.verdict === 'not-checkable').length;
      const cv = corr.summary.find((x) => x.rule === 'FF-CV05/test-file-pairing');
      return {
        'c-labmd-af-variants': `${ctx.json(`${o}/jobs.json`).jobs.length} variants`,
        'c-labmd-af-blocking': `${chk.filter((x) => x.verdict === 'correct').length} of ${chk.length} checkable, over ${pairs} rule/template pairs`,
        'c-labmd-af-p06': `the ${p06} FF-P06 rows`,
        'c-labmd-af-sample': `${s.items.length} findings over ${s.rules.length} rules`,
        'c-labmd-af-est': `${est.calls} calls (worst case ${est.worst})`,
        'c-labmd-af-cv05': cv.correct === cv.n ? `FF-CV05 (${cv.n} findings)` : `FF-CV05 (${cv.correct} of ${cv.n} correct)`,
      };
    },
  },
  {
    id: 'c-labmd-code',
    title: 'labelling.md / human-labelling-protocol.md: excerpt window in meaningful-prompt.ts',
    needs: 'offline',
    basis: 're-derived',
    slow: false,
    how: 'EXCERPT_WINDOW in scripts/v1.3/lib/labelling/meaningful-prompt.ts',
    numbers: [
      { id: 'c-labmd-excerpt-15', doc: LM, line: 118, what: 'excerpt lines either side of the finding', stated: '15 lines either side' },
      { id: 'c-labmd-excerpt-31', doc: LM, line: 118, what: 'excerpt length when the finding has no line', stated: 'the first 31 lines' },
      { id: 'c-hlp-excerpt-31', doc: HP, line: 15, what: 'excerpt length on the union sheet', stated: 'a 31-line excerpt' },
    ],
    run(ctx) {
      const src = ctx.read('scripts/v1.3/lib/labelling/meaningful-prompt.ts');
      const w = Number(src.match(/EXCERPT_WINDOW = (\d+)/)[1]);
      return { 'c-labmd-excerpt-15': `${w} lines either side`, 'c-labmd-excerpt-31': `the first ${2 * w + 1} lines`, 'c-hlp-excerpt-31': `a ${2 * w + 1}-line excerpt` };
    },
  },
  // ---- Docs/v1.3/human-labelling-protocol.md ------------------------------------------------------------------------
  {
    id: 'c-hlp',
    title: 'human-labelling-protocol.md: sample-size arithmetic and the calibration sheet',
    needs: 'offline',
    basis: 're-derived',
    slow: false,
    how: 'Wilson 95% half-widths (z = 1.959964) at n = 60, 120, 12, 24; binary kappa with p_o = 0.90 and 25% negatives, SE = sqrt(p_o(1-p_o)/n)/(1-p_e); audit/key/v1.3-calibration-sheet.key.json',
    numbers: [
      { id: 'c-hlp-per-style-a', line: 31, what: 'Option A items per style (60 / 5 styles)', stated: 'about 12 items' },
      { id: 'c-hlp-per-style-b', line: 31, what: 'Option B items per style (120 / 5 styles)', stated: 'about 24 items' },
      { id: 'c-hlp-wilson-a', line: 32, what: 'Option A Wilson half-widths', stated: '±0.09 at p = 0.85; ±0.12 at p = 0.5' },
      { id: 'c-hlp-wilson-b', line: 32, what: 'Option B Wilson half-widths', stated: '±0.06 at p = 0.85; ±0.09 at p = 0.5' },
      { id: 'c-hlp-kappa', line: 33, what: 'binary kappa at p_o = 0.90 and 25% negatives', stated: 'κ ≈ 0.73' },
      { id: 'c-hlp-kse-a', line: 33, what: 'Option A kappa SE, interval, lower bound', stated: '≈ 0.10 (95% interval about ±0.20; lower bound ≈ 0.53)' },
      { id: 'c-hlp-kse-b', line: 33, what: 'Option B kappa SE, interval, lower bound', stated: '≈ 0.07 (about ±0.14; lower bound ≈ 0.59)' },
      { id: 'c-hlp-style-a', line: 34, what: 'Option A per-style half-width (n = 12; smallest over p = 0.85, 0.5, one decimal)', stated: '±0.2 or wider' },
      { id: 'c-hlp-style-b', line: 34, what: 'Option B per-style half-width (n = 24, p = 0.85, nearest 0.05)', stated: 'about ±0.15' },
      { id: 'c-hlp-per-rule', line: 36, what: 'items per blocking rule/template pair (60 / 20 to 120 / 15)', stated: '3–8 items' },
      { id: 'c-hlp-gate', line: 38, what: 'lower kappa bound above 0.60 under either option', stated: 'neither option gives a lower bound above 0.60' },
      { id: 'c-hlp-calib-10', line: 55, what: 'calibration sheet items', stated: 'the 10 development-set items' },
      { id: 'c-hlp-calib-3', line: 56, what: 'ambiguous calibration items', stated: 'the 3 ambiguous ones' },
      { id: 'c-hlp-calib-10-es', line: 108, what: 'calibration items (Spanish appendix)', stated: '10 ítems' },
      { id: 'c-hlp-pairs', line: 36, what: 'blocking rule/template pairs (hold-out estimate)', stated: 'about 15–20 blocking rule and template pairs', needs: 'not-checkable', note: 'An estimate for the hold-out set; the development set has 15 checkable blocking pairs (c-labmd-af-blocking).' },
    ].map((n) => ({ doc: HP, ...n })),
    run(ctx) {
      const hw = (p, n) => { const [l, h] = wilson(p * n, n); return (h - l) / 2; };
      const po = 0.9; const pe = 0.75 ** 2 + 0.25 ** 2; const k = (po - pe) / (1 - pe);
      const se = (n) => Math.sqrt((po * (1 - po)) / n) / (1 - pe);
      const kse = (n) => [se(n), 1.96 * se(n), k - 1.96 * se(n)];
      const [sa, ia, la] = kse(60); const [sb, ib, lb] = kse(120);
      const key = ctx.json('audit/key/v1.3-calibration-sheet.key.json');
      const nItems = key.items.length; const amb = key.items.filter((x) => x.category === 'ambiguous').length;
      return {
        'c-hlp-per-style-a': `about ${60 / 5} items`, 'c-hlp-per-style-b': `about ${120 / 5} items`,
        'c-hlp-wilson-a': `±${hw(0.85, 60).toFixed(2)} at p = 0.85; ±${hw(0.5, 60).toFixed(2)} at p = 0.5`,
        'c-hlp-wilson-b': `±${hw(0.85, 120).toFixed(2)} at p = 0.85; ±${hw(0.5, 120).toFixed(2)} at p = 0.5`,
        'c-hlp-kappa': `κ ≈ ${k.toFixed(2)}`,
        'c-hlp-kse-a': `≈ ${sa.toFixed(2)} (95% interval about ±${ia.toFixed(2)}; lower bound ≈ ${la.toFixed(2)})`,
        'c-hlp-kse-b': `≈ ${sb.toFixed(2)} (about ±${ib.toFixed(2)}; lower bound ≈ ${lb.toFixed(2)})`,
        'c-hlp-style-a': `±${Math.min(hw(0.85, 12), hw(0.5, 12)).toFixed(1)} or wider`,
        'c-hlp-style-b': `about ±${(Math.round(hw(0.85, 24) * 20) / 20).toFixed(2)}`,
        'c-hlp-per-rule': `${Math.floor(60 / 20)}–${Math.floor(120 / 15)} items`,
        'c-hlp-gate': la <= 0.6 && lb <= 0.6 ? 'neither option gives a lower bound above 0.60' : 'an option gives a lower bound above 0.60',
        'c-hlp-calib-10': `the ${nItems} development-set items`, 'c-hlp-calib-3': `the ${amb} ambiguous ones`, 'c-hlp-calib-10-es': `${nItems} ítems`,
      };
    },
  },
];

// Reference jobs only (materialised variants), for the cassette replay; reuses the full regeneration when it already ran.
let refJobs;
function regenRefJobsOnly(ctx) {
  if (refRun) return refRun;
  if (refJobs) return refJobs;
  const o = ctx.out('c-lab-ref-jobs');
  ctx.sh(`npx tsx scripts/v1.3/labelling-jobs.ts --reference results/v1.3-reference/after-member-facts/evidence --materialise "${o}/variants" --out "${o}/jobs.json"`);
  refJobs = { dir: o };
  return refJobs;
}
