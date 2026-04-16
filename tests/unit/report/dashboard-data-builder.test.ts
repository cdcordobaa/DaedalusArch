import { buildDashboardData } from '../../../src/report/dashboard-data-builder.js';
import { functionId, runId, ahsScore, avrScore } from '../../../src/shared/types/value-objects.js';
import type { EvaluationReport, PerDimensionScore } from '../../../src/shared/types/evaluation.js';
import type { ParsedSpec, FitnessFunction } from '../../../src/shared/types/spec.js';
import type { APGResult, APGNode } from '../../../src/shared/types/apg.js';
import type { ActionableViolation } from '../../../src/shared/taxonomy/violation-types.js';
import type { BaselineResult } from '../../../src/shared/types/baseline.js';

function makeReport(overrides: Partial<EvaluationReport> = {}): EvaluationReport {
  return {
    runId: runId('run-test'),
    projectPath: '/test/project',
    specVersion: '1.0.0',
    ahsDeterministic: ahsScore(0.85),
    verdict: 'pass',
    perDimensionScores: [
      { dimension: 'structural', avr: avrScore(0.1), weight: 0.35, violationCount: 2, functionCount: 5 },
      { dimension: 'coupling', avr: avrScore(0.05), weight: 0.2, violationCount: 1, functionCount: 3 },
    ] as readonly PerDimensionScore[],
    violations: [],
    universalMetrics: {
      cyclicDependencyCount: 0,
      maxFanOut: 5,
      maxFanIn: 8,
      abstractionRatio: 0.3,
      averageInstability: 0.45,
      orphanFileCount: 2,
    },
    evaluationMode: 'symbolic-only',
    durationMs: 1234,
    warnings: [],
    ...overrides,
  };
}

function makeSpec(ffs: Partial<FitnessFunction>[] = []): ParsedSpec {
  return {
    specVersion: '1.0.0',
    layerModel: { layers: [{ name: 'domain', directories: ['src/domain/'], naming: [], role: 'domain' }] },
    fitnessFunctions: ffs.map((ff) => ({
      id: functionId('FF-S01'),
      name: 'test-function',
      dimension: 'structural' as const,
      severity: 'major' as const,
      route: 'symbolic' as const,
      isBuiltIn: true,
      validated: true,
      enabled: true,
      excludePaths: [],
      ...ff,
    })),
    scoringWeights: { structural: 0.35, coupling: 0.2, pattern: 0.3, solid: 0.1, convention: 0.05, semantic: 0, intent: 0 },
    verdictThresholds: { pass: 0.8, warning: 0.65, softBlock: 0.5 },
    confidenceThresholds: { high: 0.85, medium: 0.6, iccMinimum: 0.7 },
    adrRules: [],
  };
}

function makeAPGResult(nodeCount: number = 5): APGResult {
  const nodes: APGNode[] = [];
  for (let i = 0; i < nodeCount; i++) {
    nodes.push({
      id: `file-${i}`,
      type: 'File',
      filePath: `src/file-${i}.ts`,
      name: `file-${i}.ts`,
      layer: 'domain',
      decorators: [],
      properties: {},
    });
  }
  // Add a class node
  nodes.push({
    id: 'class-1',
    type: 'Class',
    filePath: 'src/file-0.ts',
    name: 'MyClass',
    decorators: [],
    properties: {},
  });
  return {
    nodes,
    edges: [],
    parseCoverage: { total: nodeCount, parsed: nodeCount, percentage: 100, skipped: [] },
    warnings: [],
  };
}

describe('buildDashboardData', () => {
  it('builds header with product name and project name', () => {
    const result = buildDashboardData(makeReport(), makeSpec(), makeAPGResult(), [], 'my-project');
    expect(result.header.productName).toBe('Architectonic Firewall');
    expect(result.header.projectName).toBe('my-project');
    expect(result.header.specVersion).toBe('1.0.0');
    expect(result.header.evaluationTimestamp).toBeTruthy();
  });

  it('builds AHS score with dimension breakdown', () => {
    const result = buildDashboardData(makeReport(), makeSpec(), makeAPGResult(), [], 'test');
    expect(result.ahsScore.deterministic).toBeCloseTo(0.85);
    expect(result.ahsScore.verdict).toBe('pass');
    expect(result.ahsScore.dimensions).toHaveLength(2);
    expect(result.ahsScore.dimensions[0]!.dimension).toBe('structural');
    expect(result.ahsScore.dimensions[0]!.score).toBeCloseTo(0.9);
  });

  it('includes combined score when present', () => {
    const report = makeReport({ ahsCombined: ahsScore(0.82) });
    const result = buildDashboardData(report, makeSpec(), makeAPGResult(), [], 'test');
    expect(result.ahsScore.combined).toBeCloseTo(0.82);
  });

  it('builds fitness function cards from enabled functions', () => {
    const spec = makeSpec([
      { id: functionId('FF-01'), name: 'rule-a', enabled: true },
      { id: functionId('FF-02'), name: 'rule-b', enabled: true },
      { id: functionId('FF-03'), name: 'disabled', enabled: false },
    ]);
    const result = buildDashboardData(makeReport(), spec, makeAPGResult(), [], 'test');
    expect(result.fitnessFunctions).toHaveLength(2);
  });

  it('marks fitness functions as failed when violations exist', () => {
    const report = makeReport({
      violations: [{
        id: 'v1', type: 'LAYER_VIOLATION', dimension: 'structural',
        severity: 'major', functionId: functionId('FF-01'), route: 'symbolic',
        filePath: 'src/a.ts', message: 'bad', deterministic: true,
      }],
    });
    const spec = makeSpec([{ id: functionId('FF-01'), name: 'rule-a', enabled: true }]);
    const result = buildDashboardData(report, spec, makeAPGResult(), [], 'test');
    expect(result.fitnessFunctions[0]!.passed).toBe(false);
    expect(result.fitnessFunctions[0]!.violationCount).toBe(1);
  });

  it('includes violations as-is in dashboard data', () => {
    const actionable: ActionableViolation[] = [{
      id: 'v1', type: 'LAYER_VIOLATION', dimension: 'structural',
      severity: 'major', functionId: functionId('FF-01'), route: 'symbolic',
      filePath: 'src/a.ts', message: 'bad', deterministic: true,
      what: '[major] FF-01', where: 'src/a.ts', why: 'test', fix: 'fix it',
      baselineStatus: 'none',
    }];
    const result = buildDashboardData(makeReport(), makeSpec(), makeAPGResult(), actionable, 'test');
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]!.what).toContain('[major]');
  });

  it('returns null baseline when no baseline result', () => {
    const result = buildDashboardData(makeReport(), makeSpec(), makeAPGResult(), [], 'test');
    expect(result.baseline).toBeNull();
  });

  it('builds baseline split data when baseline result provided', () => {
    const baseline: BaselineResult = {
      baselineViolations: [{ id: 'v1', type: 'LAYER_VIOLATION', dimension: 'structural', severity: 'major', functionId: functionId('FF-01'), route: 'symbolic', filePath: 'a.ts', message: 'x', deterministic: true }],
      newViolations: [],
      removedFromBaseline: [],
      baselineFilePath: '.firewall-baseline.json',
    };
    const result = buildDashboardData(makeReport(), makeSpec(), makeAPGResult(), [], 'test', baseline);
    expect(result.baseline).not.toBeNull();
    expect(result.baseline!.baselineCount).toBe(1);
    expect(result.baseline!.newCount).toBe(0);
  });

  it('builds summary stats from APG result', () => {
    const result = buildDashboardData(makeReport(), makeSpec(), makeAPGResult(10), [], 'test');
    expect(result.summary.totalFiles).toBe(10);
    expect(result.summary.totalComponents).toBe(1); // 1 class node
    expect(result.summary.layersDetected).toBe(1);
    expect(result.summary.evaluationMode).toBe('symbolic-only');
    expect(result.summary.durationMs).toBe(1234);
  });

  it('calculates compliance percentage correctly', () => {
    const spec = makeSpec([
      { id: functionId('FF-01'), name: 'a', enabled: true },
      { id: functionId('FF-02'), name: 'b', enabled: true },
    ]);
    // No violations = 100% compliance
    const result = buildDashboardData(makeReport(), spec, makeAPGResult(), [], 'test');
    expect(result.summary.compliancePercentage).toBe(100);
  });
});
