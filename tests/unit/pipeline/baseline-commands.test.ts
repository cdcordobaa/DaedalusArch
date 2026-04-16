import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { CreateBaselineCommand } from '../../../src/pipeline/commands/create-baseline-command.js';
import { CompareBaselineCommand } from '../../../src/pipeline/commands/compare-baseline-command.js';
import type { SharedBaselineState } from '../../../src/pipeline/commands/compare-baseline-command.js';
import { FirewallContext } from '../../../src/shared/context/firewall-context.js';
import type { EvaluationReport } from '../../../src/shared/types/evaluation.js';
import type { Violation } from '../../../src/shared/taxonomy/violation-types.js';
import { runId, functionId, ahsScore, avrScore } from '../../../src/shared/types/value-objects.js';
import { createBaseline, saveBaseline } from '../../../src/baseline/index.js';

function makeReport(violations: Violation[]): EvaluationReport {
  return {
    runId: runId('test-run'),
    projectPath: '/test/project',
    specVersion: '1.0.0',
    ahsDeterministic: ahsScore(0.75),
    verdict: 'warning',
    perDimensionScores: [
      { dimension: 'structural', avr: avrScore(0.8), weight: 0.35, violationCount: 1, functionCount: 2 },
    ],
    violations,
    universalMetrics: {
      cyclicDependencyCount: 0,
      maxFanOut: 5,
      maxFanIn: 3,
      abstractionRatio: 0.4,
      averageInstability: 0.5,
      orphanFileCount: 0,
    },
    evaluationMode: 'symbolic-only',
    durationMs: 100,
    warnings: [],
  };
}

function makeViolation(overrides: Partial<Violation> = {}): Violation {
  return {
    id: 'v-001',
    type: 'LAYER_VIOLATION',
    dimension: 'structural',
    severity: 'critical',
    functionId: functionId('FF-S01'),
    route: 'symbolic',
    filePath: 'src/domain/service.ts',
    message: 'Domain imports from infrastructure',
    deterministic: true,
    ...overrides,
  };
}

describe('CreateBaselineCommand', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-cmd-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates a baseline file from report violations', async () => {
    const violation = makeViolation();
    const context = new FirewallContext(runId('test-run'));
    // Manually set report via the context setter
    (context as unknown as { _report: EvaluationReport })._report = makeReport([violation]);

    const outputPath = path.join(tmpDir, 'baseline.json');
    const command = new CreateBaselineCommand('spec.yaml', outputPath);
    const result = await command.execute(context);

    expect(result.success).toBe(true);
    expect(fs.existsSync(outputPath)).toBe(true);

    const content = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    expect(content.version).toBe('1.0');
    expect(content.totalViolations).toBe(1);
  });
});

describe('CompareBaselineCommand', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'compare-cmd-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('compares current violations against baseline', async () => {
    const existingViolation = makeViolation({ id: 'v-001', filePath: 'src/a.ts' });
    const newViolation = makeViolation({ id: 'v-002', filePath: 'src/b.ts' });

    // Create and save baseline with just the existing violation
    const snapshot = createBaseline([existingViolation], 'spec.yaml');
    const baselinePath = path.join(tmpDir, 'baseline.json');
    saveBaseline(snapshot, baselinePath);

    // Context has report with both existing and new violations
    const context = new FirewallContext(runId('test-run'));
    (context as unknown as { _report: EvaluationReport })._report = makeReport([existingViolation, newViolation]);

    const sharedState: SharedBaselineState = {};
    const command = new CompareBaselineCommand(baselinePath, sharedState);
    const result = await command.execute(context);

    expect(result.success).toBe(true);
    expect(sharedState.baselineResult).toBeDefined();
    expect(sharedState.baselineResult!.baselineViolations).toHaveLength(1);
    expect(sharedState.baselineResult!.newViolations).toHaveLength(1);
  });

  it('fails when baseline file does not exist', async () => {
    const context = new FirewallContext(runId('test-run'));
    (context as unknown as { _report: EvaluationReport })._report = makeReport([]);

    const sharedState: SharedBaselineState = {};
    const command = new CompareBaselineCommand('/nonexistent/baseline.json', sharedState);
    const result = await command.execute(context);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors[0]?.code).toBe('BASELINE_NOT_FOUND');
  });
});
