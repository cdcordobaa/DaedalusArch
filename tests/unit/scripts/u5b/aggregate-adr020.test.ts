/**
 * ADR-020 (P-2) aggregation outputs, hand-computed:
 * - item 3: recall rows carry the (project, operator) cell interval (primary), the project bootstrap (co-primary) and
 *   the instance Wilson "if independent" bound; per-function rows use the applicable functions;
 * - item 1: `precision_baseline.csv`, the `precision_baseline` columns and the figure-ready `precision_figure.csv`;
 * - item 5: the `neural_new` column; item 8: the corpus-tier strata rows;
 * - item 2: TP-class FPAT counts weigh 1 / p; items 6, 7: descriptive pairwise CIs, ahsDeterministic co-primary for the
 *   model effect, and the directional self-preference check.
 */
import type { EvaluationReport } from '../../../../src/shared/types/evaluation.js';
import { canonicalGoldenScore, scoreDifferential } from '../../../../scripts/score-golden.js';
import type { ReconciledP1Label } from '../../../../scripts/score-golden.js';
import { loadSo5Codes } from '../../../../scripts/lib/so5-codes.js';
import type { So5Codes } from '../../../../scripts/lib/so5-codes.js';
import { parseCsv } from '../../../../scripts/lib/figures/draw.js';
import { aggregate, directionalCheck, fpatCounts, so5Tests, DIRECTIONAL_FAMILY } from '../../../../scripts/aggregate.js';
import type { AggregateInput, GoldenScoreJson, So5Cell } from '../../../../scripts/aggregate.js';
import type { ReconciledLabel } from '../../../../scripts/llm-label.js';
import type { RunRecord } from '../../../../scripts/lib/report-io.js';
import { ROOT, key, report, row, rule, seed } from './score-fixture.js';
import type { V } from './score-fixture.js';

const so5 = ((): So5Codes => {
  const l = loadSo5Codes(ROOT);
  if (!l.ok) throw new Error(l.detail);
  return l.codes;
})();

const D = 'src/domain/Task.ts';
const I = 'src/infra/Repo.ts';
const IMP = ['IMPORTS'];
const S01_KEY = key('FF-S01', D, I, IMP, 'site-line', 3);
const S01_V: V = { functionId: 'FF-S01', filePath: D, target: I, discriminator: IMP, line: 3 };

/** 4 (project, operator) cells of k = 3 copies on two corpus projects; detected 3, 3, 2, 0 (8 of 12). */
async function cellScore(): Promise<{ score: GoldenScoreJson; fpItem: string }> {
  const plan: [string, string, number][] = [['p1', 'MO-S01', 3], ['p1', 'MO-S02', 3], ['p2', 'MO-S01', 2], ['p2', 'MO-S02', 0]];
  const seeds = [];
  for (const [project, op, detected] of plan) {
    for (let c = 0; c < 3; c++) {
      const extra: V[] = project === 'p1' && op === 'MO-S01' && c === 0 ? [{ functionId: 'FF-C04', filePath: 'src/orphan.ts' }] : [];
      const neural: V[] = project === 'p2' && op === 'MO-S01' && c === 0 ? [{ functionId: 'FF-N01', filePath: 'src/x.ts', unitId: 'u-x', route: 'neuronal' }] : [];
      seeds.push(seed(
        row({ seedId: `${project}:${op}:${String(c)}`, expected: { functionIds: ['FF-S01'], keys: [S01_KEY] } }),
        await report([], { mode: 'full' }),
        await report([...(c < detected ? [S01_V] : []), ...extra, ...neural], { mode: 'full' }),
      ));
    }
  }
  const first = scoreDifferential({ rule: rule(), seeds, corpusTiers: new Map([['p1', 'core' as const], ['p2', 'e7' as const]]) });
  if (!first.ok) throw new Error(first.detail);
  const fpItem = first.labelItems[0]?.itemId ?? '';
  const labelled = scoreDifferential({ rule: rule(), seeds, corpusTiers: new Map([['p1', 'core' as const], ['p2', 'e7' as const]]), labels: new Map<string, ReconciledP1Label>([[fpItem, 'FP']]) });
  if (!labelled.ok) throw new Error(labelled.detail);
  return { score: JSON.parse(canonicalGoldenScore(labelled.score)) as GoldenScoreJson, fpItem };
}

const p2 = (n: number, projectId: string, functionId: string, label: string, p: number): ReconciledLabel[] =>
  Array.from({ length: n }, (_, i) => ({
    itemId: `${projectId}-${functionId}-${label}-${String(i)}`, projectId, kind: 'violation', population: 'P2', stratum: `${projectId}, ${functionId}`,
    inclusionProbability: p, label: label as ReconciledLabel['label'], runs: [] as unknown as ReconciledLabel['runs'],
  }));
const P2_LABELS = [...p2(15, 'p1', 'FF-S01', 'TP', 0.5), ...p2(5, 'p1', 'FF-S01', 'FP', 0.5), ...p2(1, 'p2', 'FF-C04', 'TP', 1), ...p2(4, 'p2', 'FF-C04', 'FP', 1)];

function base(score: GoldenScoreJson, over: Partial<AggregateInput> = {}): AggregateInput {
  return { planId: 'so4-heldout', records: [], reports: new Map(), so5, score, resamples: 200, labelling: { labels: P2_LABELS }, ...over };
}

describe('recall intervals per (project, operator) cell (ADR-020 item 3)', () => {
  it('held-out total: Wilson on 4 cells is primary; project bootstrap descriptive (2 < 10 projects); instance Wilson as the "if independent" bound', async () => {
    const { score } = await cellScore();
    const out = aggregate(base(score));
    const overall = parseCsv(out.get('prf_overall.csv') ?? '').rows;
    const ho = overall.find((r) => r.split === 'held-out' && r.base_kind === 'all' && r.coverage === 'all');
    // Hand computation (as in stats-adr020.test.ts): p = 8/12; Wilson(n = 4 cells) = [0.245120, 0.924917];
    // Wilson(8, 12 instances) = [0.390622, 0.861880].
    expect(ho).toMatchObject({
      tp: '8', fn: '4', fp_strict: '1', recall: '0.666667', ci_low: '0.245120', ci_high: '0.924917', ci_method: 'wilson-cells', n_clusters: '4',
      ci_project_method: 'cluster-bootstrap', n_projects: '2', ci_project_descriptive: 'true', ci_independent_low: '0.390622', ci_independent_high: '0.861880', ci_independent_method: 'wilson',
    });
    const fn = parseCsv(out.get('prf_by_function.csv') ?? '').rows.find((r) => r.split === 'held-out' && r.base_kind === 'all' && r.coverage === 'all' && r.function_id === 'FF-S01');
    expect(fn).toMatchObject({ tp: '8', fn: '4', ci_method: 'wilson-cells', n_clusters: '4', ci_low: '0.245120' });
  });

  it('pooled E7 row (item 8): [held-out, corpus-e7, all] holds p2 only (2 of 6, cells 2 and 0)', async () => {
    const { score } = await cellScore();
    const rows = parseCsv(aggregate(base(score)).get('prf_overall.csv') ?? '').rows;
    const e7 = rows.find((r) => r.split === 'held-out' && r.base_kind === 'corpus-e7');
    expect(e7).toMatchObject({ tp: '2', fn: '4', recall: '0.333333', ci_method: '', n_clusters: '2' });
    expect(rows.find((r) => r.base_kind === 'corpus-core')).toMatchObject({ tp: '6', fn: '0' });
    const inst = parseCsv(aggregate(base(score)).get('instances.csv') ?? '').rows;
    expect(inst.filter((r) => r.corpus_tier === 'e7')).toHaveLength(6);
  });
});

describe('baseline precision outputs (ADR-020 item 1) and the neural column (item 5)', () => {
  it('precision_baseline.csv, the precision_baseline columns and the figure rows beside the seeded differential precision', async () => {
    const { score } = await cellScore();
    const out = aggregate(base(score, { corpusTiers: new Map([['p1', 'core' as const], ['p2', 'e7' as const]]) }));
    const bp = parseCsv(out.get('precision_baseline.csv') ?? '').rows;
    // Σw = 20·2 + 5 = 45; Σw·y = 15·2 + 1 = 31 → 0.688889.
    expect(bp[0]).toMatchObject({ plan_id: 'so4-heldout', scope: 'overall', key: '', n_items: '25', n_tp_class: '16', weighted_tp_class: '31.000000', weighted_total: '45.000000', precision_baseline: '0.688889', ci_method: 'wilson-kish', n_clusters: '2' });
    expect(bp.map((r) => [r.scope, r.key].map(String).join(':'))).toEqual(['overall:', 'tier:core', 'tier:e7', 'function:FF-C04', 'function:FF-S01', 'project:p1', 'project:p2']);
    const ho = parseCsv(out.get('prf_overall.csv') ?? '').rows.find((r) => r.split === 'held-out' && r.base_kind === 'all' && r.coverage === 'all');
    // Seeded differential: TP 8, FP-labelled 1 → 0.888889, next to the baseline 0.688889.
    expect(ho).toMatchObject({ precision_labelled: '0.888889', precision_baseline: '0.688889' });
    const fn = parseCsv(out.get('prf_by_function.csv') ?? '').rows.filter((r) => r.split === 'held-out' && r.base_kind === 'all' && r.coverage === 'all');
    expect(fn.find((r) => r.function_id === 'FF-S01')).toMatchObject({ precision_baseline: '0.750000', neural_new: '0' });
    const fig = parseCsv(out.get('precision_figure.csv') ?? '').rows;
    expect(fig.filter((r) => r.scope === 'overall').map((r) => [r.measure, r.estimate, r.n])).toEqual([
      ['seeded-differential-labelled', '0.888889', '9'], ['seeded-differential-strict', '0.888889', '9'], ['baseline', '0.688889', '25'],
    ]);
    // FF-C04: the one undeclared orphan violation is a seeded FP (labelled FP) → precision 0 of 1, then the baseline row.
    expect(fig.filter((r) => r.scope === 'function' && r.function_id === 'FF-C04').map((r) => [r.measure, r.estimate, r.n])).toEqual([
      ['seeded-differential-labelled', '0.000000', '1'], ['seeded-differential-strict', '0.000000', '1'], ['baseline', '', '5'],
    ]);
    expect([...new Map(score.neuralNewByFunction ?? [])]).toEqual([['FF-N01', 1]]);
  });

  it('without labelling outputs the baseline files are header-only and the columns are empty', async () => {
    const { score } = await cellScore();
    const out = aggregate(base(score, { labelling: {} }));
    expect(parseCsv(out.get('precision_baseline.csv') ?? '').rows).toEqual([]);
    expect(parseCsv(out.get('prf_overall.csv') ?? '').rows.every((r) => r.precision_baseline === '')).toBe(true);
  });
});

describe('SO5 rules of ADR-020 (items 2, 6, 7)', () => {
  it('FPAT: a TP label with p = 0.5 weighs 2 (TP-class weighted 1 / p)', () => {
    const report = { functionResults: [{ functionId: 'FF-S01', name: 'dependency-direction' }], neuralResults: [] } as unknown as EvaluationReport;
    const counts = fpatCounts('r1', report, [
      { runId: 'r1', functionId: 'FF-S01', label: 'TP', inclusionProbability: 0.5 },
      { runId: 'r1', functionId: 'FF-S01', label: 'unseeded-TP', inclusionProbability: 0.25 },
    ], so5);
    expect(Object.fromEntries(counts)).toEqual({ 'FPAT-DEP-DIRECTION': { count: 2, weighted: 6 } });
  });

  const cellOf = (i: number, model: string, task: string, neuronal: number, deterministic: number): So5Cell => {
    const record = { runId: `r${String(i)}`, cell: { requestedModelId: model } } as unknown as RunRecord;
    const report = { evaluationMode: 'full', scoring: { verdictSource: 'ahsCombined' }, ahsCombined: 0.5 + 0.1 * (model === 'opus' ? 1 : 0) + 0.01 * i, ahsDeterministic: deterministic, ahsNeuronal: neuronal, perDimensionScores: [], functionResults: [], neuralResults: [] } as unknown as EvaluationReport;
    return { record, report, valid: true, model, specLevel: i % 2 === 0 ? 'none' : 'full-aac', taskId: task, runIndex: 0, fpat: new Map() };
  };

  it('directional check: mean(d | opus) − mean(d | others) with d = ahsNeuronal − ahsDeterministic, one-sided', () => {
    // Hand computation: opus d = 0.9−0.5, 0.8−0.5 → mean 0.35; others d = 0.6−0.5, 0.5−0.5, 0.6−0.6, 0.7−0.6 → mean 0.05.
    const cells = [
      cellOf(0, 'opus', 't1', 0.9, 0.5), cellOf(1, 'opus', 't2', 0.8, 0.5),
      cellOf(2, 'sonnet', 't1', 0.6, 0.5), cellOf(3, 'sonnet', 't2', 0.5, 0.5), cellOf(4, 'haiku', 't1', 0.6, 0.6), cellOf(5, 'haiku', 't2', 0.7, 0.6),
    ];
    const row = directionalCheck(cells, 'opus', 3, 2000);
    expect(row?.[0]).toBe('directional:opus-vs-others');
    expect(row?.[1]).toBe('0.300000');
    expect(row?.[4]).toBe(DIRECTIONAL_FAMILY);
    // Cliff's δ: every opus d (0.4, 0.3) exceeds every other d (0.1, 0, 0, 0.1) → 1.
    expect(row?.[8]).toBe('1.000000');
    expect(Number(row?.[2])).toBeLessThan(0.5);
    expect(directionalCheck(cells, 'absent-model', 3, 100)).toBeUndefined();
  });

  it('so5_tests rows: ahsDeterministic co-primary for the model effect only; every pairwise CI descriptive; directional row last', () => {
    const cells: So5Cell[] = [];
    let i = 0;
    for (const model of ['haiku', 'opus', 'sonnet']) for (const task of ['t1', 't2']) for (const level of ['none', 'full-aac']) {
      const c = cellOf(i++, model, task, 0.5 + (model === 'opus' ? 0.2 : 0), 0.5 + 0.01 * i);
      cells.push({ ...c, specLevel: level });
    }
    const rows = so5Tests(cells, { bootstrap: 2, permutation: 3 }, 199, 'opus');
    const co = rows.filter((r) => r[4] === 'co-primary:ahsDeterministic' && r[1] !== '');
    expect(co.map((r) => [r[0], r[9]])).toEqual([['model', 'false'], ['spec-level', 'true'], ['model×spec-level', 'true']]);
    const pairwise = rows.filter((r) => String(r[0]).includes(':') && !String(r[0]).startsWith('directional'));
    expect(pairwise.length).toBeGreaterThan(0);
    expect(pairwise.every((r) => r[10] === 'true')).toBe(true);
    expect(rows.filter((r) => r[1] !== '' && !(r[0] ?? '').startsWith('directional')).every((r) => r[10] === 'false')).toBe(true);
    expect(rows.at(-1)?.[4]).toBe(DIRECTIONAL_FAMILY);
    expect(rows.filter((r) => r[4]?.startsWith('secondary:') === true).every((r) => r[9] === 'true')).toBe(true);
  });
});
