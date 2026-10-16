import { compileFunctions } from '../../../src/fitness-compiler/fitness-compiler.js';
import { CYPHER_TEMPLATES } from '../../../src/fitness-compiler/cypher-templates.js';
import { V13_CYPHER_TEMPLATES } from '../../../src/fitness-compiler/v13-templates.js';
import type { CompilerInput } from '../../../src/fitness-compiler/types.js';
import type { FitnessFunction, LayerModel } from '../../../src/shared/types/spec.js';
import type { FunctionId } from '../../../src/shared/types/value-objects.js';

const NAME = 'module-domain-imports-infrastructure';

const layerModel = {
  layers: [
    { name: 'domain', kind: 'domain', kindSource: 'declared', patterns: [], filePatterns: [] },
    { name: 'infrastructure', kind: 'infrastructure', kindSource: 'declared', patterns: [], filePatterns: [] },
  ],
} as unknown as LayerModel;

const ff = {
  id: 'FF-V13-01' as FunctionId,
  name: NAME,
  dimension: 'structural',
  severity: 'major',
  route: 'symbolic',
  excludePaths: [],
  enabled: true,
} as unknown as FitnessFunction;

const input: CompilerInput = {
  fitnessFunctions: [ff],
  adrRules: [],
  layerModel,
  scoringWeights: {} as CompilerInput['scoringWeights'],
  style: 'nestjs',
};

describe('v1.3 module-wiring template (flag-gated)', () => {
  it('is not in the frozen v1.2E catalogue', () => {
    expect(CYPHER_TEMPLATES.has(NAME)).toBe(false);
    expect(CYPHER_TEMPLATES.size).toBe(25);
    expect(V13_CYPHER_TEMPLATES.has(NAME)).toBe(true);
  });

  it('is not compiled by default', () => {
    const result = compileFunctions(input);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.symbolicQueries).toHaveLength(0);
  });

  it('compiles with v13Templates: true, binding the domain and infrastructure layers', () => {
    const result = compileFunctions(input, { v13Templates: true });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const [q] = result.data.symbolicQueries;
    expect(result.data.symbolicQueries).toHaveLength(1);
    expect(q?.cypher).toContain('MODULE_IMPORTS');
    expect(q?.params).toMatchObject({ domainLayer: 'domain', infraLayer: 'infrastructure' });
  });

  it('is auto-disabled when no infrastructure layer is bound', () => {
    const noInfra = { ...input, layerModel: { layers: [layerModel.layers[0]] } as unknown as LayerModel };
    const result = compileFunctions(noInfra, { v13Templates: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.symbolicQueries).toHaveLength(0);
      expect(result.data.disabledFunctions.map(d => d.name)).toContain(NAME);
    }
  });
});
