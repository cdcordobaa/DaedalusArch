/**
 * U5b Step 11: re-scorer (FR-26; BR-U5b-57..60; exit criterion 2, symbolic part).
 * The five committed fixture reports (`tests/fixtures/u5b/reports/`, symbolic-only, D-U5b-7) reproduce at 3 dp; the
 * full-mode cases use in-memory reports assembled through the real C8 path.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  ABLATION_COLUMNS, RESCORE_INPUT_MISSING, RESCORE_MISMATCH, SENSITIVITY_COLUMNS, ablationCsv, aggregateUnits, main,
  neuralVerdicts, reparseSpecScoring, rescoreReport, sensitivityCsv,
} from '../../../../scripts/rescore.js';
import type { RescorableReport, RescoreOutput } from '../../../../scripts/rescore.js';
import { scoreAndAssemble } from '../../scoring-engine/assembled-report-fixture.js';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { NeuralUnitRow, NeuronalFunctionResult } from '../../../../src/shared/types/evaluation.js';
import type { Dimension } from '../../../../src/shared/types/enums.js';
import { confidence, functionId } from '../../../../src/shared/types/value-objects.js';
import { ROOT } from './score-fixture.js';

const FIXTURES = ['correct-reference', 'variant-a-structural', 'variant-b-pattern', 'variant-c-everything', 'variant-d-subtle'] as const;
const DIR = 'tests/fixtures/u5b/reports';

type Mutable = { -readonly [K in keyof RescorableReport]: RescorableReport[K] };

function fixture(id: string): Mutable {
  return JSON.parse(readFileSync(resolve(ROOT, DIR, `${id}.json`), 'utf8')) as Mutable;
}
function record(id: string): { specSha: string } {
  return JSON.parse(readFileSync(resolve(ROOT, DIR, `${id}.run.json`), 'utf8')) as { specSha: string };
}
function ok(report: RescorableReport, opts: Parameters<typeof rescoreReport>[1] = {}): RescoreOutput {
  const r = rescoreReport(report, opts);
  if (!r.ok) throw new Error(`${r.code}: ${r.detail}`);
  return r.value;
}
function io() {
  const out: string[] = [];
  const err: string[] = [];
  const files = new Map<string, string>();
  return { out, err, files, io: { out: (t: string) => out.push(t), err: (t: string) => err.push(t), writeFile: (f: string, t: string) => files.set(f, t) } };
}

// ---------------------------------------------------------------------------------------------
// Full-mode report (in memory): two judged functions with synthetic unit rows

function judged(id: string, dimension: Dimension, verdict: 'pass' | 'fail', conf: number): NeuronalFunctionResult {
  return {
    functionId: functionId(id), dimension, verdict, confidence: confidence(conf), confidenceStdDev: 0.01, icc: 1,
    reasoning: 'r', evidence: [], violations: [], runs: [], deterministic: false, flaggedUnstable: false,
    unitResults: [], unitsSelected: 3, unitsCapped: 0,
  };
}
function unit(id: string, verdict: 'pass' | 'fail' | 'warning', conf: number, status: 'valid' | 'invalid' = 'valid', flaggedUnstable = false): NeuralUnitRow {
  return { unitId: id, unitKind: 'file', layer: 'domain', filePaths: [id], status, verdict, confidence: conf, confidenceStdDev: 0.01, flaggedUnstable, validRunCount: 3 };
}

async function fullReport(): Promise<Mutable> {
  const sym = (id: string, dimension: Dimension, passed: boolean) => ({
    functionId: functionId(id), dimension, passed, executionTimeMs: 1, deterministic: true as const, tag: 'structural' as const, violations: [],
  });
  const r = await scoreAndAssemble({
    evaluationResults: {
      symbolicResults: [sym('FF-S01', 'structural', true), sym('FF-S04', 'structural', false), sym('FF-C01', 'coupling', false), sym('FF-P01', 'pattern', true)],
      // FF-N01 fails with confidence 0.9 (weight 1.0); FF-N02 passes.
      neuronalResults: [judged('FF-N01', 'integrity', 'fail', 0.9), judged('FF-N02', 'semantic', 'pass', 0.9)],
      failures: [],
    },
    scoringWeights: { structural: 0.35, coupling: 0.2, pattern: 0.3, solid: 0.1, convention: 0.05, semantic: 0, integrity: 0 },
    fullModeWeights: { structural: 0.32, coupling: 0.18, pattern: 0.27, solid: 0.1, convention: 0.05, semantic: 0.04, integrity: 0.04 },
    confidenceThresholds: { high: 0.85, medium: 0.6, iccMinimum: 0.7 },
    verdictThresholds: { pass: 0.8, warning: 0.65, softBlock: 0.5 },
    mode: 'full', projectPath: 'fixtures/p', specVersion: '1', fitnessFunctions: [], noJudgeUnits: [],
    graphRepository: {
      executeQuery: () => Promise.resolve(DomainResult.ok({ records: [{ cnt: 0, val: 0 }], summary: { counters: {} } })),
      clearGraph: () => Promise.resolve(DomainResult.ok(undefined)),
      healthCheck: () => Promise.resolve(true),
      close: () => Promise.resolve(),
    },
    compiled: { symbolicQueries: [], neuronalInstructions: [], hybridPairs: [], totalCompiled: 0, disabledFunctions: [], warnings: [] },
  });
  if (!r.success) throw new Error(r.errors.map((e) => e.code).join(', '));
  const report = JSON.parse(JSON.stringify(r.data)) as Mutable & { neuralResults: { functionId: string; unitResults: NeuralUnitRow[] }[] };
  // Persisted unit rows consistent with the stored verdicts under majority-of-valid-units-v1 (U4 AGG-04):
  // FF-N01: 2 of 3 valid units fail at 0.9 → fail, confidence 0.9; FF-N02: 1 of 3 fails at 0.7 → warning (not violated).
  for (const row of report.neuralResults) {
    row.unitResults = row.functionId === 'FF-N01'
      ? [unit('src/a.ts', 'fail', 0.9), unit('src/b.ts', 'fail', 0.9), unit('src/c.ts', 'pass', 0.8), unit('src/d.ts', 'fail', 0.2, 'invalid')]
      : [unit('src/a.ts', 'fail', 0.7), unit('src/b.ts', 'pass', 0.9), unit('src/c.ts', 'pass', 0.9)];
  }
  return report;
}

// ---------------------------------------------------------------------------------------------

describe('re-scorer reproduction (BR-U5b-57, 58; exit criterion 2, symbolic part)', () => {
  it.each(FIXTURES)('%s: ahsDeterministic and the verdict reproduce at 3 dp from the report alone', (id) => {
    const report = fixture(id);
    expect(report.evaluationMode).toBe('symbolic-only');
    const out = ok(report);
    expect(out.inputSource).toBe('report');
    expect(out.reproduction.reproducesStored).toBe(true);
    expect(out.reproduction.ahs.ahsDeterministic?.toFixed(3)).toBe(Number(report.ahsDeterministic).toFixed(3));
    expect(out.reproduction.verdict).toBe(report.verdict);
    expect(out.reproduction.verdictSource).toBe('ahsDeterministic');
    expect(out.reproduction.ahs.ahsCombined).toBeUndefined();
    expect(out.reproduction.ahs.ahsNeuronal).toBeUndefined();
  });

  it('a 0.001 change of a stored AHS field, a changed verdict or changed AVR inputs are RESCORE_MISMATCH errors', () => {
    const a = fixture('variant-d-subtle');
    a.ahsDeterministic = (Number(a.ahsDeterministic) + 0.001) as never;
    const ra = rescoreReport(a);
    expect(ra).toMatchObject({ ok: false, code: RESCORE_MISMATCH });
    expect(!ra.ok && ra.detail).toContain('ahsDeterministic');

    const b = fixture('correct-reference');
    b.verdict = 'warning';
    expect(rescoreReport(b)).toMatchObject({ ok: false, code: RESCORE_MISMATCH });

    const c = fixture('variant-a-structural') as Mutable & { perDimensionScores: { violatedWeight: number }[] };
    const [first] = c.perDimensionScores;
    if (first !== undefined) first.violatedWeight -= 1;
    expect(rescoreReport(c)).toMatchObject({ ok: false, code: RESCORE_MISMATCH });

    const d = fixture('variant-b-pattern') as Mutable & { scoring: { verdictSource: string } };
    d.scoring.verdictSource = 'ahsCombined';
    expect(rescoreReport(d)).toMatchObject({ ok: false, code: RESCORE_MISMATCH });
  });

  it('a full-mode report re-scores on all three AHS fields; the verdict comes from verdictSource = ahsCombined', async () => {
    const report = await fullReport();
    const out = ok(report);
    expect(report.scoring?.verdictSource).toBe('ahsCombined');
    for (const f of ['ahsDeterministic', 'ahsCombined', 'ahsNeuronal'] as const) {
      expect(report[f]).toBeDefined();
      expect(out.reproduction.ahs[f]?.toFixed(3)).toBe(Number(report[f]).toFixed(3));
    }
    expect(out.reproduction.verdict).toBe(report.verdict);
    // Changing only the combined score breaks the reproduction.
    const bad = { ...report, ahsCombined: Number(report.ahsCombined) - 0.01 } as unknown as RescorableReport;
    expect(rescoreReport(bad)).toMatchObject({ ok: false, code: RESCORE_MISMATCH });
  });

  it('without the scoring block the spec at RunRecord.specSha is re-parsed: source = spec-reparse', async () => {
    const report = fixture('variant-c-everything');
    delete (report as { scoring?: unknown }).scoring;
    expect(rescoreReport(report)).toMatchObject({ ok: false, code: RESCORE_INPUT_MISSING });
    const parsed = await reparseSpecScoring(resolve(ROOT, 'specs/clean-arch.yaml'), record('variant-c-everything').specSha);
    if (!parsed.ok) throw new Error(parsed.detail);
    const out = ok(report, { specScoring: parsed.value });
    expect(out.inputSource).toBe('spec-reparse');
    expect(out.reproduction.inputSource).toBe('spec-reparse');
    expect(out.reproduction.reproducesStored).toBe(true);
    // A spec whose bytes do not hash to specSha is refused.
    const wrong = await reparseSpecScoring(resolve(ROOT, 'specs/clean-arch.yaml'), '0'.repeat(64));
    expect(wrong.ok).toBe(false);
  });
});

describe('leave-one-dimension-out (BR-U5b-59)', () => {
  it('weights .35/.20/.30/.10/.05 with solid ablated give the FR-15 vector .389/.222/.333/.056; the row is marked ablated', () => {
    const report = fixture('variant-b-pattern');
    expect(report.perDimensionScores.map((p) => p.dimension)).toEqual(['structural', 'coupling', 'pattern', 'solid', 'convention']);
    const out = ok(report);
    expect(out.ablations.map((a) => a.ablated)).toEqual(['structural', 'coupling', 'pattern', 'solid', 'convention']);
    const solid = out.ablations.find((a) => a.ablated === 'solid');
    expect(solid?.purpose).toBe('ablation');
    expect(Object.fromEntries([...(solid?.effectiveWeights ?? new Map<string, number>())].map(([d, w]) => [d, w.toFixed(3)])))
      .toEqual({ structural: '0.389', coupling: '0.222', pattern: '0.333', convention: '0.056' });
    // Ablation is never a DroppedDimension: the report's list (U3 reasons) is carried unchanged.
    expect(solid?.droppedDimensions).toEqual(report.droppedDimensions);
    expect(solid?.droppedDimensions.some((d) => d.dimension === 'solid')).toBe(false);
  });

  it('rescore_ablation.csv has one row per run × ablated dimension × AHS field, with delta_ahs', async () => {
    const outs = [ok(fixture('variant-d-subtle')), ok(await fullReport())];
    const lines = ablationCsv(outs).trimEnd().split('\n');
    expect(lines[0]).toBe(ABLATION_COLUMNS.join(','));
    // Symbolic-only: 5 dimensions × ahsDeterministic. Full: 3 executed symbolic dimensions × (deterministic, combined)
    // + 2 judged dimensions × (combined, neuronal); a field whose candidate set lacks the dimension gets no row.
    expect(lines).toHaveLength(1 + 5 + 3 * 2 + 2 * 2);
    expect(lines.some((l) => l.includes(',structural,ahsNeuronal,'))).toBe(false);
    const solidRow = lines.find((l) => l.startsWith(`${outs[0]?.runId ?? ''},solid,`));
    expect(solidRow?.split(',')).toEqual([outs[0]?.runId, 'solid', 'ahsDeterministic', '0.509', 'soft-block', '-0.049']);
  });
});

describe('sensitivity only (BR-U5b-60)', () => {
  it('every sensitivity result and every rescore_sensitivity.csv row is sensitivity-only; shipped thresholds stay in the reproduction', async () => {
    const outs = [...FIXTURES.map((id) => ok(fixture(id))), ok(await fullReport())];
    for (const o of outs) {
      expect(o.reproduction.thresholds).toEqual({ pass: 0.8, warning: 0.65, softBlock: 0.5 });
      expect(o.sensitivity.length).toBeGreaterThan(0);
      for (const s of o.sensitivity) expect(s.purpose).toBe('sensitivity-only');
    }
    const lines = sensitivityCsv(outs).trimEnd().split('\n');
    expect(lines[0]).toBe(SENSITIVITY_COLUMNS.join(','));
    const purposeAt = SENSITIVITY_COLUMNS.indexOf('purpose');
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines.slice(1)) expect(l.split(',')[purposeAt]).toBe('sensitivity-only');
    expect(lines.some((l) => l.includes(',0.75/0.60/0.45,'))).toBe(true);
    expect(lines.some((l) => l.includes(',0.85/0.70/0.55,'))).toBe(true);
  });

  it('the majority aggregation reproduces the stored neural function verdicts (synthetic unitResults); the variants differ', async () => {
    const report = await fullReport();
    const majority = neuralVerdicts(report, 'majority');
    expect(majority.size).toBe(2);
    for (const row of report.functionResults.filter((r) => r.route === 'neuronal')) {
      expect(majority.get(String(row.functionId))?.verdict === 'fail').toBe(!row.passed);
    }
    const out = ok(report);
    const byId = new Map(out.sensitivity.map((s) => [s.scenarioId, s]));
    expect(byId.get('neural:majority')?.reproducesStored).toBe(true);
    expect(byId.get('neural:majority')?.ahs).toEqual(out.reproduction.ahs);
    // any-fail turns FF-N02 (1 of 3 failing at 0.7) into a fail of weight 0.7: semantic AVR 0 → 0.7.
    expect(neuralVerdicts(report, 'any-fail').get('FF-N02')?.verdict).toBe('fail');
    expect(byId.get('neural:any-fail')?.avr.get('semantic')).toBe(0.7);
    // share: FF-N01 2/3, FF-N02 1/3.
    expect(byId.get('neural:share')?.avr.get('integrity')).toBe(0.667);
    expect(byId.get('neural:share')?.avr.get('semantic')).toBe(0.333);
    expect(Number(byId.get('neural:any-fail')?.ahs.ahsCombined)).toBeLessThan(Number(out.reproduction.ahs.ahsCombined));
  });

  it('aggregateUnits follows majority-of-valid-units-v1 (U4 AGG-04) and ignores invalid units', () => {
    const f = (n: number, of: number): NeuralUnitRow[] =>
      Array.from({ length: of }, (_, i) => unit(`u${String(i)}`, i < n ? 'fail' : 'pass', 0.9));
    expect(aggregateUnits(f(3, 5), 'majority')?.verdict).toBe('fail');
    expect(aggregateUnits(f(2, 5), 'majority')?.verdict).toBe('warning');
    expect(aggregateUnits(f(0, 5), 'majority')?.verdict).toBe('pass');
    expect(aggregateUnits(f(1, 5), 'any-fail')?.verdict).toBe('fail');
    expect(aggregateUnits(f(1, 5), 'share')?.failShare).toBe(0.2);
    expect(aggregateUnits([unit('a', 'fail', 0.9, 'invalid')], 'majority')).toBeUndefined();
    // With 3 of 5 failing, the passing units' confidence and instability do not change the result.
    const base = f(3, 5);
    const changed = base.map((u) => (u.verdict === 'pass' ? { ...u, confidence: 0.1, flaggedUnstable: true } : u));
    expect(aggregateUnits(changed, 'majority')).toEqual(aggregateUnits(base, 'majority'));
  });
});

describe('rescore main (BR-U5b-73)', () => {
  it('--help exits 0; unknown arguments and a missing --report exit 2', async () => {
    const a = io();
    expect(await main(['--help'], ROOT, a.io)).toBe(0);
    expect(a.out.join('')).toContain('usage:');
    expect(await main(['--bogus'], ROOT, io().io)).toBe(2);
    expect(await main([], ROOT, io().io)).toBe(2);
  });

  it('re-scores the five fixture reports into the two CSVs', async () => {
    const a = io();
    const argv = FIXTURES.flatMap((id) => ['--report', `${DIR}/${id}.json`]);
    expect(await main([...argv, '--out-dir', 'out'], ROOT, a.io)).toBe(0);
    expect([...a.files.keys()].map((f) => f.slice(ROOT.length + 1))).toEqual(['out/rescore_ablation.csv', 'out/rescore_sensitivity.csv']);
    expect(a.files.get(resolve(ROOT, 'out/rescore_ablation.csv'))?.split('\n')).toHaveLength(1 + 5 * 5 + 1);
    expect(a.err).toEqual([]);
  });

  it('a report without the block exits 1 without --spec; with --record and --spec it re-scores from the re-parsed spec', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'u5b-rescore-'));
    try {
      const report = fixture('correct-reference');
      delete (report as { scoring?: unknown }).scoring;
      const file = join(dir, 'no-scoring.json');
      writeFileSync(file, JSON.stringify(report));
      const a = io();
      expect(await main(['--report', file, '--record', `${DIR}/correct-reference.run.json`], ROOT, a.io)).toBe(1);
      expect(a.err.join('')).toContain(RESCORE_INPUT_MISSING);
      const b = io();
      expect(await main(['--report', file, '--record', `${DIR}/correct-reference.run.json`, '--spec', 'specs/clean-arch.yaml'], ROOT, b.io)).toBe(0);
      const json = JSON.parse(b.out.join('')) as { inputSource: string; reproduction: { reproducesStored: boolean } }[];
      expect(json[0]?.inputSource).toBe('spec-reparse');
      expect(json[0]?.reproduction.reproducesStored).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
