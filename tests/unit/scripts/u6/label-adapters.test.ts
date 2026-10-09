/**
 * U6 Labels: label-shape adapters (ADR-021 SO4-01, SO5-01, SO4-02) and the llm-label changes of the lane (THR-6,
 * SO3-5, the registered route and sizing). Hand-computed fixtures throughout.
 */
import {
  LABELS_SHAPE_INVALID, fnCauseColumns, fpatLabelsOf, isReconciledLabels, p1LabelsOf, unlabelledItems,
} from '../../../../scripts/lib/label-adapters.js';
import type { LabelView, RecordView } from '../../../../scripts/lib/label-adapters.js';
import {
  COUNTS_ONLY, LABEL_PROVIDER_CONFLICT, WEIGHTED_ITEM_BOOTSTRAP, agreementStats, estimatePlan, pairAgreement, routeOf, tokenUsage,
} from '../../../../scripts/llm-label.js';
import type { LabelPlanFile, LabellerPrompt } from '../../../../scripts/llm-label.js';
import type { ItemKind, LabelItem } from '../../../../scripts/lib/label-context.js';
import { fpatLabelsFromFile } from '../../../../scripts/aggregate.js';
import type { RunRecord } from '../../../../scripts/lib/report-io.js';

function label(over: Partial<LabelView> & Pick<LabelView, 'itemId' | 'population' | 'label'>): LabelView {
  return { kind: 'violation', projectId: 'p', inclusionProbability: 1, ...over };
}

describe('score-golden --labels adapter (SO4-01)', () => {
  it('reads the P1 items of llm-label output and ignores the other populations', () => {
    const r = p1LabelsOf([
      label({ itemId: 'a', population: 'P1', label: 'TP' }), label({ itemId: 'b', population: 'P1', label: 'uncertain' }),
      label({ itemId: 'c', population: 'P2', label: 'FP' }),
    ]);
    expect(r.ok && [...r.labels]).toEqual([['a', 'TP'], ['b', 'uncertain']]);
  });

  it('still reads an itemId -> label object, and refuses other shapes and labels', () => {
    const r = p1LabelsOf({ a: 'FP' });
    expect(r.ok && [...r.labels]).toEqual([['a', 'FP']]);
    for (const bad of [[{ x: 1 }], { a: 'pass' }, 'TP', [label({ itemId: 'a', population: 'P1', label: 'pass' })]]) {
      const b = p1LabelsOf(bad);
      expect(b.ok).toBe(false);
      expect(!b.ok && b.detail).toContain(LABELS_SHAPE_INVALID);
    }
  });

  it('names the P1 items without a label (sorted, unique)', () => {
    expect(unlabelledItems(['c', 'a', 'b', 'c'], new Map([['b', 'TP']]))).toEqual(['a', 'c']);
  });
});

describe('aggregate --labels adapter (SO5-01)', () => {
  const records: RecordView[] = [
    { runId: 'e1-000-cell-a', projectId: 'cell-a', status: 'accepted', cell: {} },
    { runId: 'e1-001-cell-b', projectId: 'cell-b', status: 'accepted', cell: {} },
    { runId: 'e1-002-cell-b', projectId: 'cell-b', status: 'accepted', cell: {} },
    { runId: 'corpus-0', projectId: 'cell-a', status: 'accepted' },
  ];

  it('maps P3 labels to their run id (given, or the one accepted E1 record of the project); other populations drop', () => {
    const r = fpatLabelsOf([
      label({ itemId: 'x', population: 'P3', label: 'TP', projectId: 'cell-a', functionId: 'FF-S01', inclusionProbability: 0.25 }),
      label({ itemId: 'y', population: 'P3', label: 'FP', projectId: 'cell-b', runId: 'e1-002-cell-b', stratum: 'cell-b, FF-S04' }),
      label({ itemId: 'z', population: 'P2', label: 'TP', projectId: 'cell-a', functionId: 'FF-S01' }),
    ], records);
    expect(r.ok && r.labels).toEqual([
      { runId: 'e1-000-cell-a', functionId: 'FF-S01', label: 'TP', inclusionProbability: 0.25 },
      { runId: 'e1-002-cell-b', functionId: 'FF-S04', label: 'FP', inclusionProbability: 1 },
    ]);
  });

  it('refuses an ambiguous project, an unknown run id and a label without a function', () => {
    const amb = fpatLabelsOf([label({ itemId: 'y', population: 'P3', label: 'TP', projectId: 'cell-b', functionId: 'F' })], records);
    expect(!amb.ok && amb.detail).toContain('matches 2 accepted E1 records');
    const stray = fpatLabelsOf([label({ itemId: 'y', population: 'P3', label: 'TP', runId: 'corpus-0', functionId: 'F' })], records);
    expect(!stray.ok && stray.detail).toContain('not an E1 record');
    const nofn = fpatLabelsOf([label({ itemId: 'y', population: 'P3', label: 'TP', projectId: 'cell-a' })], records);
    expect(!nofn.ok && nofn.detail).toContain('no function id');
  });

  it('aggregate --labels: no P3 label gives no row (label-dependent FPAT values N/A, ADR-021 item 8.1); stray labels refused', () => {
    const rec = (runId: string, cell: boolean): RunRecord => ({ runId, projectId: runId, planId: 'e1-grid', status: 'accepted', ...(cell && { cell: {} }) } as unknown as RunRecord);
    expect(fpatLabelsFromFile([label({ itemId: 'z', population: 'P2', label: 'TP', functionId: 'F' })], [rec('r1', true)])).toEqual([]);
    expect(() => fpatLabelsFromFile([{ runId: 'nope', functionId: 'F', label: 'TP' }], [rec('r1', true)])).toThrow('not an E1 record');
    expect(() => fpatLabelsFromFile({ a: 1 }, [rec('r1', true)])).toThrow('--labels must be');
    expect(fpatLabelsFromFile([label({ itemId: 'x', population: 'P3', label: 'TP', projectId: 'r1', functionId: 'FF-S01' })], [rec('r1', true)]))
      .toEqual([{ runId: 'r1', functionId: 'FF-S01', label: 'TP', inclusionProbability: 1 }]);
    expect(isReconciledLabels([])).toBe(true);
  });
});

describe('instances.csv FN cause columns (SO4-02)', () => {
  const causes = [{ seedId: 's1', rootCause: 'RC-TYPE-ONLY', source: 'mechanical' }];
  const labels = [
    label({ itemId: 'm2', population: 'MS', kind: 'missed-seed', label: 'FN', seedId: 's2', rootCause: 'RC-LAYER-MAP' }),
    label({ itemId: 'm3', population: 'MS', kind: 'missed-seed', label: 'uncertain', seedId: 's3' }),
  ];
  it('mechanical first, then the reconciled MS label, else empty', () => {
    expect(fnCauseColumns('s1', causes, labels)).toEqual(['RC-TYPE-ONLY', 'mechanical']);
    expect(fnCauseColumns('s2', causes, labels)).toEqual(['RC-LAYER-MAP', 'labeller']);
    expect(fnCauseColumns('s3', causes, labels)).toEqual(['', '']);
    expect(fnCauseColumns('s4', causes, labels)).toEqual(['', '']);
  });
});

describe('weighted agreement interval (THR-6)', () => {
  // 6 agreeing pairs of weight 1 and 4 disagreeing pairs of weight 3: po = 6 / (6 + 12) = 1/3.
  const pairs = [
    ...Array.from({ length: 6 }, () => ({ a: 'pass', b: 'pass', w: 1 })),
    ...Array.from({ length: 4 }, () => ({ a: 'pass', b: 'fail', w: 3 })),
  ];
  it('weighted rows use a percentile bootstrap over items; the estimate is the weighted share', () => {
    const r = pairAgreement('judge-vs-panel', 'j', pairs, ['pass', 'fail'], true, 0, false, { bootstrap: { seed: 6102, resamples: 2000 } });
    expect(r.percentAgreement).toBeCloseTo(1 / 3, 12);
    expect(r.ciMethod).toBe(WEIGHTED_ITEM_BOOTSTRAP);
    expect(r.ci?.[0]).toBeLessThan(1 / 3);
    expect(r.ci?.[1]).toBeGreaterThan(1 / 3);
    expect(pairAgreement('judge-vs-panel', 'j', pairs, ['pass', 'fail'], true, 0, false, { bootstrap: { seed: 6102, resamples: 2000 } })).toEqual(r);
  });

  it('all pairs agreeing give [1, 1]; fewer than 10 pairs report counts only', () => {
    const agree = Array.from({ length: 10 }, () => ({ a: 'pass', b: 'pass', w: 2 }));
    expect(pairAgreement('panel-vs-audit', 'a', agree, ['pass', 'fail'], true, 0, false, { bootstrap: { seed: 1, resamples: 100 } }).ci).toEqual([1, 1]);
    const few = pairAgreement('panel-vs-audit', 'a', agree.slice(0, 9), ['pass', 'fail'], true, 0, false, { bootstrap: { seed: 1 } });
    expect(few).toMatchObject({ n: 9, percentAgreement: 1, ci: null, ciMethod: COUNTS_ONLY });
  });

  it('unweighted rows keep Wilson', () => {
    expect(pairAgreement('run-vs-run', 'all', pairs, ['pass', 'fail'], false, 0, false, { bootstrap: { seed: 1 } }).ciMethod).toBe('wilson');
  });
});

describe('judge repetition subjects (SO3-5)', () => {
  const prompts = new Map<ItemKind, LabellerPrompt>();
  const entry = (projectId: string | undefined, requestHash: string, pass: boolean): { functionId: string; unitId: string; projectId?: string; requestHash: string; outcome: { kind: string }; parsedVerdict: { pass: boolean } } => ({
    functionId: 'FF-N02', unitId: 'src/domain/a.ts', requestHash, outcome: { kind: 'valid' }, parsedVerdict: { pass }, ...(projectId !== undefined && { projectId }),
  });
  it('the same unit path in two projects is two subjects: each agrees with itself, so the mean agreement is 1', () => {
    // Pooled (the old key) the subject would be [T, T, F, F]: P = (2*1 + 2*1) / (4*3) = 1/3.
    const rows = agreementStats({
      labels: [], prompts, labellerModel: 'gemini-x',
      judgeEntries: [entry('cell-a', 'h1', true), entry('cell-a', 'h1', true), entry('cell-b', 'h2', false), entry('cell-b', 'h2', false)],
    }).filter((r) => r.comparison === 'judge-repetition');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ n: 2, percentAgreement: 1 });
  });
  it('without a projectId the request hash (unit source) still separates the subjects', () => {
    const rows = agreementStats({
      labels: [], prompts, labellerModel: 'gemini-x',
      judgeEntries: [entry(undefined, 'h1', true), entry(undefined, 'h1', true), entry(undefined, 'h2', false), entry(undefined, 'h2', false)],
    }).filter((r) => r.comparison === 'judge-repetition');
    expect(rows[0]).toMatchObject({ n: 2, percentAgreement: 1 });
  });
});

describe('registered route, sizing estimate and token usage (ADR-021 item 6)', () => {
  const item = (population: LabelItem['population']): LabelItem => ({ itemId: population, kind: 'violation', population, projectId: 'p', stratum: 's', inclusionProbability: 1, context: '' });
  const plan: LabelPlanFile = {
    version: 1, permutationSeed: 1, budgetCalls: 10, strata: [], items: [item('P1'), item('P4'), item('P2'), item('MS')],
    sizing: 'registered', reaskReserveCalls: 2, provider: 'agy', model: 'gemini-3.1-pro-high',
  };
  it('the plan route is the default; a contradicting flag is refused', () => {
    expect(routeOf(new Map(), plan)).toEqual({ ok: true, provider: 'agy', model: 'gemini-3.1-pro-high' });
    expect(routeOf(new Map([['provider', 'agy']]), plan).ok).toBe(true);
    const bad = routeOf(new Map([['provider', 'gemini']]), plan);
    expect(!bad.ok && bad.detail).toContain(LABEL_PROVIDER_CONFLICT);
    expect(routeOf(new Map(), { })).toEqual({ ok: true, provider: 'gemini', model: '' });
  });
  it('registered sizing: 4 items x 2 + reserve 2 = 10 <= 10; one item more is refused', () => {
    expect(estimatePlan(plan)).toEqual({ exitCode: 0, line: 'estimate: 8 calls + re-ask reserve 2 <= budget 10 (registered sizes: P1 1, MS 1, P4 1, P2 1, P3 0)' });
    expect(estimatePlan({ ...plan, items: [...plan.items, item('P3')] }).exitCode).toBe(1);
  });
  it('token usage: min / median / max / mean of the recorded input tokens', () => {
    const u = tokenUsage([100, 300, 200, 400].map((i) => ({ usage: { inputTokens: i, outputTokens: 10 } })));
    expect(u).toEqual({ calls: 4, inputTokens: { min: 100, median: 250, max: 400, mean: 250 }, outputTokensTotal: 40 });
    expect(tokenUsage([])).toEqual({ calls: 0, inputTokens: null, outputTokensTotal: 0 });
  });
});
