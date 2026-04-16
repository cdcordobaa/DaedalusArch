import { compileFunctions, filterEnabled } from '../../../src/fitness-compiler/fitness-compiler.js';
import { functionId } from '../../../src/shared/types/value-objects.js';
import type { FitnessFunction, LayerModel } from '../../../src/shared/types/spec.js';
import type { CompilerInput } from '../../../src/fitness-compiler/types.js';

const LAYER_MODEL: LayerModel = {
  layers: [
    { name: 'domain', directories: ['src/domain/**'], naming: [], role: 'entity' },
    { name: 'application', directories: ['src/application/**'], naming: [], role: 'use-case' },
    { name: 'infrastructure', directories: ['src/infrastructure/**'], naming: [], role: 'controller' },
  ],
};

const enabledFn: FitnessFunction = {
  id: functionId('FF-S01'),
  name: 'dependency-direction',
  dimension: 'structural',
  severity: 'critical',
  route: 'symbolic',
  isBuiltIn: true,
  validated: true,
  enabled: true,
  excludePaths: [],
};

const disabledFn: FitnessFunction = {
  id: functionId('FF-S03'),
  name: 'no-layer-skip',
  dimension: 'structural',
  severity: 'critical',
  route: 'symbolic',
  isBuiltIn: true,
  validated: false,
  enabled: false,
  excludePaths: [],
  disabledReason: '3-layer architecture — all cross-layer imports are adjacent',
};

const fnWithExcludes: FitnessFunction = {
  id: functionId('FF-C02'),
  name: 'module-fan-out',
  dimension: 'coupling',
  severity: 'major',
  route: 'symbolic',
  isBuiltIn: true,
  validated: true,
  enabled: true,
  excludePaths: ['src/pipeline/pipeline-factory.ts', 'src/cli/**'],
  threshold: 10,
};

describe('filterEnabled', () => {
  it('separates enabled and disabled functions', () => {
    const result = filterEnabled([enabledFn, disabledFn]);
    expect(result.enabled).toHaveLength(1);
    expect(result.disabled).toHaveLength(1);
    expect(result.disabled[0]!.reason).toBe('3-layer architecture — all cross-layer imports are adjacent');
  });

  it('treats functions without enabled field as enabled', () => {
    const result = filterEnabled([enabledFn]);
    expect(result.enabled).toHaveLength(1);
    expect(result.disabled).toHaveLength(0);
  });
});

describe('compileFunctions with v1.1 extensions', () => {
  it('excludes disabled functions from compilation', () => {
    const input: CompilerInput = {
      fitnessFunctions: [enabledFn, disabledFn],
      adrRules: [],
      layerModel: LAYER_MODEL,
      scoringWeights: { structural: 1, coupling: 0, pattern: 0, solid: 0, convention: 0, semantic: 0, intent: 0 },
    };
    const result = compileFunctions(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.symbolicQueries).toHaveLength(1);
      expect(result.data.disabledFunctions).toHaveLength(1);
      expect(String(result.data.disabledFunctions[0]!.id)).toBe('FF-S03');
    }
  });

  it('injects exclude paths into compiled Cypher', () => {
    const input: CompilerInput = {
      fitnessFunctions: [fnWithExcludes],
      adrRules: [],
      layerModel: LAYER_MODEL,
      scoringWeights: { structural: 0, coupling: 1, pattern: 0, solid: 0, convention: 0, semantic: 0, intent: 0 },
    };
    const result = compileFunctions(input);
    expect(result.success).toBe(true);
    if (result.success) {
      const query = result.data.symbolicQueries[0]!;
      expect(query.cypher).toContain('NONE(ep IN $excludePatterns');
      expect(query.params).toHaveProperty('excludePatterns');
      const patterns = query.params['excludePatterns'] as string[];
      expect(patterns).toHaveLength(2);
    }
  });

  it('does not inject exclude paths when array is empty', () => {
    const input: CompilerInput = {
      fitnessFunctions: [enabledFn],
      adrRules: [],
      layerModel: LAYER_MODEL,
      scoringWeights: { structural: 1, coupling: 0, pattern: 0, solid: 0, convention: 0, semantic: 0, intent: 0 },
    };
    const result = compileFunctions(input);
    expect(result.success).toBe(true);
    if (result.success) {
      const query = result.data.symbolicQueries[0]!;
      expect(query.cypher).not.toContain('excludePatterns');
    }
  });

  it('backward compat: compiles v1.0 functions unchanged', () => {
    const input: CompilerInput = {
      fitnessFunctions: [enabledFn],
      adrRules: [],
      layerModel: LAYER_MODEL,
      scoringWeights: { structural: 1, coupling: 0, pattern: 0, solid: 0, convention: 0, semantic: 0, intent: 0 },
    };
    const result = compileFunctions(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totalCompiled).toBe(1);
      expect(result.data.disabledFunctions).toHaveLength(0);
    }
  });
});
