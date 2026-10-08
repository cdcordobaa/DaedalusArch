import { computeAVR, computeAHS } from '../../../src/scoring-engine/score-computer.js';
import { determineVerdict } from '../../../src/scoring-engine/verdict.js';
import { formatJSON, formatHuman, formatCSV, csvHeader } from '../../../src/scoring-engine/report-formatter.js';
import { ScoringStage } from '../../../src/scoring-engine/scoring-engine.js';
import { scoreAndAssemble } from './assembled-report-fixture.js';
import { avrScore, ahsScore, functionId, runId, confidence } from '../../../src/shared/types/value-objects.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { FirewallContext } from '../../../src/shared/context/firewall-context.js';
import type { SymbolicFunctionResult, NeuronalFunctionResult, EvaluationResults } from '../../../src/shared/types/evaluation.js';
import type { ScoringWeights, VerdictThresholds, ConfidenceThresholds } from '../../../src/shared/types/spec.js';
import type { Dimension } from '../../../src/shared/types/enums.js';
import type { GraphRepository, QueryResult } from '../../../src/shared/interfaces/graph-repository.js';

const WEIGHTS: ScoringWeights = { structural: 0.35, coupling: 0.20, pattern: 0.30, solid: 0.10, convention: 0.05, semantic: 0, integrity: 0 };
const FULL_WEIGHTS: ScoringWeights = { structural: 0.32, coupling: 0.18, pattern: 0.27, solid: 0.10, convention: 0.05, semantic: 0.04, integrity: 0.04 };
const THRESHOLDS: VerdictThresholds = { pass: 0.80, warning: 0.65, softBlock: 0.50 };
const CONF_THRESHOLDS: ConfidenceThresholds = { high: 0.85, medium: 0.60, iccMinimum: 0.70 };

function mockGraphRepo(): GraphRepository {
  return {
    async executeQuery(): Promise<DomainResult<QueryResult>> {
      return DomainResult.ok({ records: [{ cnt: 0, val: 0 }], summary: { counters: {} } });
    },
    async clearGraph() { return DomainResult.ok(undefined); },
    async healthCheck() { return true; },
    async close() {},
  };
}

// ScoringInput fields added at U3-R7 (domain-entities.md §4.1); the declared/disabled counts only feed
// droppedDimensions, which these tests do not inspect.
const R7_INPUT = {
  fitnessFunctions: [],
  compiled: { symbolicQueries: [], neuronalInstructions: [], hybridPairs: [], totalCompiled: 0, disabledFunctions: [], warnings: [] },
  noJudgeUnits: [],
} as const;

const symResult = (id: string, dim: Dimension, passed: boolean): SymbolicFunctionResult => ({
  functionId: functionId(id),
  dimension: dim,
  passed,
  violations: passed ? [] : [{
    id: `v-${id}`, type: 'LAYER_VIOLATION', dimension: dim, severity: 'critical',
    functionId: functionId(id), route: 'symbolic', filePath: 'src/test.ts',
    message: 'test violation', deterministic: true,
  }],
  executionTimeMs: 10,
  deterministic: true,
});

const neurResult = (id: string, dim: Dimension, verdict: 'pass' | 'fail', conf: number): NeuronalFunctionResult => ({
  functionId: functionId(id),
  dimension: dim,
  verdict,
  confidence: confidence(conf),
  confidenceStdDev: 0.05,
  icc: 0,
  reasoning: 'test',
  evidence: [],
  violations: verdict === 'fail' ? [{
    id: `nv-${id}`, type: 'SEMANTIC_RULE_VIOLATION', dimension: dim, severity: 'major',
    functionId: functionId(id), route: 'neuronal', filePath: 'src/test.ts',
    message: 'semantic violation', deterministic: false,
  }] : [],
  runs: [{ runIndex: 0, verdict, confidence: confidence(conf), reasoning: 'test' }],
  deterministic: false,
  flaggedUnstable: false,
  unitResults: [],
  unitsSelected: 0,
  unitsCapped: 0,
});

describe('score-computer', () => {
  describe('computeAVR', () => {
    it('returns 0 for no violations', () => {
      const results = [symResult('FF-S01', 'structural', true)];
      const avr = computeAVR(results, [], 'structural');
      expect(Number(avr)).toBe(0);
    });

    it('returns failed / executed functions of the dimension (BR-U3-32: both functions count, passing or failing)', () => {
      const results = [
        symResult('FF-S01', 'structural', false),
        symResult('FF-S02', 'structural', true),
      ];
      const avr = computeAVR(results, [], 'structural');
      expect(Number(avr)).toBe(0.5);
    });

    it('returns 0 for dimension with no functions', () => {
      const avr = computeAVR([], [], 'semantic');
      expect(Number(avr)).toBe(0);
    });
  });

  describe('computeAHS', () => {
    it('returns 1.0 for all-zero AVRs', () => {
      const avrs = new Map<Dimension, typeof avrScore extends (...args: any[]) => infer R ? R : never>([
        ['structural', avrScore(0)],
        ['coupling', avrScore(0)],
        ['pattern', avrScore(0)],
        ['solid', avrScore(0)],
        ['convention', avrScore(0)],
      ]);
      const ahs = computeAHS(avrs, WEIGHTS);
      expect(Number(ahs)).toBeCloseTo(1.0, 2);
    });

    it('returns 1 − Σ effectiveWeight × avr (BR-U3-35; weights renormalised over the present dimensions, here summing to 1)', () => {
      const avrs = new Map<Dimension, typeof avrScore extends (...args: any[]) => infer R ? R : never>([
        ['structural', avrScore(0.5)],
        ['coupling', avrScore(0)],
        ['pattern', avrScore(0)],
        ['solid', avrScore(0)],
        ['convention', avrScore(0)],
      ]);
      // AHS = 0.35*(1-0.5) + 0.20*(1-0) + 0.30*(1-0) + 0.10*(1-0) + 0.05*(1-0) = 0.175 + 0.65 = 0.825
      const ahs = computeAHS(avrs, WEIGHTS);
      expect(Number(ahs)).toBeCloseTo(0.825, 2);
    });
  });
});

describe('verdict', () => {
  it('returns pass for AHS >= 0.80', () => {
    expect(determineVerdict(ahsScore(0.85), THRESHOLDS)).toBe('pass');
    expect(determineVerdict(ahsScore(0.80), THRESHOLDS)).toBe('pass');
  });

  it('returns warning for AHS >= 0.65', () => {
    expect(determineVerdict(ahsScore(0.70), THRESHOLDS)).toBe('warning');
    expect(determineVerdict(ahsScore(0.65), THRESHOLDS)).toBe('warning');
  });

  it('returns soft-block for AHS >= 0.50', () => {
    expect(determineVerdict(ahsScore(0.55), THRESHOLDS)).toBe('soft-block');
  });

  it('returns hard-block for AHS < 0.50', () => {
    expect(determineVerdict(ahsScore(0.40), THRESHOLDS)).toBe('hard-block');
    expect(determineVerdict(ahsScore(0.0), THRESHOLDS)).toBe('hard-block');
  });
});

describe('report-formatter', () => {
  const makeReport = () => scoreAndAssemble({
    evaluationResults: { symbolicResults: [symResult('FF-S01', 'structural', true)], neuronalResults: [] },
    scoringWeights: WEIGHTS,
    confidenceThresholds: CONF_THRESHOLDS,
    verdictThresholds: THRESHOLDS,
    mode: 'symbolic-only',
    projectPath: '/test/project',
    specVersion: '1.0.0',
    graphRepository: mockGraphRepo(),
    ...R7_INPUT,
  });

  it('formatJSON produces valid JSON', async () => {
    const result = await makeReport();
    expect(result.success).toBe(true);
    if (result.success) {
      const json = formatJSON(result.data);
      expect(() => JSON.parse(json)).not.toThrow();
    }
  });

  it('formatHuman produces readable text', async () => {
    const result = await makeReport();
    expect(result.success).toBe(true);
    if (result.success) {
      const text = formatHuman(result.data);
      expect(text).toContain('Architectural Health Score');
      expect(text).toContain('Verdict');
      expect(text).toContain('Per-Dimension');
    }
  });

  it('formatCSV produces comma-separated values', async () => {
    const result = await makeReport();
    expect(result.success).toBe(true);
    if (result.success) {
      const csv = formatCSV(result.data);
      expect(csv.split(',').length).toBeGreaterThanOrEqual(10);
      expect(csv).toContain('/test/project');
    }
  });

  it('csvHeader matches CSV column count', async () => {
    const result = await makeReport();
    expect(result.success).toBe(true);
    if (result.success) {
      const header = csvHeader();
      const row = formatCSV(result.data);
      expect(header.split(',').length).toBe(row.split(',').length);
    }
  });
});

describe('scored and assembled report (computeScores removed at U3-R10)', () => {
  it('produces complete EvaluationReport', async () => {
    const results: EvaluationResults = {
      symbolicResults: [
        symResult('FF-S01', 'structural', true),
        symResult('FF-S02', 'structural', true),
        symResult('FF-P01', 'pattern', false),
      ],
      neuronalResults: [],
    };

    const result = await scoreAndAssemble({
      evaluationResults: results,
      scoringWeights: WEIGHTS,
      confidenceThresholds: CONF_THRESHOLDS,
      verdictThresholds: THRESHOLDS,
      mode: 'symbolic-only',
      projectPath: '/test',
      specVersion: '1.0.0',
      graphRepository: mockGraphRepo(),
      ...R7_INPUT,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ahsDeterministic).toBeDefined();
      expect(result.data.verdict).toBeDefined();
      expect(result.data.perDimensionScores.length).toBeGreaterThan(0);
      expect(result.data.universalMetrics).toBeDefined();
      expect(result.data.violations).toHaveLength(1); // FF-P01 failed
    }
  });
});

describe('ScoringStage', () => {
  it('implements PipelineStage and sets the scored report on the context (BR-U3-85 compile fix: setScoredReport)', async () => {
    const stage = new ScoringStage();
    expect(stage.name).toBe('scoring-engine');

    const context = new FirewallContext(runId('test'));
    const result = await stage.execute({
      evaluationResults: { symbolicResults: [symResult('FF-S01', 'structural', true)], neuronalResults: [] },
      scoringWeights: WEIGHTS,
      confidenceThresholds: CONF_THRESHOLDS,
      verdictThresholds: THRESHOLDS,
      mode: 'symbolic-only',
      projectPath: '/test',
      specVersion: '1.0.0',
      graphRepository: mockGraphRepo(),
      ...R7_INPUT,
    }, context);

    expect(result.success).toBe(true);
    const report = context.getScoredReport();
    expect(report.verdict).toBeDefined();
    expect(report.scoring.verdictSource).toBe('ahsDeterministic');
    expect(context.auditLog.some((e) => e.stage === 'scoring-engine')).toBe(true);
  });
});
