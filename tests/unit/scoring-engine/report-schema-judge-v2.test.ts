/**
 * R04 (Docs/v1.3/post-merge-review-2026-10-16.md): a judge v2 run stamps `judgeVersion` and `judgeRevision` on the
 * report's judge provenance (judge-stage.ts). The report schema must accept them (dated amendment 2026-10-16), and must
 * not accept them stripped into a v1-looking report or with any other value.
 */
import { validateReport } from '../../../src/scoring-engine/report-schema-validator.js';
import { JUDGE_V2_REVISION } from '../../../src/llm-critic/judge-v2.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { confidence, functionId } from '../../../src/shared/types/value-objects.js';
import type { GraphRepository, QueryResult } from '../../../src/shared/interfaces/graph-repository.js';
import type { EvaluationReport, JudgeProvenance, NeuronalFunctionResult, SymbolicFunctionResult } from '../../../src/shared/types/evaluation.js';
import { scoreAndAssemble } from './assembled-report-fixture.js';


function repo(): GraphRepository {
  return {
    executeQuery(): Promise<DomainResult<QueryResult>> {
      return Promise.resolve(DomainResult.ok({ records: [{ cnt: 0, val: 0 }], summary: { counters: {} } }));
    },
    clearGraph() { return Promise.resolve(DomainResult.ok(undefined)); },
    healthCheck() { return Promise.resolve(true); },
    close() { return Promise.resolve(); },
  };
}

const sym: SymbolicFunctionResult = { functionId: functionId('FF-S01'), dimension: 'structural', passed: true, executionTimeMs: 2, deterministic: true, tag: 'structural', violations: [] };
const neural: NeuronalFunctionResult = {
  functionId: functionId('FF-N01'), dimension: 'integrity', verdict: 'pass', confidence: confidence(0.9), confidenceStdDev: 0.01, icc: 1,
  reasoning: 'r', evidence: [], violations: [], runs: [], deterministic: false, flaggedUnstable: false, unitResults: [], unitsSelected: 1, unitsCapped: 0,
};

const V1: JudgeProvenance = { provider: 'claude-cli', model: 'sonnet', runsPerUnit: 1 };

async function fullReport(judge: JudgeProvenance): Promise<DomainResult<EvaluationReport>> {
  return scoreAndAssemble({
    evaluationResults: { symbolicResults: [sym], neuronalResults: [neural], failures: [] },
    scoringWeights: { structural: 0.35, coupling: 0.2, pattern: 0.3, solid: 0.1, convention: 0.05, semantic: 0, integrity: 0 },
    fullModeWeights: { structural: 0.32, coupling: 0.18, pattern: 0.27, solid: 0.1, convention: 0.05, semantic: 0.04, integrity: 0.04 },
    confidenceThresholds: { high: 0.85, medium: 0.6, iccMinimum: 0.7 },
    verdictThresholds: { pass: 0.8, warning: 0.65, softBlock: 0.5 },
    mode: 'full',
    projectPath: '/p',
    specVersion: '1',
    graphRepository: repo(),
    fitnessFunctions: [],
    compiled: { symbolicQueries: [], neuronalInstructions: [], hybridPairs: [], totalCompiled: 0, disabledFunctions: [], warnings: [] },
    noJudgeUnits: [],
  }, judge);
}

function codes(r: DomainResult<unknown>): string[] {
  return r.success ? [] : r.errors.map((e) => e.code);
}

describe('R04: judge v2 provenance in the report schema', () => {
  it('a v1 report (no version fields) still validates', async () => {
    const r = await fullReport(V1);
    expect(codes(r)).toEqual([]);
  });

  it('a v2 report keeps judgeVersion and judgeRevision and validates', async () => {
    const r = await fullReport({ ...V1, judgeVersion: 'v2', judgeRevision: JUDGE_V2_REVISION });
    expect(codes(r)).toEqual([]);
    if (!r.success) return;
    expect(r.data.judge).toMatchObject({ judgeVersion: 'v2', judgeRevision: JUDGE_V2_REVISION });
    expect(codes(validateReport(JSON.parse(JSON.stringify(r.data)) as unknown))).toEqual([]);
  });

  it('any other judgeVersion is rejected (v1 is the absence of the field)', async () => {
    const r = await fullReport(V1);
    if (!r.success) throw new Error('assembly failed');
    const stored = JSON.parse(JSON.stringify(r.data)) as Record<string, unknown>;
    const judge = stored.judge as Record<string, unknown>;
    expect(codes(validateReport({ ...stored, judge: { ...judge, judgeVersion: 'v1' } }))).toEqual(['REPORT_SCHEMA_INVALID']);
    expect(codes(validateReport({ ...stored, judge: { ...judge, judgeRevision: 1 } }))).toEqual(['REPORT_SCHEMA_INVALID']);
  });
});
