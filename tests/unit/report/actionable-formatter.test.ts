import { formatActionableViolation, formatAllActionableViolations } from '../../../src/report/actionable-formatter.js';
import { functionId } from '../../../src/shared/types/value-objects.js';
import type { Violation } from '../../../src/shared/taxonomy/violation-types.js';
import type { FitnessFunction } from '../../../src/shared/types/spec.js';
import type { BaselineResult } from '../../../src/shared/types/baseline.js';

function makeViolation(overrides: Partial<Violation> = {}): Violation {
  return {
    id: 'v-001',
    type: 'LAYER_VIOLATION',
    dimension: 'structural',
    severity: 'major',
    functionId: functionId('FF-S01'),
    route: 'symbolic',
    filePath: 'src/domain/UserService.ts',
    message: 'Layer violation detected',
    deterministic: true,
    ...overrides,
  };
}

function makeFitnessFunction(overrides: Partial<FitnessFunction> = {}): FitnessFunction {
  return {
    id: functionId('FF-S01'),
    name: 'dependency-direction',
    dimension: 'structural',
    severity: 'major',
    route: 'symbolic',
    isBuiltIn: true,
    validated: true,
    enabled: true,
    excludePaths: [],
    ...overrides,
  };
}

describe('formatActionableViolation', () => {
  it('produces What/Where/Why/Fix fields', () => {
    const violation = makeViolation();
    const ff = makeFitnessFunction();
    const result = formatActionableViolation(violation, [ff]);

    expect(result.what).toContain('[major]');
    expect(result.what).toContain('FF-S01');
    expect(result.what).toContain('dependency-direction');
    expect(result.what).toContain('structural');
    expect(result.where).toBe('src/domain/UserService.ts');
    expect(result.why).toContain('layer');
    expect(result.fix).toContain('interface');
  });

  it('includes line number from evidence when available', () => {
    const violation = makeViolation({
      evidence: ['imports from infrastructure at line 42'],
    });
    const result = formatActionableViolation(violation, [makeFitnessFunction()]);
    expect(result.where).toBe('src/domain/UserService.ts:42');
  });

  it('uses file path alone when no line number in evidence', () => {
    const violation = makeViolation({ evidence: ['some evidence'] });
    const result = formatActionableViolation(violation, [makeFitnessFunction()]);
    expect(result.where).toBe('src/domain/UserService.ts');
  });

  it('includes source/target layer info in why field', () => {
    const violation = makeViolation({
      sourceLayer: 'domain',
      targetLayer: 'infrastructure',
    });
    const result = formatActionableViolation(violation, [makeFitnessFunction()]);
    expect(result.why).toContain('domain');
    expect(result.why).toContain('infrastructure');
  });

  it('defaults baselineStatus to none when no baseline result', () => {
    const result = formatActionableViolation(makeViolation(), [makeFitnessFunction()]);
    expect(result.baselineStatus).toBe('none');
  });

  it('marks violation as baseline when found in baseline result', () => {
    const violation = makeViolation();
    const baseline: BaselineResult = {
      baselineViolations: [violation],
      newViolations: [],
      removedFromBaseline: [],
      baselineFilePath: '.firewall-baseline.json',
    };
    const result = formatActionableViolation(violation, [makeFitnessFunction()], baseline);
    expect(result.baselineStatus).toBe('baseline');
  });

  it('marks violation as new when not in baseline', () => {
    const violation = makeViolation();
    const baseline: BaselineResult = {
      baselineViolations: [],
      newViolations: [violation],
      removedFromBaseline: [],
      baselineFilePath: '.firewall-baseline.json',
    };
    const result = formatActionableViolation(violation, [makeFitnessFunction()], baseline);
    expect(result.baselineStatus).toBe('new');
  });

  it('handles unknown violation types gracefully', () => {
    const violation = makeViolation({ type: 'CUSTOM_MY_RULE' as any });
    const result = formatActionableViolation(violation, []);
    expect(result.why).toBe(violation.message);
    expect(result.fix).toContain('Review');
  });

  it('falls back to type-based name when no fitness function matches', () => {
    const violation = makeViolation({ functionId: functionId('FF-UNKNOWN') });
    const result = formatActionableViolation(violation, [makeFitnessFunction()]);
    expect(result.what).toContain('layer-violation');
  });

  it('preserves all original violation fields', () => {
    const violation = makeViolation();
    const result = formatActionableViolation(violation, [makeFitnessFunction()]);
    expect(result.id).toBe(violation.id);
    expect(result.type).toBe(violation.type);
    expect(result.dimension).toBe(violation.dimension);
    expect(result.severity).toBe(violation.severity);
    expect(result.filePath).toBe(violation.filePath);
    expect(result.functionId).toBe(violation.functionId);
  });
});

describe('formatAllActionableViolations', () => {
  it('transforms all violations', () => {
    const violations: Violation[] = [
      makeViolation({ id: 'v1' }),
      makeViolation({ id: 'v2', type: 'FAN_OUT_EXCEEDED', dimension: 'coupling' }),
    ];
    const ffs = [makeFitnessFunction()];
    const result = formatAllActionableViolations(violations, ffs);
    expect(result).toHaveLength(2);
    expect(result[0]!.what).toContain('[major]');
    expect(result[1]!.what).toContain('[major]');
  });

  it('returns empty array for no violations', () => {
    const result = formatAllActionableViolations([], []);
    expect(result).toEqual([]);
  });
});
