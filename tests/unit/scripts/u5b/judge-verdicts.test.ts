/**
 * P4 judge verdicts derived from stored runs (ADR-020 item 7, B3; BR-U5b-33, 43). Hand-built RunRecords and reports:
 * which runs are P4 sources, which units yield a verdict, and that the derived set forms the E1 headline row.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FIXTURES_PLAN_ID, judgeVerdictsFromRuns, missingSource, p4SourceOf } from '../../../../scripts/lib/judge-verdicts.js';
import type { JudgeUnitVerdict } from '../../../../scripts/lib/judge-verdicts.js';
import type { GenerationCell, RunRecord } from '../../../../scripts/lib/report-io.js';
import { agreementStats, loadLabellerPrompts, main } from '../../../../scripts/llm-label.js';
import type { LabelMainIo, LabellingOutputs, ReconciledLabel } from '../../../../scripts/llm-label.js';
import { FIXTURE_MODEL, LABEL_FIXTURE_DIR } from './label-fixture.js';
import { ROOT } from './score-fixture.js';

const JUDGE = 'claude-opus-5-5';

function cell(over: Partial<GenerationCell> = {}): GenerationCell {
  return {
    requestedModelId: 'claude-haiku-4-5', adapterId: 'claude-cli', promptTemplateId: 'pt', style: 'clean', specLevel: 'none',
    taskId: 't1', runIndex: 0, generationOutcomePath: 'o.json', generationStatus: 'ok', fileCount: 10, fileCountInRange: true, permissionDenials: 0,
    ...over,
  };
}
function record(runId: string, projectId: string, over: Partial<RunRecord> = {}): RunRecord {
  return {
    runId, planId: 'e1-grid', projectId, status: 'accepted', attempt: 1, reportPath: `reports/${runId}.json`, specSha: 's', cliCommit: 'c',
    preregVersion: 3, frozenHashes: {}, envRecordId: 'env', startedAt: '2026-10-09T00:00:00Z', wallMs: 1, ...over,
  };
}
/** A report with one semantic row: `units` as [unitId, status, verdict]. */
function report(units: readonly (readonly [string, 'valid' | 'invalid', 'pass' | 'fail' | 'warning'])[], functionId = 'FF-N02'): unknown {
  return {
    judge: { provider: 'claude-cli', model: JUDGE },
    neuralResults: [{ functionId, dimension: 'semantic', unitResults: units.map(([unitId, status, verdict]) => ({ unitId, status, verdict })) }],
  };
}

describe('p4SourceOf (Docs/analysis-plan.md §4, ADR-020 item 7)', () => {
  it('E1 run index 0 of an ok cell → e1 with the requested generator model; fixtures plan → fixture; anything else → null', () => {
    expect(p4SourceOf(record('r1', 'cell-a', { cell: cell() }))).toEqual({ source: 'e1', generatorModel: 'claude-haiku-4-5' });
    expect(p4SourceOf(record('r2', 'cell-a', { cell: cell({ runIndex: 1 }) }))).toBeNull();
    expect(p4SourceOf(record('r3', 'cell-a', { cell: cell({ generationStatus: 'failed-typecheck' }) }))).toBeNull();
    expect(p4SourceOf(record('r4', 'cell-a', { cell: cell(), status: 'rejected' }))).toBeNull();
    expect(p4SourceOf(record('r5', 'correct-reference', { planId: FIXTURES_PLAN_ID }))).toEqual({ source: 'fixture' });
    expect(p4SourceOf(record('r6', 'ghostfolio', { planId: 'e7-corpus' }))).toBeNull();
    const seed = { seedId: 's', baseProjectId: 'b', split: 'held-out', baseKind: 'corpus', manifestPath: 'm', baselineReportPath: 'b' } as const;
    expect(p4SourceOf(record('r7', 'correct-reference', { planId: FIXTURES_PLAN_ID, seed }))).toBeNull();
  });
});

describe('judgeVerdictsFromRuns', () => {
  it('hand-built runs: 5 valid pass/fail units of 3 P4 runs; invalid, warning and non-P4 units dropped; sorted', () => {
    const records = [
      record('e1-opus', 'cell-b', { cell: cell({ requestedModelId: 'claude-opus-5-5' }) }),
      record('e1-haiku', 'cell-a', { cell: cell() }),
      record('e1-haiku-run1', 'cell-a2', { cell: cell({ runIndex: 1 }) }),
      record('fx', 'variant-a-structural', { planId: FIXTURES_PLAN_ID }),
      record('no-report', 'cell-c', { cell: cell() }),
    ];
    const reports = new Map<string, unknown>([
      ['e1-opus', report([['u2', 'valid', 'pass']])],
      ['e1-haiku', report([['u1', 'valid', 'fail'], ['u9', 'invalid', 'warning'], ['u0', 'valid', 'pass']])],
      ['e1-haiku-run1', report([['u1', 'valid', 'pass']])],
      ['fx', report([['m1', 'valid', 'fail'], ['m2', 'valid', 'pass']], 'FF-N01')],
    ]);
    const v = judgeVerdictsFromRuns(records, reports);
    // Expected by hand: cell-a u0, u1 (haiku); cell-b u2 (opus); variant-a m1, m2 (fixture); sorted by project.
    expect(v).toEqual([
      { projectId: 'cell-a', functionId: 'FF-N02', unitId: 'u0', verdict: 'pass', judgeModel: JUDGE, source: 'e1', generatorModel: 'claude-haiku-4-5' },
      { projectId: 'cell-a', functionId: 'FF-N02', unitId: 'u1', verdict: 'fail', judgeModel: JUDGE, source: 'e1', generatorModel: 'claude-haiku-4-5' },
      { projectId: 'cell-b', functionId: 'FF-N02', unitId: 'u2', verdict: 'pass', judgeModel: JUDGE, source: 'e1', generatorModel: 'claude-opus-5-5' },
      { projectId: 'variant-a-structural', functionId: 'FF-N01', unitId: 'm1', verdict: 'fail', judgeModel: JUDGE, source: 'fixture' },
      { projectId: 'variant-a-structural', functionId: 'FF-N01', unitId: 'm2', verdict: 'pass', judgeModel: JUDGE, source: 'fixture' },
    ]);
    expect(missingSource(v)).toEqual([]);
    expect(missingSource([...v, { projectId: 'p', functionId: 'f', unitId: 'u', verdict: 'pass', judgeModel: JUDGE }])).toEqual([5]);
  });

  it('derived verdicts form the E1 headline row (2 of 3 agree) and the per-generator rows', () => {
    const p = loadLabellerPrompts(ROOT);
    if (!p.ok) throw new Error(p.detail);
    const unit = (id: string, project: string, label: 'pass' | 'fail'): ReconciledLabel => ({
      itemId: `i-${id}`, projectId: project, kind: 'judge-unit', population: 'P4', stratum: `${project}, semantic`, inclusionProbability: 1,
      unitId: id, functionId: 'FF-N02', label,
      runs: ([0, 1] as const).map((runIndex) => ({ runIndex, label, rationale: 'r', cassetteKey: 'k', attempts: 1 })) as unknown as ReconciledLabel['runs'],
    });
    const records = [record('a', 'cell-a', { cell: cell() }), record('b', 'cell-b', { cell: cell({ requestedModelId: 'claude-opus-5-5' }) })];
    const reports = new Map<string, unknown>([['a', report([['u0', 'valid', 'pass'], ['u1', 'valid', 'fail']])], ['b', report([['u2', 'valid', 'pass']])]]);
    // Panel: u0 pass (agree), u1 pass (disagree), u2 pass (agree) → 2 / 3 on the headline; haiku 1 / 2; opus 1 / 1.
    const labels = [unit('u0', 'cell-a', 'pass'), unit('u1', 'cell-a', 'pass'), unit('u2', 'cell-b', 'pass')];
    const rows = agreementStats({ labels, prompts: p.prompts, labellerModel: FIXTURE_MODEL, judgeVerdicts: judgeVerdictsFromRuns(records, reports) })
      .filter((r) => r.comparison === 'judge-vs-panel');
    expect(rows.map((r) => [r.source, r.generatorModel, r.headline, r.uncertainAsCategory, r.n, r.percentAgreement])).toEqual([
      ['all', '', false, false, 3, 2 / 3],
      ['e1', '', true, false, 3, 2 / 3],
      ['e1', 'claude-haiku-4-5', false, false, 2, 1 / 2],
      ['e1', 'claude-opus-5-5', false, false, 1, 1],
      ['e1', '', false, true, 3, 2 / 3],
    ]);
  });
});

describe('llm-label --agreement: --judge-runs and the missing-source refusal', () => {
  function io(): { err: string[]; io: LabelMainIo } {
    const err: string[] = [];
    return { err, io: { out: () => undefined, err: (t) => { err.push(t); }, writeFile: (f, t) => { writeFileSync(f, t); } } };
  }

  it('a --judge-verdicts file without source exits 1 (LABEL_VERDICT_SOURCE_MISSING); --judge-runs derives the rows', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'u5b-verdicts-'));
    try {
      const labels = join(dir, 'labels.json');
      writeFileSync(labels, '[]');
      const noSource: JudgeUnitVerdict[] = [{ projectId: 'cell-a', functionId: 'FF-N02', unitId: 'u0', verdict: 'pass', judgeModel: JUDGE }];
      const vFile = join(dir, 'verdicts.json');
      writeFileSync(vFile, JSON.stringify(noSource));
      const common = ['--agreement', '--plan', `${LABEL_FIXTURE_DIR}/plan.json`, '--labels', labels, '--model', FIXTURE_MODEL, '--out', join(dir, 'labelling.json')];
      const refused = io();
      expect(await main([...common, '--judge-verdicts', vFile], ROOT, refused.io)).toBe(1);
      expect(refused.err.join('')).toContain('LABEL_VERDICT_SOURCE_MISSING');

      const runDir = join(dir, 'e1');
      mkdirSync(join(runDir, 'runs'), { recursive: true });
      mkdirSync(join(runDir, 'reports'));
      writeFileSync(join(runDir, 'runs', 'a.run.json'), JSON.stringify(record('a', 'cell-a', { cell: cell() })));
      writeFileSync(join(runDir, 'reports', 'a.json'), JSON.stringify(report([['u0', 'valid', 'pass']])));
      expect(await main([...common, '--judge-runs', runDir], ROOT, io().io)).toBe(0);
      const out = JSON.parse(readFileSync(join(dir, 'labelling.json'), 'utf8')) as LabellingOutputs;
      const judge = (out.agreement ?? []).filter((r) => r.comparison === 'judge-vs-panel');
      // No P4 labels → n = 0, but the E1 headline row exists because the verdicts carry source = e1.
      expect(judge.filter((r) => r.headline).map((r) => [r.source, r.n])).toEqual([['e1', 0]]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
