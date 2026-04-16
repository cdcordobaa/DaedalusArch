import { generateReport } from '../../../src/report/report-generator.js';
import { functionId, runId, ahsScore, avrScore } from '../../../src/shared/types/value-objects.js';
import type { EvaluationReport } from '../../../src/shared/types/evaluation.js';
import type { ParsedSpec } from '../../../src/shared/types/spec.js';
import type { APGResult } from '../../../src/shared/types/apg.js';
import type { ReportInput } from '../../../src/report/types.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

function makeReportInput(outputPath: string): ReportInput {
  const report: EvaluationReport = {
    runId: runId('run-test'),
    projectPath: '/test/project',
    specVersion: '1.0.0',
    ahsDeterministic: ahsScore(0.85),
    verdict: 'pass',
    perDimensionScores: [
      { dimension: 'structural', avr: avrScore(0.1), weight: 0.35, violationCount: 1, functionCount: 3 },
    ],
    violations: [
      {
        id: 'v1', type: 'LAYER_VIOLATION', dimension: 'structural',
        severity: 'major', functionId: functionId('FF-S01'), route: 'symbolic',
        filePath: 'src/domain/User.ts', message: 'Layer violation', deterministic: true,
      },
    ],
    universalMetrics: {
      cyclicDependencyCount: 0, maxFanOut: 5, maxFanIn: 8,
      abstractionRatio: 0.3, averageInstability: 0.45, orphanFileCount: 0,
    },
    evaluationMode: 'symbolic-only',
    durationMs: 500,
    warnings: [],
  };

  const spec: ParsedSpec = {
    specVersion: '1.0.0',
    layerModel: {
      layers: [
        { name: 'domain', directories: ['src/domain/'], naming: [], role: 'domain' },
        { name: 'infrastructure', directories: ['src/infra/'], naming: [], role: 'infrastructure' },
      ],
    },
    fitnessFunctions: [
      {
        id: functionId('FF-S01'), name: 'dependency-direction',
        dimension: 'structural', severity: 'major', route: 'symbolic',
        isBuiltIn: true, validated: true, enabled: true, excludePaths: [],
      },
    ],
    scoringWeights: { structural: 0.35, coupling: 0.2, pattern: 0.3, solid: 0.1, convention: 0.05, semantic: 0, intent: 0 },
    verdictThresholds: { pass: 0.8, warning: 0.65, softBlock: 0.5 },
    confidenceThresholds: { high: 0.85, medium: 0.6, iccMinimum: 0.7 },
    adrRules: [],
  };

  const apgResult: APGResult = {
    nodes: [
      { id: 'n1', type: 'File', filePath: 'src/domain/User.ts', name: 'User.ts', layer: 'domain', decorators: [], properties: {} },
      { id: 'n2', type: 'File', filePath: 'src/infra/UserRepo.ts', name: 'UserRepo.ts', layer: 'infrastructure', decorators: [], properties: {} },
    ],
    edges: [
      { id: 'e1', type: 'IMPORTS', sourceId: 'n1', targetId: 'n2', properties: {} },
    ],
    parseCoverage: { total: 2, parsed: 2, percentage: 100, skipped: [] },
    warnings: [],
  };

  return {
    evaluationReport: report,
    parsedSpec: spec,
    apgResult,
    projectName: 'test-project',
    specFilePath: 'firewall.spec.yaml',
    outputPath,
  };
}

describe('generateReport', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'firewall-report-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('generates a valid HTML file', () => {
    const outputPath = path.join(tmpDir, 'report.html');
    const input = makeReportInput(outputPath);
    const result = generateReport(input);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.outputPath).toBe(outputPath);
    expect(fs.existsSync(outputPath)).toBe(true);

    const html = fs.readFileSync(outputPath, 'utf-8');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Architectonic Firewall');
  });

  it('embeds dashboard data as JSON in the HTML', () => {
    const outputPath = path.join(tmpDir, 'report.html');
    const result = generateReport(makeReportInput(outputPath));

    expect(result.success).toBe(true);
    if (!result.success) return;

    const html = result.data.htmlContent;
    expect(html).toContain('"productName":"Architectonic Firewall"');
    expect(html).toContain('"projectName":"test-project"');
    expect(html).toContain('"verdict":"pass"');
  });

  it('embeds graph data in the HTML', () => {
    const outputPath = path.join(tmpDir, 'report.html');
    const result = generateReport(makeReportInput(outputPath));

    expect(result.success).toBe(true);
    if (!result.success) return;

    const html = result.data.htmlContent;
    expect(html).toContain('"nodes"');
    expect(html).toContain('"edges"');
    expect(html).toContain('"layerColors"');
  });

  it('includes CDN references for Tailwind and Cytoscape', () => {
    const outputPath = path.join(tmpDir, 'report.html');
    const result = generateReport(makeReportInput(outputPath));

    expect(result.success).toBe(true);
    if (!result.success) return;

    const html = result.data.htmlContent;
    expect(html).toContain('cdn.tailwindcss.com');
    expect(html).toContain('cytoscape');
    expect(html).toContain('dagre');
  });

  it('includes actionable violation data', () => {
    const outputPath = path.join(tmpDir, 'report.html');
    const result = generateReport(makeReportInput(outputPath));

    expect(result.success).toBe(true);
    if (!result.success) return;

    const html = result.data.htmlContent;
    expect(html).toContain('dependency-direction');
    expect(html).toContain('FF-S01');
  });

  it('reports sections rendered', () => {
    const outputPath = path.join(tmpDir, 'report.html');
    const result = generateReport(makeReportInput(outputPath));

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.sections).toContain('header');
    expect(result.data.sections).toContain('ahs-score');
    expect(result.data.sections).toContain('architecture-map');
    expect(result.data.sections).toContain('fitness-functions');
    expect(result.data.sections).toContain('violations-explorer');
    expect(result.data.sections).toContain('summary-stats');
  });

  it('includes baseline-split section when baseline provided', () => {
    const outputPath = path.join(tmpDir, 'report.html');
    const input = makeReportInput(outputPath);
    const inputWithBaseline: ReportInput = {
      ...input,
      baselineResult: {
        baselineViolations: [],
        newViolations: [],
        removedFromBaseline: [],
        baselineFilePath: '.firewall-baseline.json',
      },
    };
    const result = generateReport(inputWithBaseline);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.sections).toContain('baseline-split');
  });

  it('has data-testid attributes for all dashboard sections', () => {
    const outputPath = path.join(tmpDir, 'report.html');
    const result = generateReport(makeReportInput(outputPath));

    expect(result.success).toBe(true);
    if (!result.success) return;

    const html = result.data.htmlContent;
    expect(html).toContain('data-testid="report-header"');
    expect(html).toContain('data-testid="ahs-section"');
    expect(html).toContain('data-testid="graph-section"');
    expect(html).toContain('data-testid="fitness-section"');
    expect(html).toContain('data-testid="violations-section"');
    expect(html).toContain('data-testid="baseline-section"');
    expect(html).toContain('data-testid="summary-section"');
  });
});
