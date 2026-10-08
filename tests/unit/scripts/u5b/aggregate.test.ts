/**
 * U5b Step 16: aggregation, SO5 statistics, figures and the fixture harness run with the fake runner
 * (FR-36; BR-U5b-30, 54, 56, 61..65, 72, 78; exit criterion 3). The Neo4j-backed end-to-end run is the Step 16
 * acceptance run under the lane lock (Done note); this suite replays the five stored fixture reports.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CYPHER_TEMPLATES, listTemplatesByTag } from '../../../../src/fitness-compiler/cypher-templates.js';
import type { ProcessRunner } from '../../../../src/shared/interfaces/process-runner.js';
import type { EvaluationReport } from '../../../../src/shared/types/evaluation.js';
import { ROOT_CAUSE_CODES } from '../../../../scripts/lib/matching-rule.js';
import type { GenerationCell, RunRecord } from '../../../../scripts/lib/report-io.js';
import { FPAT_FAMILIES, GEN_CODES, loadSo5Codes } from '../../../../scripts/lib/so5-codes.js';
import type { So5Codes } from '../../../../scripts/lib/so5-codes.js';
import { createRng, permuteWithinBlocks } from '../../../../scripts/lib/stats.js';
import { parseCsv } from '../../../../scripts/lib/figures/draw.js';
import {
  aggregate, CSV_FILES, fpatCounts, loadRunDir, primaryOutcome, so5Csv, so5Tests,
} from '../../../../scripts/aggregate.js';
import type { AggregateInput, GoldenScoreJson, So5Cell } from '../../../../scripts/aggregate.js';
import { runPlan } from '../../../../scripts/run-experiment.js';
import type { ExperimentPlan } from '../../../../scripts/run-experiment.js';
import { ROOT } from './score-fixture.js';

const so5 = ((): So5Codes => {
  const l = loadSo5Codes(ROOT);
  if (!l.ok) throw new Error(l.detail);
  return l.codes;
})();
const FIXTURES = ['correct-reference', 'variant-a-structural', 'variant-b-pattern', 'variant-c-everything', 'variant-d-subtle'];
const INJECTED = ['function-failed', 'function-truncated'];
const read = (p: string): string => readFileSync(p, 'utf8');

const PLAN: ExperimentPlan = {
  id: 'fixtures', experiment: 'fixtures', mode: 'symbolic-only', seeds: { sampling: 11, bootstrap: 12, permutation: 13 },
  cassetteDir: 'experiments/fixtures/cassettes', outDir: 'results/fixtures',
  projects: [
    ...FIXTURES.map((id) => ({ projectId: id, path: `fixtures/${id}`, specPath: 'specs/clean-arch.yaml' })),
    ...INJECTED.map((id) => ({ projectId: `injected-${id}`, path: `tests/fixtures/u5b/injected/${id}`, specPath: 'specs/clean-arch.yaml' })),
  ],
};

/** Replays the stored fixture reports and the two injected-failure reports by `--project`. */
const replay: ProcessRunner = {
  run: (_c, args) => {
    const project = args[args.indexOf('--project') + 1] ?? '';
    const file = project.startsWith('fixtures/')
      ? join(ROOT, 'tests/fixtures/u5b/reports', `${project.slice('fixtures/'.length)}.json`)
      : join(ROOT, `${project}.json`);
    return Promise.resolve({ success: true, data: { exitCode: project.startsWith('fixtures/correct') ? 0 : 1, stdout: read(file), stderr: '', timedOut: false, durationMs: 3 } });
  },
};

let runDir = '';
beforeAll(async () => {
  runDir = mkdtempSync(join(tmpdir(), 'u5b-agg-'));
  let t = Date.parse('2026-10-08T12:00:00Z');
  const r = await runPlan(PLAN, 'experiments/fixtures/plan.json', ROOT, {
    runner: replay, cli: { command: 'replay', args: [] }, parentEnv: { PATH: '/bin' }, now: () => new Date((t += 7)), cliCommit: 'c'.repeat(40),
    recordEnvironment: (id) => Promise.resolve({ id: `env-${id}`, record: { id: `env-${id}` } }),
    gate: () => ({ ok: true, prereg: { version: 1, registeredAt: '2026-10-01T00:00:00Z', matchingRuleVersion: '1.0.0', artefacts: [], labellingBudgetCalls: 0, e1Grid: { models: 3, specLevels: 3, tasks: 2, runs: 3 } }, frozenHashes: { 'experiments/fixtures/plan.json': 'd'.repeat(64) } }),
    outDir: runDir,
  });
  if (!r.ok) throw new Error(r.detail);
});
afterAll(() => { rmSync(runDir, { recursive: true, force: true }); });

function input(over: Partial<AggregateInput> = {}): AggregateInput {
  const { records, reports } = loadRunDir(runDir);
  const score = JSON.parse(read(join(ROOT, 'tests/fixtures/u5b/hand-computed/expected.canonical.json'))) as GoldenScoreJson;
  return { planId: 'fixtures', plan: PLAN, records, reports, so5, score, resamples: 200, ...over };
}

describe('fixture harness run → CSV set (exit criterion 3; BR-U5b-48, 63)', () => {
  it('writes the full CSV set; runs.csv lists the two injected failures as rejected', () => {
    const out = aggregate(input());
    expect([...out.keys()]).toEqual([...CSV_FILES]);
    for (const [name, text] of out) expect({ name, header: text.split('\n')[0]?.length ?? 0 }).toEqual({ name, header: expect.any(Number) as number });
    const runs = parseCsv(out.get('runs.csv') ?? '').rows;
    expect(runs).toHaveLength(7);
    expect(runs.filter((r) => r.status === 'rejected').map((r) => [r.project_id, r.reason_code])).toEqual([
      ['injected-function-failed', 'function-failed'], ['injected-function-truncated', 'function-truncated'],
    ]);
    expect(parseCsv(out.get('ahs_by_project.csv') ?? '').rows.map((r) => [r.project_id, r.ahs_deterministic, r.verdict])).toEqual([
      ['correct-reference', '0.958000', 'pass'], ['variant-a-structural', '0.442000', 'hard-block'], ['variant-b-pattern', '0.575000', 'soft-block'],
      ['variant-c-everything', '0.391000', 'hard-block'], ['variant-d-subtle', '0.558000', 'soft-block'],
    ]);
    const overall = parseCsv(out.get('prf_overall.csv') ?? '').rows;
    expect(overall.find((r) => r.split === 'dev' && r.base_kind === 'all' && r.coverage === 'all')).toMatchObject({ tp: '3', fn: '0', recall: '1.000000', ci_method: '', recall_overall: '1.000000' });
    expect(parseCsv(out.get('prf_by_tag.csv') ?? '').rows.some((r) => r.tag === 'structural' && r.sub_row === 'data-flow')).toBe(true);
    expect(parseCsv(out.get('denominators.csv') ?? '').rows.every((r) => r.identity_ok === 'true')).toBe(true);
    expect(parseCsv(out.get('latency.csv') ?? '').rows.every((r) => r.gate_result === 'pass')).toBe(true);
    expect(parseCsv(out.get('twins.csv') ?? '').rows.at(-1)).toMatchObject({ seed_id: 'specificity', status: '1/1', undeclared_new: '1.000000' });
  });

  it('two aggregate runs are byte-identical', () => {
    const a = aggregate(input());
    const b = aggregate(input());
    for (const f of CSV_FILES) expect({ f, same: a.get(f) === b.get(f) }).toEqual({ f, same: true });
  });

  it('function_sensitivity.csv carries the BR-U5b-78 columns', () => {
    const out = aggregate(input({ sensitivity: [{ probeId: 'SP-S01', functionId: 'FF-S01', pass: true, lineConfirmed: true, excludedAfterFail: false }, { probeId: 'SP-C01', functionId: 'FF-C01', pass: false, lineConfirmed: null, excludedAfterFail: true, fixAttemptRef: 'fix-1' }] }));
    const csv = out.get('function_sensitivity.csv') ?? '';
    expect(csv.split('\n')[0]).toBe('plan_id,probe_id,function_id,pass,line_confirmed,excluded_after_fail,fix_attempt_ref');
    expect(parseCsv(csv).rows[1]).toEqual({ plan_id: 'fixtures', probe_id: 'SP-C01', function_id: 'FF-C01', pass: 'false', line_confirmed: '', excluded_after_fail: 'true', fix_attempt_ref: 'fix-1' });
  });

  it('the same CSV renders to byte-identical SVG through the CLI (tsx / ESM route); one SVG per figure spec', () => {
    const outs = [mkdtempSync(join(tmpdir(), 'u5b-fig-a-')), mkdtempSync(join(tmpdir(), 'u5b-fig-b-'))];
    try {
      for (const o of outs) {
        execFileSync(join(ROOT, 'node_modules/.bin/tsx'), [join(ROOT, 'scripts/aggregate-cli.ts'), '--runs', runDir, '--out', o, '--resamples', '50'], { cwd: ROOT, stdio: 'pipe' });
      }
      const svgs = outs.map((o) => readdirSync(o).filter((f) => f.endsWith('.svg')));
      expect(svgs[0]).toEqual(['ahs-by-project.svg']);
      expect(svgs[1]).toEqual(['ahs-by-project.svg']);
      const [a, b] = outs.map((o) => readFileSync(join(o, 'ahs-by-project.svg')));
      expect(a?.equals(b ?? Buffer.alloc(0))).toBe(true);
      expect(a?.toString('utf8').startsWith('<svg')).toBe(true);
      expect(readdirSync(outs[0] ?? '').filter((f) => f.endsWith('.csv')).sort()).toEqual([...CSV_FILES].sort());
    } finally {
      for (const o of outs) rmSync(o, { recursive: true, force: true });
    }
  }, 120_000);
});

// ---------------------------------------------------------------------------------------------
// SO5

const fakeReport = (ahs: number, extra: Record<string, unknown> = {}): EvaluationReport => ({
  evaluationMode: 'full', scoring: { verdictSource: 'ahsCombined' }, ahsCombined: ahs, ahsDeterministic: 0.5, ahsNeuronal: 0.5,
  perDimensionScores: [], functionResults: [], neuralResults: [], ...extra,
}) as unknown as EvaluationReport;

const cellOf = (model: string, specLevel: GenerationCell['specLevel'], taskId: string, runIndex: 0 | 1 | 2, over: Partial<GenerationCell> = {}): GenerationCell => ({
  requestedModelId: model, adapterId: 'claude-code-cli', promptTemplateId: `${specLevel}/${taskId}`, style: 'clean-architecture', specLevel, taskId, runIndex,
  generationOutcomePath: `gen/${model}/${taskId}/${specLevel}/run-${String(runIndex)}/generation.json`, generationStatus: 'ok', fileCount: 30, fileCountInRange: true, permissionDenials: 0, ...over,
});

function synthetic(): { cells: So5Cell[]; input: AggregateInput } {
  const records: RunRecord[] = [];
  const reports = new Map<string, EvaluationReport>();
  const cells: So5Cell[] = [];
  const models = ['m1', 'm2', 'm3'];
  const levels: GenerationCell['specLevel'][] = ['none', 'minimal-prose', 'full-aac'];
  let i = 0;
  for (const [mi, model] of models.entries()) {
    for (const level of levels) {
      for (const task of ['task-management', 'order-fulfilment']) {
        for (const run of [0, 1, 2] as const) {
          const runId = `e1-${String(i++).padStart(3, '0')}`;
          const notRun = model === 'm3' && level === 'none' && task === 'order-fulfilment' && run === 2;
          const ahs = 0.5 + 0.2 * mi + (run - 1) * 0.02 + (task === 'order-fulfilment' ? 0.05 : 0);
          const cell = cellOf(model, level, task, run, notRun ? { generationStatus: 'failed-agent', failureReason: 'timeout' } : {});
          const record: RunRecord = {
            runId, planId: 'e1', projectId: runId, status: notRun ? 'not-run' : 'accepted', ...(notRun && { reasonCode: 'generation-failed' as const }), attempt: 1,
            specSha: 'e'.repeat(64), cliCommit: 'f'.repeat(40), preregVersion: 1, frozenHashes: {}, envRecordId: 'env-x', startedAt: '2026-10-08T00:00:00Z', wallMs: 1, cell,
          };
          records.push(record);
          if (!notRun) reports.set(runId, fakeReport(ahs));
          cells.push({ record, ...(notRun ? {} : { report: fakeReport(ahs) }), valid: !notRun, model, specLevel: level, taskId: task, runIndex: run, fpat: new Map() });
        }
      }
    }
  }
  return { cells, input: { planId: 'e1', records, reports, so5, resamples: 999, plan: { ...PLAN, id: 'e1', experiment: 'E1', seeds: { sampling: 1, bootstrap: 2, permutation: 3 } } } };
}

describe('SO5 analysis (BR-U5b-54, 64, 65)', () => {
  it('planted model effect: model p < 0.05 after Holm, spec level p >= 0.05; the primary family is the verdictSource field', () => {
    const { cells } = synthetic();
    const rows = so5Tests(cells, { bootstrap: 2, permutation: 3 }, 999);
    const primary = rows.filter((r) => r[4] === 'primary:ahsCombined' && r[1] !== '');
    expect(primary.map((r) => r[0])).toEqual(['model', 'spec-level', 'model×spec-level']);
    expect(Number(primary[0]?.[3])).toBeLessThan(0.05);
    expect(Number(primary[1]?.[3])).toBeGreaterThanOrEqual(0.05);
    expect(primary.every((r) => r[9] === 'false')).toBe(true);
    const pair = rows.find((r) => r[0] === 'model:m1-m3' && r[4] === 'primary:ahsCombined');
    expect(Number(pair?.[5])).toBeCloseTo(-0.4, 2);
    expect(Number(pair?.[8])).toBe(-1);
    expect(rows.filter((r) => r[4] !== 'primary:ahsCombined').every((r) => r[9] === 'true')).toBe(true);
    for (const c of cells) if (c.report !== undefined) expect(primaryOutcome(c.report)).toEqual({ field: 'ahsCombined', value: (c.report as unknown as { ahsCombined: number }).ahsCombined });
  });

  it('permutations never move an observation across tasks', () => {
    const blocks = ['t1', 't2', 't1', 't2', 't1', 't2'];
    const labels = ['a1', 'b1', 'a2', 'b2', 'a3', 'b3'];
    const rng = createRng(7);
    for (let k = 0; k < 50; k++) {
      const p = permuteWithinBlocks(labels, blocks, rng);
      p.forEach((l, i) => { expect(l.charAt(0)).toBe(blocks[i] === 't1' ? 'a' : 'b'); });
    }
  });

  it('so5_grid.csv has one row per E1 cell (54) incl. not-run with its GEN code and flags', () => {
    const { input: inp } = synthetic();
    const grid = parseCsv(so5Csv(inp, 50)['so5_grid.csv'] ?? '').rows;
    expect(grid).toHaveLength(54);
    const nr = grid.filter((r) => r.status === 'not-run');
    expect(nr).toHaveLength(1);
    expect(nr[0]).toMatchObject({ gen_code: 'GEN-TIMEOUT', ahs_combined: '', requested_model_id: 'm3', file_count_in_range: 'true' });
    expect(grid.filter((r) => r.status === 'accepted').every((r) => r.gen_code === '' && r.verdict_source === 'ahsCombined')).toBe(true);
    expect(so5Csv(inp, 50)['so5_tests.csv']).toBe(so5Csv(inp, 50)['so5_tests.csv']);
    const patterns = parseCsv(so5Csv(inp, 50)['so5_patterns.csv'] ?? '').rows;
    expect(patterns).toEqual([{ run_id: expect.any(String) as string, code: 'GEN-TIMEOUT', count: '1', weighted_count: '1.000000' }]);
  });

  it('FPAT counts: TP weight 1, unseeded-TP weight 1/p (0.4 → 2.5), failing judge unit by dimension, FP not counted', () => {
    const report = {
      functionResults: [{ functionId: 'FF-S01', name: 'dependency-direction' }, { functionId: 'FF-C04', name: 'no-orphan-files' }],
      neuralResults: [{ functionId: 'FF-N02', dimension: 'integrity', unitResults: [{ status: 'valid', verdict: 'fail' }, { status: 'valid', verdict: 'pass' }, { status: 'invalid', verdict: 'fail' }] }],
    } as unknown as EvaluationReport;
    const counts = fpatCounts('r1', report, [
      { runId: 'r1', functionId: 'FF-S01', label: 'TP' },
      { runId: 'r1', functionId: 'FF-C04', label: 'unseeded-TP', inclusionProbability: 0.4 },
      { runId: 'r1', functionId: 'FF-S01', label: 'FP' },
      { runId: 'r2', functionId: 'FF-S01', label: 'TP' },
    ], so5);
    expect(Object.fromEntries(counts)).toEqual({
      'FPAT-DEP-DIRECTION': { count: 1, weighted: 1 }, 'FPAT-COUPLING': { count: 1, weighted: 2.5 }, 'FPAT-INTEGRITY': { count: 1, weighted: 1 },
    });
  });

  it('every compiled template id maps to exactly one FPAT family of the ten; judge dimensions map; RC / FPAT / GEN are disjoint', () => {
    const ids = [...new Set((['structural', 'topological', 'pattern-proxy'] as const).flatMap((t) => listTemplatesByTag(t)))].sort();
    expect(ids).toEqual([...CYPHER_TEMPLATES.keys()].sort());
    expect(ids).toHaveLength(25);
    expect(Object.keys(so5.functionFamilies).sort()).toEqual(ids);
    for (const fam of Object.values(so5.functionFamilies)) expect(FPAT_FAMILIES).toContain(fam);
    expect(so5.judgeDimensions).toEqual({ integrity: 'FPAT-INTEGRITY', semantic: 'FPAT-SEMANTIC' });
    const rc = new Set<string>(ROOT_CAUSE_CODES);
    const fpat = new Set<string>(FPAT_FAMILIES);
    const gen = new Set<string>(GEN_CODES);
    for (const c of fpat) expect(rc.has(c) || gen.has(c)).toBe(false);
    for (const c of gen) expect(rc.has(c)).toBe(false);
    expect(rc.size + fpat.size + gen.size).toBe(new Set([...rc, ...fpat, ...gen]).size);
  });
});
