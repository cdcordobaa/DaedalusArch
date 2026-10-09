/**
 * U6 lane SO5-agg (ADR-021 SO5-07, X-3, THR-4): the size, density and latency columns of `so5_grid.csv`, the
 * permutation strata of the SO5 main effects, and the input of the exploratory open coding. Every expected value is
 * hand-computed in the comment above its test.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { EvaluationReport } from '../../../../src/shared/types/evaluation.js';
import type { GenerationCell, RunRecord } from '../../../../scripts/lib/report-io.js';
import { loadSo5Codes } from '../../../../scripts/lib/so5-codes.js';
import type { So5Codes } from '../../../../scripts/lib/so5-codes.js';
import {
  generationEffortOf, nonBlankLines, readGenerationEffort, SO5_SIZE_COLUMNS, so5SizeValues, treeLoc, violationsPerKloc,
} from '../../../../scripts/lib/so5-size.js';
import {
  conditionTerms, isCodedLabel, OPEN_CODING_SEED, openCodingInput, redact,
} from '../../../../scripts/lib/so5-open-coding.js';
import type { CodingLabelView } from '../../../../scripts/lib/so5-open-coding.js';
import { permutationFactorTest } from '../../../../scripts/lib/stats.js';
import { parseCsv } from '../../../../scripts/lib/figures/draw.js';
import { directionalCheck, so5Csv, so5Stratum, so5Tests } from '../../../../scripts/aggregate.js';
import type { AggregateInput, So5Cell } from '../../../../scripts/aggregate.js';
import { main as openCodingMain } from '../../../../scripts/so5-open-coding.js';
import { ROOT } from '../u5b/score-fixture.js';

const so5 = ((): So5Codes => {
  const l = loadSo5Codes(ROOT);
  if (!l.ok) throw new Error(l.detail);
  return l.codes;
})();

const violation = (deterministic: boolean, functionId = 'FF-1'): unknown => ({ functionId, deterministic, route: deterministic ? 'symbolic' : 'neuronal' });

const report = (ahs: number, over: Record<string, unknown> = {}): EvaluationReport => ({
  evaluationMode: 'full', scoring: { verdictSource: 'ahsCombined' }, ahsCombined: ahs, ahsDeterministic: 0.5, ahsNeuronal: 0.5,
  perDimensionScores: [], functionResults: [], neuralResults: [], violations: [], ...over,
}) as unknown as EvaluationReport;

const cellOf = (model: string, specLevel: GenerationCell['specLevel'], taskId: string, runIndex: 0 | 1 | 2, over: Partial<GenerationCell> = {}): GenerationCell => ({
  requestedModelId: model, adapterId: 'claude-code-cli', promptTemplateId: `${specLevel}/${taskId}`, style: 'clean-architecture', specLevel, taskId, runIndex,
  generationOutcomePath: `gen/${model}/${taskId}/${specLevel}/run-${String(runIndex)}/generation.json`, generationStatus: 'ok', fileCount: 30, fileCountInRange: true,
  permissionDenials: 0, ...over,
});

const recordOf = (runId: string, cell: GenerationCell, status: RunRecord['status'] = 'accepted'): RunRecord => ({
  runId, planId: 'e1', projectId: `${cell.requestedModelId}/${cell.taskId}/${cell.specLevel}/run-${String(cell.runIndex)}`, status,
  ...(status === 'not-run' && { reasonCode: 'generation-failed' as const }), attempt: 1, specSha: 'e'.repeat(64), cliCommit: 'f'.repeat(40), preregVersion: 1,
  frozenHashes: {}, envRecordId: 'env', startedAt: '2026-10-09T00:00:00Z', wallMs: 1, cell,
});

const so5Cell = (model: string, specLevel: GenerationCell['specLevel'], taskId: string, runIndex: 0 | 1 | 2, r: EvaluationReport | undefined): So5Cell => {
  const cell = cellOf(model, specLevel, taskId, runIndex);
  return {
    record: recordOf(`${model}-${specLevel}-${taskId}-${String(runIndex)}`, cell, r === undefined ? 'not-run' : 'accepted'),
    ...(r !== undefined && { report: r }), valid: r !== undefined, model, specLevel, taskId, runIndex, fpat: new Map(),
  };
};

// ---------------------------------------------------------------------------------------------
// SO5-07, X-3: LOC, density, latency

describe('LOC, violation density and latency (ADR-021 SO5-07, X-3)', () => {
  it('nonBlankLines counts lines with a non-whitespace character; comments count, CRLF and blank lines do not', () => {
    // "a" | "" | "  " | "b\r" | "// c" | "" → a, b, // c = 3
    expect(nonBlankLines('a\n\n  \nb\r\n// c\n')).toBe(3);
    expect(nonBlankLines('')).toBe(0);
    expect(nonBlankLines('x')).toBe(1);
  });

  it('treeLoc sums src/**/*.ts only (the fileCount set): .js, node_modules and files outside src are skipped', () => {
    // src/a.ts 3 non-blank, src/sub/b.ts 2, src/c.js (2) no, src/node_modules/x.ts (1) no, root.ts (1) no → 5
    const dir = mkdtempSync(join(tmpdir(), 'so5-loc-'));
    try {
      mkdirSync(join(dir, 'src/sub'), { recursive: true });
      mkdirSync(join(dir, 'src/node_modules'), { recursive: true });
      writeFileSync(join(dir, 'src/a.ts'), 'import x from "y";\n\nexport const a = 1;\n// end\n');
      writeFileSync(join(dir, 'src/sub/b.ts'), 'export class B {\n}\n\n');
      writeFileSync(join(dir, 'src/c.js'), 'a\nb\n');
      writeFileSync(join(dir, 'src/node_modules/x.ts'), 'x\n');
      writeFileSync(join(dir, 'root.ts'), 'x\n');
      expect(treeLoc(dir)).toBe(5);
      expect(treeLoc(join(dir, 'nothing-here'))).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('violationsPerKloc = violations × 1000 / LOC; undefined without LOC or a count', () => {
    expect(violationsPerKloc(3, 1500)).toBe(2);
    expect(violationsPerKloc(0, 250)).toBe(0);
    expect(violationsPerKloc(2, 0)).toBeUndefined();
    expect(violationsPerKloc(2, undefined)).toBeUndefined();
    expect(violationsPerKloc(undefined, 100)).toBeUndefined();
  });

  it('generation effort: duration from generation.json, turns and cost from the envelope; invalid values are dropped', () => {
    expect(generationEffortOf({ durationMs: 159340.5 }, { num_turns: 43, total_cost_usd: 0.6668696, duration_ms: 158326 }))
      .toEqual({ generationDurationMs: 159340.5, numTurns: 43, totalCostUsd: 0.6668696 });
    expect(generationEffortOf({ durationMs: 10 }, undefined)).toEqual({ generationDurationMs: 10 });
    expect(generationEffortOf({ durationMs: -1 }, { num_turns: 2.5, total_cost_usd: 'x' })).toEqual({});
    const dir = mkdtempSync(join(tmpdir(), 'so5-env-'));
    try {
      writeFileSync(join(dir, 'env.json'), '{not json');
      expect(readGenerationEffort(dir, { durationMs: 7, envelopePath: 'env.json' })).toEqual({ generationDurationMs: 7 });
      writeFileSync(join(dir, 'envelope.json'), JSON.stringify({ num_turns: 4 }));
      expect(readGenerationEffort(dir, { durationMs: 7 })).toEqual({ generationDurationMs: 7, numTurns: 4 });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('so5SizeValues: deterministic and total densities on LOC, instrument latency from timings.totalMs', () => {
    // loc 2000; violations det, det, judge → det 2, total 3; per KLOC 2·1000/2000 = 1, 3·1000/2000 = 1.5
    const r = report(0.7, { violations: [violation(true), violation(true), violation(false)], timings: { stages: [], totalMs: 1234 } });
    expect(so5SizeValues({ loc: 2000, generationDurationMs: 5000, numTurns: 9, totalCostUsd: 0.25 }, r)).toEqual({
      loc: 2000, violationsDeterministic: 2, violationsTotal: 3, violationsPerKloc: 1, violationsTotalPerKloc: 1.5,
      generationMs: 5000, generationTurns: 9, generationCostUsd: 0.25, evalTotalMs: 1234,
    });
    // a not-run cell keeps LOC and effort, nothing else
    expect(so5SizeValues({ loc: 40, generationDurationMs: 9 }, undefined)).toEqual({ loc: 40, generationMs: 9 });
  });

  it('so5_grid.csv appends the size columns after gen_code; a not-run cell has LOC and effort but no density', () => {
    // valid: loc 500, 1 det + 1 judge violation → 2.000000 and 4.000000 per KLOC; eval 321 ms; generation 1500.25 ms
    // not-run: loc 120, generation 800 ms, empty counts and densities
    const ok = recordOf('e1-000', cellOf('m1', 'none', 'task-management', 0, { loc: 500, generationDurationMs: 1500.25, numTurns: 12, totalCostUsd: 0.5 }));
    const nr = recordOf('e1-001', cellOf('m2', 'none', 'task-management', 0, { loc: 120, generationDurationMs: 800, generationStatus: 'failed-typecheck', failureReason: 'typecheck' }), 'not-run');
    const input: AggregateInput = {
      planId: 'e1', records: [ok, nr], so5,
      reports: new Map([['e1-000', report(0.8, { violations: [violation(true), violation(false)], timings: { stages: [], totalMs: 321 } })]]),
    };
    const text = so5Csv(input, 20)['so5_grid.csv'] ?? '';
    expect(text.split('\n')[0]?.endsWith(`gen_code,${SO5_SIZE_COLUMNS.join(',')}`)).toBe(true);
    const rows = parseCsv(text).rows;
    expect(rows[0]).toMatchObject({
      loc: '500', violations_deterministic: '1', violations_total: '2', violations_per_kloc: '2.000000', violations_total_per_kloc: '4.000000',
      generation_ms: '1500.250000', generation_turns: '12', generation_cost_usd: '0.500000', eval_total_ms: '321',
    });
    expect(rows[1]).toMatchObject({
      gen_code: 'GEN-TYPECHECK', loc: '120', violations_deterministic: '', violations_per_kloc: '', generation_ms: '800', eval_total_ms: '',
    });
  });

  it('violations per KLOC is an exploratory secondary family in so5_tests.csv when cells carry LOC', () => {
    const cells: So5Cell[] = [];
    for (const [mi, m] of ['m1', 'm2'].entries()) {
      for (const level of ['none', 'full-aac'] as const) {
        for (const run of [0, 1, 2] as const) {
          const c = so5Cell(m, level, 'task-management', run, report(0.5 + mi * 0.1, { violations: Array.from({ length: mi + run }, () => violation(true)) }));
          const base = c.record.cell;
          if (base === undefined) throw new Error('cell');
          cells.push({ ...c, record: { ...c.record, cell: { ...base, loc: 1000 } } });
        }
      }
    }
    const rows = so5Tests(cells, { bootstrap: 1, permutation: 2 }, 99).filter((r) => r[4] === 'secondary:violations_per_kloc');
    expect(rows.filter((r) => r[1] !== '').map((r) => [r[0], r[9]])).toEqual([['model', 'true'], ['spec-level', 'true'], ['model×spec-level', 'true']]);
    // model m1 - m2 mean difference: m1 mean (0+1+2)/3 = 1, m2 mean (1+2+3)/3 = 2 → −1 per KLOC
    expect(rows.find((r) => r[0] === 'model:m1-m2')?.[5]).toBe('-1.000000');
  });
});

// ---------------------------------------------------------------------------------------------
// THR-4: permutation strata

describe('SO5 permutation strata (ADR-021 THR-4)', () => {
  // One task; the outcome depends on the spec level only (none → 0, full-aac → 1); the valid cells are unbalanced:
  // (m1, none) ×3, (m1, full-aac) ×1, (m2, none) ×1, (m2, full-aac) ×3. Model means 1/4 and 3/4, so the observed
  // between-model SS is 8 · (1/4)² = 0.5.
  // Within task only: the number k of 1s among m1's 4 labels is hypergeometric (8, 4, 4); SS = 8 · (k/4 − 1/2)² ≥ 0.5
  // unless k = 2, so p ≈ 1 − C(4,2)² / C(8,4) = 34/70 ≈ 0.486.
  // Within (task, spec level): every stratum's values are constant, so every permutation keeps SS = 0.5 and p = 1.
  const confounded = (): So5Cell[] => {
    const out: So5Cell[] = [];
    const add = (m: string, level: 'none' | 'full-aac', n: number): void => {
      for (let i = 0; i < n; i++) out.push(so5Cell(m, level, 't', i as 0 | 1 | 2, report(level === 'none' ? 0 : 1, { ahsDeterministic: 0.5, ahsNeuronal: level === 'none' ? 0.5 : 1.5 })));
    };
    add('m1', 'none', 3); add('m1', 'full-aac', 1); add('m2', 'none', 1); add('m2', 'full-aac', 3);
    return out;
  };

  it('so5Stratum keys (task, other level)', () => {
    expect(so5Stratum('t', 'none')).toBe('["t","none"]');
    expect(so5Stratum('t', 'none')).not.toBe(so5Stratum('t', 'full-aac'));
  });

  it('a model "effect" carried by an unbalanced spec level gets p = 1 under the strata (≈ 0.486 within task only)', () => {
    const cells = confounded();
    const model = so5Tests(cells, { bootstrap: 1, permutation: 5 }, 999).find((r) => r[4] === 'primary:ahsCombined' && r[0] === 'model');
    expect(model?.[1]).toBe('0.500000');
    expect(model?.[2]).toBe('1.000000');
    const withinTask = permutationFactorTest(cells.map((c) => ({ block: c.taskId, level: c.model, value: c.report?.ahsCombined ?? 0 })), { seed: 5, resamples: 4999 });
    expect(withinTask.p).toBeGreaterThan(0.43);
    expect(withinTask.p).toBeLessThan(0.54);
  });

  it('a real model effect stays detectable under the strata', () => {
    // 2 models × 2 levels × 3 runs, m1 → 0, m2 → 1 everywhere. Within each (task, level) stratum of 6 the maximal SS
    // needs the 3 ones on one model (2/20), and both strata must agree in direction: p ≈ 2 / 400 = 0.005.
    const cells: So5Cell[] = [];
    for (const m of ['m1', 'm2']) for (const level of ['none', 'full-aac'] as const) for (const run of [0, 1, 2] as const) cells.push(so5Cell(m, level, 't', run, report(m === 'm1' ? 0 : 1)));
    const model = so5Tests(cells, { bootstrap: 1, permutation: 5 }, 1999).find((r) => r[4] === 'primary:ahsCombined' && r[0] === 'model');
    expect(Number(model?.[2])).toBeLessThan(0.02);
  });

  it('the directional check permutes model labels within (task, spec level): a spec-level-only d gives p = 1', () => {
    // d = ahsNeuronal − ahsDeterministic = 0 (none) or 1 (full-aac); judge m2 has 3 of 4 full-aac cells. Observed
    // statistic 3/4 − 1/4 = 0.5, constant under the strata → p = 1.
    const row = directionalCheck(confounded(), 'm2', 5, 999);
    expect(row?.[1]).toBe('0.500000');
    expect(row?.[2]).toBe('1.000000');
  });
});

// ---------------------------------------------------------------------------------------------
// SO5-07: exploratory open coding input

describe('open-coding input (ADR-021 SO5-07)', () => {
  const cellA = cellOf('m1', 'full-aac', 'task-management', 0);
  const cellB = cellOf('m2', 'none', 'order-fulfilment', 1);
  const records = [recordOf('e1-000', cellA), recordOf('e1-001', cellB)];
  const reports = new Map<string, EvaluationReport>([
    ['e1-000', report(0.6, { functionResults: [{ functionId: 'FF-S01', name: 'dependency-direction' }] })],
    ['e1-001', report(0.6, { neuralResults: [{ functionId: 'FF-N01', dimension: 'semantic', unitResults: [] }] })],
  ]);
  const lbl = (over: Partial<CodingLabelView>): CodingLabelView => ({
    itemId: 'x', population: 'P3', kind: 'violation', projectId: 'p', label: 'TP', inclusionProbability: 1, functionId: 'FF-S01', runs: [{ rationale: '' }, { rationale: '' }], ...over,
  });
  const labels: CodingLabelView[] = [
    lbl({ itemId: 'i-01', runId: 'e1-000', inclusionProbability: 0.5, runs: [{ rationale: ' In m1 the full-aac task-management domain imports express. ' }, { rationale: 'none of the ports in e1-000 are used' }] }),
    lbl({ itemId: 'i-02', runId: 'e1-000', label: 'FP' }),
    lbl({ itemId: 'i-03', runId: 'e1-000', label: 'uncertain' }),
    lbl({ itemId: 'i-04', population: 'P4', kind: 'judge-unit', runId: 'e1-001', label: 'fail', functionId: 'FF-N01', inclusionProbability: 0.25, runs: [{ rationale: 'order-fulfilment service mixes concerns' }, { rationale: '' }] }),
    lbl({ itemId: 'i-05', population: 'P4', kind: 'judge-unit', runId: 'e1-001', label: 'pass', functionId: 'FF-N01' }),
    lbl({ itemId: 'i-06', population: 'P4', kind: 'judge-unit', projectId: 'correct-reference', label: 'fail', functionId: 'FF-N01' }),
    lbl({ itemId: 'i-07', population: 'P2', projectId: 'ghostfolio', label: 'TP' }),
    lbl({ itemId: 'i-08', projectId: 'm1/task-management/full-aac/run-0', label: 'unseeded-TP', runs: [{ rationale: 'repository in controller' }, { rationale: 'repository in controller' }] }),
  ];

  it('codes only E1 items with a violation present (P3 TP-class, P4 fail)', () => {
    expect([['P3', 'TP'], ['P3', 'unseeded-TP'], ['P3', 'FP'], ['P3', 'uncertain'], ['P4', 'fail'], ['P4', 'pass'], ['P2', 'TP']].map(([p, l]) => isCodedLabel(p ?? '', l ?? '')))
      .toEqual([true, true, false, false, true, false, false]);
  });

  it('redacts the condition terms (longest first; the level none is kept) and the item\'s ids', () => {
    expect(conditionTerms([cellA, cellB])).toEqual(['full-aac', 'm1', 'm2', 'order-fulfilment', 'task-management']);
    expect(redact('m10 and m1', ['m1', 'm10'])).toBe('[redacted] and [redacted]');
  });

  it('builds the blinded items and the author key: 3 items (i-01, i-04, i-08), ids in shuffled order', () => {
    const r = openCodingInput(labels, records, reports, so5);
    if (!r.ok) throw new Error(r.detail);
    expect(r.input.seed).toBe(OPEN_CODING_SEED);
    expect(r.key.map((k) => k.itemId).sort()).toEqual(['i-01', 'i-04', 'i-08']);
    expect(r.input.items.map((i) => i.codingId)).toEqual(['OC-0001', 'OC-0002', 'OC-0003']);
    const byItem = new Map(r.key.map((k) => [k.itemId, k]));
    const item = (id: string): unknown => r.input.items.find((i) => i.codingId === byItem.get(id)?.codingId);
    expect(item('i-01')).toEqual({
      codingId: byItem.get('i-01')?.codingId, kind: 'violation', rule: 'dependency-direction',
      rationales: ['In [redacted] the [redacted] [redacted] domain imports express.', 'none of the ports in [redacted] are used'],
    });
    expect(item('i-04')).toEqual({ codingId: byItem.get('i-04')?.codingId, kind: 'judge-unit', rule: 'FF-N01', rationales: ['[redacted] service mixes concerns'] });
    expect(byItem.get('i-01')).toMatchObject({ population: 'P3', runId: 'e1-000', fpatFamily: 'FPAT-DEP-DIRECTION', weight: 2, requestedModelId: 'm1', specLevel: 'full-aac', runIndex: 0 });
    expect(byItem.get('i-04')).toMatchObject({ population: 'P4', runId: 'e1-001', fpatFamily: 'FPAT-SEMANTIC', weight: 4, taskId: 'order-fulfilment' });
    // i-08 has no runId: the one accepted E1 record of its project
    expect(byItem.get('i-08')).toMatchObject({ runId: 'e1-000', label: 'unseeded-TP', weight: 1 });
    // the panel's input carries no cell, run or item id
    expect(JSON.stringify(r.input)).not.toMatch(/e1-00|i-0|m1|m2|full-aac|task-management|order-fulfilment/);
    // deterministic
    expect(openCodingInput(labels, records, reports, so5)).toEqual(r);
  });

  it('refuses a coded P3 label that names no E1 record', () => {
    const r = openCodingInput([lbl({ itemId: 'i-x', runId: 'e1-999' })], records, reports, so5);
    expect(r.ok).toBe(false);
    expect(r.ok ? '' : r.detail).toMatch(/^OPEN_CODING_INPUT_INVALID: P3 item i-x names no E1 record/);
  });

  it('CLI: writes open-coding-input.json and open-coding-key.csv; --self-test exits 1; usage exits 2', () => {
    const dir = mkdtempSync(join(tmpdir(), 'so5-oc-'));
    const io = { out: (): void => undefined, err: (): void => undefined, writeFile: (f: string, t: string): void => { mkdirSync(join(f, '..'), { recursive: true }); writeFileSync(f, t); } };
    try {
      mkdirSync(join(dir, 'runs/runs'), { recursive: true });
      mkdirSync(join(dir, 'runs/reports'), { recursive: true });
      for (const rec of records) {
        writeFileSync(join(dir, 'runs/runs', `${rec.runId}.run.json`), JSON.stringify({ ...rec, reportPath: `reports/${rec.runId}.json` }));
        writeFileSync(join(dir, 'runs/reports', `${rec.runId}.json`), JSON.stringify(reports.get(rec.runId)));
      }
      writeFileSync(join(dir, 'labels.json'), JSON.stringify(labels));
      expect(openCodingMain(['--labels', join(dir, 'labels.json'), '--runs', join(dir, 'runs'), '--out', join(dir, 'out')], ROOT, io)).toBe(0);
      const input = JSON.parse(readFileSync(join(dir, 'out/open-coding-input.json'), 'utf8')) as { items: unknown[] };
      expect(input.items).toHaveLength(3);
      const key = parseCsv(readFileSync(join(dir, 'out/open-coding-key.csv'), 'utf8')).rows;
      expect(key.map((k) => k.item_id).sort()).toEqual(['i-01', 'i-04', 'i-08']);
      expect(key.find((k) => k.item_id === 'i-04')?.weight).toBe('4.000000');
      expect(openCodingMain(['--self-test'], ROOT, io)).toBe(1);
      expect(openCodingMain(['--labels'], ROOT, io)).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
