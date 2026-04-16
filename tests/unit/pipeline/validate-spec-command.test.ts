import { ValidateSpecCommand } from '../../../src/pipeline/commands/validate-spec-command.js';
import { FirewallContext } from '../../../src/shared/context/firewall-context.js';
import { runId, functionId } from '../../../src/shared/types/value-objects.js';
import type { ParsedSpec } from '../../../src/shared/types/spec.js';

function makeSpec(overrides: Partial<ParsedSpec> = {}): ParsedSpec {
  return {
    specVersion: '1.0.0',
    layerModel: {
      layers: [
        { name: 'domain', directories: ['src/domain/**'], naming: [], role: 'entity' },
        { name: 'infrastructure', directories: ['src/infrastructure/**'], naming: [], role: 'controller' },
      ],
    },
    fitnessFunctions: [
      {
        id: functionId('FF-S01'),
        name: 'dependency-direction',
        dimension: 'structural',
        severity: 'critical',
        route: 'symbolic',
        isBuiltIn: true,
        validated: true,
        enabled: true,
        excludePaths: [],
      },
    ],
    scoringWeights: { structural: 0.35, coupling: 0.20, pattern: 0.30, solid: 0.10, convention: 0.05, semantic: 0, intent: 0 },
    verdictThresholds: { pass: 0.80, warning: 0.65, softBlock: 0.50 },
    confidenceThresholds: { high: 0.85, medium: 0.60, iccMinimum: 0.70 },
    adrRules: [],
    ...overrides,
  };
}

describe('ValidateSpecCommand', () => {
  it('succeeds with valid spec against project root', async () => {
    const context = new FirewallContext(runId('test-run'));
    context.setParsedSpec(makeSpec({
      layerModel: {
        layers: [
          { name: 'src', directories: ['src/**'], naming: [], role: 'any' },
          { name: 'tests', directories: ['tests/**'], naming: [], role: 'any' },
        ],
      },
    }));

    const command = new ValidateSpecCommand('.');
    const result = await command.execute(context);
    expect(result.success).toBe(true);
  });

  it('fails when layer directories do not exist', async () => {
    const context = new FirewallContext(runId('test-run'));
    context.setParsedSpec(makeSpec({
      layerModel: {
        layers: [
          { name: 'domain', directories: ['nonexistent-dir/**'], naming: [], role: 'entity' },
          { name: 'infra', directories: ['also-nonexistent/**'], naming: [], role: 'controller' },
        ],
      },
    }));

    const command = new ValidateSpecCommand('.');
    const result = await command.execute(context);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.some((e) => e.code === 'LAYER_DIR_NOT_FOUND')).toBe(true);
  });
});
