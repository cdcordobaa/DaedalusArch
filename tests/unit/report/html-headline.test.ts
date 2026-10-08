/**
 * U3-R13 (C13; FR-13, FR-15, FR-23, FR-29; BR-U3-43 headline, BR-U3-84; TF-25): HTML report and
 * formatters read the assembled report: verdict-source headline, absent variants `n/a`, judge from
 * `report.judge`, failures and dropped dimensions listed, cards grouped by the BR-U3-54 key.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vm from 'node:vm';
import { buildDashboardData } from '../../../src/report/dashboard-data-builder.js';
import { generateReport, scriptJson } from '../../../src/report/report-generator.js';
import { CARD_GROUP_ORDER } from '../../../src/report/types.js';
import { csvHeader, formatActionableHuman, formatCSV, formatHuman } from '../../../src/scoring-engine/report-formatter.js';
import { ahsScore, avrScore, functionId, runId } from '../../../src/shared/types/value-objects.js';
import type { EvaluationReport, PerDimensionScore } from '../../../src/shared/types/evaluation.js';
import type { FitnessFunction, ParsedSpec } from '../../../src/shared/types/spec.js';
import type { APGResult } from '../../../src/shared/types/apg.js';

const REPO = path.join(__dirname, '../../..');

function makeReport(overrides: Partial<EvaluationReport> = {}): EvaluationReport {
  return {
    runId: runId('run-r13'),
    projectPath: '/test/project',
    specVersion: '1.0.0',
    ahsDeterministic: ahsScore(0.85),
    verdict: 'pass',
    perDimensionScores: [
      { dimension: 'structural', avr: avrScore(0.1), violatedWeight: 0.5, weight: 0.35, effectiveWeight: 0.35, violationCount: 2, functionCount: 5 },
    ] as readonly PerDimensionScore[],
    violations: [],
    universalMetrics: { cyclicDependencyCount: 0, maxFanOut: 5, maxFanIn: 8, abstractionRatio: null, averageInstability: 0.45, orphanFileCount: 2 },
    evaluationMode: 'symbolic-only',
    durationMs: 1234,
    warnings: [],
    scoring: {
      weights: { structural: 0.35, coupling: 0.2, pattern: 0.3, solid: 0.1, convention: 0.05, semantic: 0, integrity: 0 },
      thresholds: { pass: 0.8, warning: 0.65, softBlock: 0.5 },
      confidenceThresholds: { high: 0.85, medium: 0.6, iccMinimum: 0.7 },
      verdictSource: 'ahsDeterministic',
    },
    functionExecution: { declared: 0, adrDerived: 0, compiled: 0, disabled: 0, dropped: [], skippedByMode: 0, noJudgeUnits: [], executed: 0, failed: [] },
    functionResults: [],
    disabledFunctions: [],
    graphStats: { nodeCount: 0, edgeCount: 0, layerCoverage: 0, nodeCountByType: {}, edgeCountByType: {} },
    layerAnnotation: { mapped: 0, unmapped: 0, unmappedFiles: [] },
    parseCoverage: { total: 0, parsed: 0, percentage: 0, skipped: [] },
    importResolution: { resolvedInternal: 0, external: 0, unresolved: 0, unsupportedDynamic: 0, externalOutOfRootAlias: 0, droppedNoFileNode: 0 },
    timings: { stages: [], totalMs: 0 },
    droppedDimensions: [],
    judge: { provider: 'none', model: 'none', runsPerUnit: 0 },
    ...overrides,
  };
}

/** TF-25: a neuronal-only report (no `ahsDeterministic`, headline `ahsNeuronal`). */
function neuronalOnlyReport(): EvaluationReport {
  const { ahsDeterministic: _omit, ...rest } = makeReport({
    evaluationMode: 'neuronal-only',
    ahsNeuronal: ahsScore(0.6125),
    verdict: 'soft-block',
    scoring: { ...makeReport().scoring, fullModeWeights: { structural: 0.2, coupling: 0.1, pattern: 0.2, solid: 0.1, convention: 0.05, semantic: 0.2, integrity: 0.15 }, verdictSource: 'ahsNeuronal' },
    perDimensionScores: [
      { dimension: 'semantic', avr: avrScore(0.4), violatedWeight: 0.4, weight: 0.2, effectiveWeight: 0.57, violationCount: 2, functionCount: 5 },
      { dimension: 'integrity', avr: avrScore(0.35), violatedWeight: 0.35, weight: 0.15, effectiveWeight: 0.43, violationCount: 1, functionCount: 3 },
    ] as readonly PerDimensionScore[],
    judge: { provider: 'claude-cli', model: 'judge-model-x', runsPerUnit: 3, cassetteMode: 'replay' },
  });
  return rest;
}

function makeSpec(ffs: Partial<FitnessFunction>[]): ParsedSpec {
  return {
    specVersion: '1.0.0',
    layerModel: { layers: [{ name: 'domain', directories: ['src/domain/'], naming: [], role: 'domain' }] },
    fitnessFunctions: ffs.map((ff) => ({
      id: functionId('FF-S01'), name: 'dependency-direction', dimension: 'structural' as const, severity: 'major' as const,
      route: 'symbolic' as const, isBuiltIn: true, validated: true, enabled: true, excludePaths: [], ...ff,
    })),
    scoringWeights: { structural: 0.35, coupling: 0.2, pattern: 0.3, solid: 0.1, convention: 0.05, semantic: 0, integrity: 0 },
    verdictThresholds: { pass: 0.8, warning: 0.65, softBlock: 0.5 },
    confidenceThresholds: { high: 0.85, medium: 0.6, iccMinimum: 0.7 },
    adrRules: [],
  };
}

const APG: APGResult = {
  nodes: [{ id: 'f1', type: 'File', filePath: 'src/domain/a.ts', name: 'a.ts', layer: 'domain', decorators: [], properties: {} }],
  edges: [],
  parseCoverage: { total: 1, parsed: 1, percentage: 100, skipped: [] },
  warnings: [],
  importResolution: { resolvedInternal: 0, external: 0, unresolved: 0, unsupportedDynamic: 0, externalOutOfRootAlias: 0, droppedNoFileNode: 0 },
};

describe('TF-25: neuronal-only report through the human, CSV and dashboard formatters (BR-U3-43)', () => {
  const report = neuronalOnlyReport();

  it('human: headline ahsNeuronal, ahsDeterministic n/a, no NaN', () => {
    for (const text of [formatHuman(report), formatActionableHuman(report, [])]) {
      expect(text).not.toContain('NaN');
      expect(text).toContain('Architectural Health Score: 0.61 (SOFT-BLOCK)');
      expect(text).toContain('Headline AHS:        ahsNeuronal');
      expect(text).toContain('AHS (deterministic): n/a');
      expect(text).toContain('AHS (combined):      n/a');
      expect(text).toContain('AHS (neuronal):      0.61');
    }
  });

  it('CSV: headline column ahsNeuronal, absent variants and dimensions n/a, header and row widths agree', () => {
    const header = csvHeader().split(',');
    const row = formatCSV(report).split(',');
    expect(row).toHaveLength(header.length);
    const cell = (name: string): string | undefined => row[header.indexOf(name)];
    expect(formatCSV(report)).not.toContain('NaN');
    expect([cell('ahs'), cell('verdict_source'), cell('ahs_deterministic'), cell('ahs_combined'), cell('ahs_neuronal')])
      .toEqual(['0.613', 'ahsNeuronal', 'n/a', 'n/a', '0.613']);
    expect([cell('avr_semantic'), cell('avr_integrity'), cell('avr_structural')]).toEqual(['0.400', '0.350', 'n/a']);
    expect(cell('abstraction_ratio')).toBe('n/a');
    expect(header).not.toContain('avr_intent');
  });

  it('dashboard data: headline ahsNeuronal, deterministic null, symbolic AHS null, no NaN anywhere', () => {
    const d = buildDashboardData(report, makeSpec([]), APG, [], 'p');
    expect({ headline: d.ahsScore.headline, source: d.ahsScore.headlineSource, det: d.ahsScore.deterministic, sym: d.dualScore.symbolicAhs, delta: d.dualScore.delta })
      .toEqual({ headline: 0.6125, source: 'ahsNeuronal', det: null, sym: null, delta: undefined });
    expect(JSON.stringify(d)).not.toContain('NaN');
    expect(JSON.stringify(d).includes('null')).toBe(true);
  });
});

describe('dashboard data (BR-U3-84)', () => {
  it('a report with one failure and one dropped dimension carries both', () => {
    const failure = { functionId: functionId('FF-C01'), name: 'module-fan-out', code: 'EVAL_002', message: 'Query failed for FF-C01 (module-fan-out): timed out' };
    const dropped = { dimension: 'semantic' as const, reason: 'no-judge-units' as const, declared: 2, executed: 0 };
    const report = makeReport({
      functionExecution: { ...makeReport().functionExecution, failed: [failure] },
      droppedDimensions: [dropped],
    });
    const d = buildDashboardData(report, makeSpec([{ id: functionId('FF-C01'), name: 'module-fan-out', dimension: 'coupling' }]), APG, [], 'p');
    expect(d.completeness).toEqual({ failed: [failure], droppedDimensions: [dropped] });
    expect(d.fitnessFunctions.map((c) => [c.id, c.status, c.passed])).toEqual([['FF-C01', 'failed', false]]);
  });

  it('judge provider and model come from report.judge, not the environment', () => {
    const saved = process.env.GEMINI_MODEL;
    process.env.GEMINI_MODEL = 'env-model-must-not-appear';
    try {
      const d = buildDashboardData(neuronalOnlyReport(), makeSpec([]), APG, [], 'p');
      expect([d.pipelineTrace.judgeProvider, d.pipelineTrace.judgeModel]).toEqual(['claude-cli', 'judge-model-x']);
      expect(JSON.stringify(d)).not.toContain('env-model-must-not-appear');
    } finally {
      if (saved === undefined) delete process.env.GEMINI_MODEL;
      else process.env.GEMINI_MODEL = saved;
    }
  });

  it('cards are grouped and ordered by the BR-U3-54 key (tag rank, then id); pass/fail from functionResults', () => {
    const row = (id: string, tag: 'structural' | 'topological' | 'pattern-proxy' | undefined, route: 'symbolic' | 'neuronal' | 'hybrid', passed: boolean) => ({
      functionId: functionId(id), name: id, dimension: 'structural' as const, route, passed, violationCount: passed ? 0 : 1, executionTimeMs: 1, truncated: false,
      ...(tag !== undefined ? { tag } : {}),
    });
    const report = makeReport({
      functionResults: [row('FF-S01', 'structural', 'symbolic', true), row('FF-S02', 'topological', 'symbolic', false), row('FF-P01', 'pattern-proxy', 'hybrid', true), row('FF-N01', undefined, 'neuronal', true)],
    });
    const spec = makeSpec([
      { id: functionId('FF-N01'), name: 'semantic-check', route: 'neuronal', dimension: 'semantic' },
      { id: functionId('FF-P01'), name: 'domain-purity', route: 'hybrid', dimension: 'pattern' },
      { id: functionId('FF-S02'), name: 'no-cyclic-deps' },
      { id: functionId('FF-S01'), name: 'dependency-direction' },
      { id: functionId('FF-S03'), name: 'no-layer-skip' },
    ]);
    const d = buildDashboardData(report, spec, APG, [], 'p');
    expect(d.fitnessFunctions.map((c) => [c.id, c.group, c.status, c.passed])).toEqual([
      ['FF-S01', 'structural', 'executed', true],
      ['FF-S03', 'structural', 'not-run', true],
      ['FF-S02', 'topological', 'executed', false],
      ['FF-P01', 'pattern-proxy', 'executed', true],
      ['FF-N01', 'neural', 'executed', true],
    ]);
    expect(CARD_GROUP_ORDER.slice(0, 4)).toEqual(['structural', 'topological', 'pattern-proxy', 'neural']);
  });
});

describe('HTML report (BR-U3-84)', () => {
  let dir: string;
  beforeAll(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'u3-r13-html-')); });
  afterAll(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  function html(report: EvaluationReport): string {
    const result = generateReport({ evaluationReport: report, parsedSpec: makeSpec([]), apgResult: APG, projectName: 'p', specFilePath: 's.yaml', outputPath: path.join(dir, 'r.html') });
    if (!result.success) throw new Error('generateReport failed');
    return result.data.htmlContent;
  }

  it('inline scripts compile; the completeness section and headline source are present; no provider literal', () => {
    const failure = { functionId: functionId('FF-C01'), name: 'module-fan-out', code: 'EVAL_001', message: 'bad </script><b>x</b>' };
    const text = html({ ...neuronalOnlyReport(), functionExecution: { ...makeReport().functionExecution, failed: [failure] } });
    const scripts = [...text.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1] ?? '');
    expect(scripts.length).toBeGreaterThan(0);
    for (const s of scripts) expect(() => new vm.Script(s)).not.toThrow();
    expect(text).toContain('data-testid="completeness-section"');
    expect(text).toContain('data-testid="ahs-headline-source"');
    expect(text).toContain('data-testid="fitness-groups"');
    expect(text).not.toContain('</script><b>');
    expect(text).toContain('"headlineSource":"ahsNeuronal"');
    expect(text).not.toContain('Gemini');
  });

  it('scriptJson escapes < and keeps $ patterns literal', () => {
    expect(scriptJson({ m: '</script> $& $1' })).toBe('{"m":"\\u003c/script> $& $1"}');
  });
});

describe('static (BR-U3-43, BR-U3-84)', () => {
  const read = (p: string): string => fs.readFileSync(path.join(REPO, p), 'utf8');
  const reportFiles = fs.readdirSync(path.join(REPO, 'src/report')).filter((f) => f.endsWith('.ts')).map((f) => `src/report/${f}`);

  it('no GEMINI_MODEL or avr_intent in src/report and the formatter; no Gemini in html-template.ts', () => {
    const files = [...reportFiles, 'src/scoring-engine/report-formatter.ts'];
    expect(files.filter((f) => /GEMINI_MODEL|avr_intent/.test(read(f)))).toEqual([]);
    expect(read('src/report/html-template.ts').includes('Gemini')).toBe(false);
  });

  it('no Number(report.ahsDeterministic) in the formatter or the dashboard builder', () => {
    expect(['src/scoring-engine/report-formatter.ts', 'src/report/dashboard-data-builder.ts'].filter((f) => read(f).includes('Number(report.ahsDeterministic)'))).toEqual([]);
  });

  it('the HTML path performs no warning merge of its own', () => {
    expect(reportFiles.filter((f) => read(f).includes('mergeWarnings('))).toEqual([]);
  });
});
