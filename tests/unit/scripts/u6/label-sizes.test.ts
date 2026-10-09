/**
 * U6 P-U6: ADR-021 item 8 label-size corrections outside the sizing library (`label-plan.test.ts`): κ and AC1
 * intervals with the labeller validity rule (8.4), agy invocation counting (8.7), FPAT values N/A without P3 labels
 * (8.1), and the aggregate latency columns of the SO2 follow-up. Hand-computed fixtures throughout.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { LLMCallContext, LLMOptions, LLMProvider, LLMResponse } from '../../../../src/shared/interfaces/llm-provider.js';
import type { EvaluationReport, ProviderDescription } from '../../../../src/shared/types/evaluation.js';
import {
  AGREEMENT_COLUMNS, LABEL_BUDGET_STOP, LABELLER_KAPPA_FLOOR, MAX_INVOCATIONS_PER_CALL, kappaIntervals, labelItems, labellingTables, loadLabellerPrompts, pairAgreement,
} from '../../../../scripts/llm-label.js';
import type { LabelItem } from '../../../../scripts/lib/label-context.js';
import { loadSo5Codes } from '../../../../scripts/lib/so5-codes.js';
import type { So5Codes } from '../../../../scripts/lib/so5-codes.js';
import type { GenerationCell, RunRecord } from '../../../../scripts/lib/report-io.js';
import { parseCsv } from '../../../../scripts/lib/figures/draw.js';
import { AGGREGATE_LATENCY_COLUMNS, NESTED_STAGES, aggregate, labelDependentFamilies, so5Csv, symbolicFpatCounts } from '../../../../scripts/aggregate.js';
import type { AggregateInput } from '../../../../scripts/aggregate.js';
import { UNIVERSAL_CYCLE_STAGE } from '../../../../scripts/run-experiment.js';
import { presentedList } from '../u5b/label-fixture.js';
import { ROOT } from '../u5b/score-fixture.js';

const so5 = ((): So5Codes => {
  const l = loadSo5Codes(ROOT);
  if (!l.ok) throw new Error(l.detail);
  return l.codes;
})();

const pairsOf = (n: [number, number, number, number]): { a: string; b: string; w: number }[] => [
  ...Array.from({ length: n[0] }, () => ({ a: 'pass', b: 'pass', w: 1 })), ...Array.from({ length: n[1] }, () => ({ a: 'pass', b: 'fail', w: 1 })),
  ...Array.from({ length: n[2] }, () => ({ a: 'fail', b: 'pass', w: 1 })), ...Array.from({ length: n[3] }, () => ({ a: 'fail', b: 'fail', w: 1 })),
];

describe('κ and AC1 intervals and the labeller validity rule (ADR-021 item 8.4, SO3)', () => {
  it('perfect agreement on both categories: κ = AC1 = 1 and every defined resample gives 1 -> interval [1, 1]', () => {
    const s = pairAgreement('run-vs-run', 'all', pairsOf([6, 0, 0, 6]), ['pass', 'fail'], false, 0, false, { bootstrap: { seed: 6102, resamples: 500 } });
    expect(s.cohensKappa).toBe(1);
    expect(s.kappaCi).toEqual([1, 1]);
    expect(s.ac1Ci).toEqual([1, 1]);
    expect(s.taxonomyRule).toBe('as-registered');
    // Unweighted rows keep Wilson on the agreement.
    expect(s.ciMethod).toBe('wilson');
  });

  it('the 20/5/10/15 table: κ = 0.4 < 0.60 -> descriptive-only on the point estimate; the interval brackets 0.4', () => {
    const s = pairAgreement('run-vs-run', 'all', pairsOf([20, 5, 10, 15]), ['pass', 'fail'], false, 0, false, { bootstrap: { seed: 6102, resamples: 2000 } });
    expect(s.cohensKappa?.toFixed(6)).toBe('0.400000');
    expect(LABELLER_KAPPA_FLOOR).toBe(0.6);
    expect(s.taxonomyRule).toBe('descriptive-only');
    const [lo, hi] = s.kappaCi ?? [Number.NaN, Number.NaN];
    expect(lo).toBeLessThan(0.4);
    expect(hi).toBeGreaterThan(0.4);
    expect(s.ac1Ci?.[0]).toBeLessThan(s.gwetAc1 ?? 0);
    // Deterministic for the seed; the same resamples as kappaIntervals.
    expect(kappaIntervals(pairsOf([20, 5, 10, 15]), ['pass', 'fail'], { seed: 6102, resamples: 2000 })).toEqual({ kappaCi: s.kappaCi, ac1Ci: s.ac1Ci });
  });

  it('κ = 0.6 exactly is as-registered (40/10/10/40 gives po 0.8, pe 0.5); below 10 pairs or without a seed: no interval', () => {
    expect(pairAgreement('run-vs-run', 'all', pairsOf([40, 10, 10, 40]), ['pass', 'fail'], false, 0).taxonomyRule).toBe('as-registered');
    expect(pairAgreement('run-vs-run', 'all', pairsOf([3, 1, 1, 3]), ['pass', 'fail'], false, 0, false, { bootstrap: { seed: 1 } }).kappaCi).toBeNull();
    const judge = pairAgreement('judge-vs-panel', 'x', pairsOf([6, 0, 0, 6]), ['pass', 'fail'], true, 0);
    expect(judge.kappaCi).toBeNull();
    expect(judge.taxonomyRule).toBe('');
  });

  it('agreement.csv carries kappa_ci_low/high, ac1_ci_low/high and taxonomy_rule', () => {
    const s = pairAgreement('run-vs-run', 'all', pairsOf([6, 0, 0, 6]), ['pass', 'fail'], false, 0, false, { bootstrap: { seed: 6102, resamples: 100 } });
    const t = labellingTables({ agreement: [s] })['agreement.csv'];
    expect(AGREEMENT_COLUMNS.slice(-5)).toEqual(['kappa_ci_low', 'kappa_ci_high', 'ac1_ci_low', 'ac1_ci_high', 'taxonomy_rule']);
    expect(t.rows[0]?.slice(-5)).toEqual(['1.000000', '1.000000', '1.000000', '1.000000', 'as-registered']);
  });
});

/** Fails the first invocation of every prompt with a retryable CLI exit, then answers TP. */
class FlakyLabeller implements LLMProvider {
  readonly name = 'flaky';
  private readonly seen = new Set<string>();
  invocations = 0;
  describe(): ProviderDescription {
    return { provider: 'mock', model: 'mock-model' };
  }
  evaluate(prompt: string, _o: LLMOptions, _c?: LLMCallContext): Promise<DomainResult<LLMResponse>> {
    this.invocations += 1;
    if (!this.seen.has(prompt)) {
      this.seen.add(prompt);
      return Promise.resolve(DomainResult.fail([{ code: 'LLM_CLI_EXIT', message: 'exit 1' }]));
    }
    const opts = presentedList(prompt, 'Label options');
    const content = JSON.stringify({ option: opts.indexOf('TP') + 1, rootCause: null, rationale: 'r' });
    return Promise.resolve(DomainResult.ok({ content, model: 'mock-model', usage: { inputTokens: 1, outputTokens: 1 }, usedOptions: {}, ignoredOptions: [] }));
  }
}

describe('agy invocations are counted, retries included (ADR-021 item 8.7)', () => {
  const item = (id: string): LabelItem => ({
    itemId: id, kind: 'violation', population: 'P2', projectId: 'p', stratum: 'p, FF-S01', inclusionProbability: 1, key: 'k', functionId: 'FF-S01',
    context: `Function: FF-S01\nFile: src/${id}.ts`,
  });
  const loaded = loadLabellerPrompts(ROOT);
  if (!loaded.ok) throw new Error(loaded.detail);
  const prompts = loaded.prompts;

  it('2 items x 2 runs, each answer after one retry: 8 invocations counted (4 logical calls), label_budget calls = 4 per item', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'u6-invocations-'));
    try {
      const provider = new FlakyLabeller();
      const r = await labelItems([item('a'), item('b')], {
        provider, model: 'gemini-3.1-pro-high', runs: 2, mode: 'record', cassetteDir: dir, permutationSeed: 6103, budgetCalls: 300, knownSecrets: [], now: () => '2026-10-09T00:00:00.000Z',
      }, prompts);
      if (!r.ok) throw new Error(r.detail);
      expect(provider.invocations).toBe(8);
      expect(r.calls).toBe(8);
      expect(r.labels.every((l) => l.runs.every((x) => x.invocations === 2 && x.attempts === 1))).toBe(true);
      const t = labellingTables({ plan: { strata: [{ population: 'P2', stratum: 'p, FF-S01', size: 2, cap: 1 }] }, labels: r.labels })['label_budget.csv'];
      expect(t.rows[0]?.at(-1)).toBe('8');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('the budget stops before a call that could exceed it: budget 7 allows 3 calls (6 invocations), never a 4th', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'u6-invocations-'));
    try {
      expect(MAX_INVOCATIONS_PER_CALL).toBe(2);
      const provider = new FlakyLabeller();
      const r = await labelItems([item('a'), item('b')], {
        provider, model: 'gemini-3.1-pro-high', runs: 2, mode: 'record', cassetteDir: dir, permutationSeed: 6103, budgetCalls: 7, knownSecrets: [], now: () => '2026-10-09T00:00:00.000Z',
      }, prompts);
      expect(r.ok).toBe(false);
      expect(r.ok ? '' : r.code).toBe(LABEL_BUDGET_STOP);
      expect(provider.invocations).toBe(6);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('FPAT without P3 labels: label-dependent values N/A, symbolic profile rows (ADR-021 item 8.1)', () => {
  const cell = (runIndex: 0 | 1 | 2, model: string, level: GenerationCell['specLevel']): GenerationCell => ({
    requestedModelId: model, adapterId: 'a', promptTemplateId: 'p', style: 'clean-architecture', specLevel: level, taskId: 'task-management', runIndex,
    generationOutcomePath: 'g.json', generationStatus: 'ok', fileCount: 30, fileCountInRange: true, permissionDenials: 0,
  });
  const record = (runId: string, c: GenerationCell): RunRecord => ({
    runId, planId: 'e1', projectId: runId, status: 'accepted', attempt: 1, specSha: 'e'.repeat(64), cliCommit: 'f'.repeat(40), preregVersion: 4,
    frozenHashes: {}, envRecordId: 'env', startedAt: '2026-10-09T00:00:00Z', wallMs: 1, cell: c,
  });
  // Two symbolic FF-S01 violations (dependency-direction) and one FF-C04 (no-orphan-files), one judge violation
  // (not symbolic), and one failing integrity unit.
  const report = {
    evaluationMode: 'full', scoring: { verdictSource: 'ahsCombined' }, ahsCombined: 0.7, ahsDeterministic: 0.6, ahsNeuronal: 0.8, perDimensionScores: [],
    functionResults: [{ functionId: 'FF-S01', name: 'dependency-direction' }, { functionId: 'FF-C04', name: 'no-orphan-files' }],
    violations: [
      { functionId: 'FF-S01', route: 'symbolic' }, { functionId: 'FF-S01', route: 'symbolic' }, { functionId: 'FF-C04', route: 'symbolic' },
      { functionId: 'FF-N02', route: 'neuronal', unitId: 'u1' },
    ],
    neuralResults: [{ functionId: 'FF-N02', dimension: 'integrity', unitResults: [{ status: 'valid', verdict: 'fail' }] }],
  } as unknown as EvaluationReport;

  it('label-dependent families are the template families (not SEMANTIC / INTEGRITY)', () => {
    const fams = labelDependentFamilies(so5);
    expect(fams.has('FPAT-DEP-DIRECTION')).toBe(true);
    expect(fams.has('FPAT-SEMANTIC')).toBe(false);
    expect(fams.has('FPAT-INTEGRITY')).toBe(false);
    expect(fams.size).toBe(8);
    expect(Object.fromEntries(symbolicFpatCounts(report, so5))).toEqual({ 'FPAT-DEP-DIRECTION': 2, 'FPAT-COUPLING': 1 });
  });

  it('so5_grid: symbolic families empty (never 0), judge family counted; so5_patterns: labelled / judge / symbolic basis', () => {
    const r1 = record('e1-000', cell(0, 'm1', 'none'));
    const inp: AggregateInput = { planId: 'e1', records: [r1], reports: new Map([['e1-000', report]]), so5 };
    const grid = parseCsv(so5Csv(inp, 20)['so5_grid.csv'] ?? '').rows;
    expect(grid[0]).toMatchObject({ fpat_dep_direction: '', fpat_coupling: '', fpat_cycle: '', fpat_integrity: '1.000000', fpat_semantic: '0.000000' });
    const patterns = parseCsv(so5Csv(inp, 20)['so5_patterns.csv'] ?? '').rows.map((p) => [p.code, p.count, p.weighted_count, p.basis]);
    expect(patterns).toEqual([
      ['FPAT-INTEGRITY', '1', '1.000000', 'judge'],
      ['FPAT-DEP-DIRECTION', '2', '', 'symbolic'],
      ['FPAT-COUPLING', '1', '', 'symbolic'],
    ]);
    // With a P3 label the labelled family is a number again: 1 TP of FF-S01 at p = 0.5 weighs 2.
    const labelled = parseCsv(so5Csv({ ...inp, labels: [{ runId: 'e1-000', functionId: 'FF-S01', label: 'TP', inclusionProbability: 0.5 }] }, 20)['so5_grid.csv'] ?? '').rows;
    expect(labelled[0]).toMatchObject({ fpat_dep_direction: '2.000000', fpat_coupling: '0.000000' });
  });
});

describe('aggregate latency.csv after the SO2 follow-up (ADR-021 item 8)', () => {
  it('the nested cycle-metric row names its parent stage; total_ms is timings.totalMs; columns renamed', () => {
    expect(Object.keys(NESTED_STAGES)).toEqual([UNIVERSAL_CYCLE_STAGE]);
    expect(AGGREGATE_LATENCY_COLUMNS).toEqual(['run_id', 'project_id', 'file_count', 'total_ms', 'stage', 'stage_ms', 'within_stage', 'cycle_queries_sum_ms', 'gate_result_unregistered']);
    // A committed symbolic-only fixture report with the stage timings replaced (top-level 400 + 500 = 900 ms).
    const fixture = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/u5b/reports/variant-a-structural.json'), 'utf8')) as Record<string, unknown>;
    const r = {
      ...fixture, durationMs: 5,
      timings: { totalMs: 900, stages: [{ name: 'extract', durationMs: 400 }, { name: UNIVERSAL_CYCLE_STAGE, durationMs: 50 }, { name: 'compute-scores', durationMs: 500 }] },
    } as unknown as EvaluationReport;
    const rec: RunRecord = {
      runId: 'r1', planId: 'latency-gate', projectId: 'p', status: 'accepted', attempt: 1, specSha: 'e'.repeat(64), cliCommit: 'f'.repeat(40), preregVersion: 4,
      frozenHashes: {}, envRecordId: 'env', startedAt: '2026-10-09T00:00:00Z', wallMs: 1,
    };
    const rows = parseCsv(aggregate({ planId: 'latency-gate', records: [rec], reports: new Map([['r1', r]]), so5 }).get('latency.csv') ?? '').rows;
    expect(rows.map((x) => [x.stage, x.within_stage, x.total_ms])).toEqual([['extract', '', '900'], [UNIVERSAL_CYCLE_STAGE, 'compute-scores', '900'], ['compute-scores', '', '900']]);
  });
});
