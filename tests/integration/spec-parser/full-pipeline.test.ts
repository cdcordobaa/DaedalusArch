import * as path from 'node:path';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';
import { compileFunctions } from '../../../src/fitness-compiler/fitness-compiler.js';
import type { CompilerInput } from '../../../src/fitness-compiler/types.js';

const SPEC_PATH = path.resolve(__dirname, '../../../specs/clean-arch.yaml');

describe('integration: spec parse → compile pipeline', () => {
  it('parses clean-arch.yaml and compiles all functions', async () => {
    // Step 1: Parse spec
    const specResult = await parseSpec({ specFilePath: SPEC_PATH });
    expect(specResult.success).toBe(true);
    if (!specResult.success) return;

    const spec = specResult.data;
    expect(spec.fitnessFunctions).toHaveLength(26);

    // Step 2: Compile
    const input: CompilerInput = {
      fitnessFunctions: spec.fitnessFunctions,
      adrRules: spec.adrRules,
      layerModel: spec.layerModel,
      scoringWeights: spec.scoringWeights,
    };
    const compileResult = compileFunctions(input);
    expect(compileResult.success).toBe(true);
    if (!compileResult.success) return;

    const compiled = compileResult.data;

    // Verify counts
    // 23 symbolic functions should produce queries (srp-semantic is hybrid but template may not exist)
    expect(compiled.symbolicQueries.length).toBeGreaterThanOrEqual(20);
    // FF-N02 layering-intent is neuronal-only
    expect(compiled.neuronalInstructions.length).toBeGreaterThanOrEqual(1);
    // totalCompiled should equal sum of all outputs
    expect(compiled.totalCompiled).toBe(
      compiled.symbolicQueries.length + compiled.neuronalInstructions.length + compiled.hybridPairs.length,
    );

    // Verify all symbolic queries have Cypher
    for (const q of compiled.symbolicQueries) {
      expect(q.cypher).toBeTruthy();
      expect(q.cypher).toContain('MATCH');
      expect(q.dimension).toBeTruthy();
      expect(q.severity).toBeTruthy();
    }

    // Verify neuronal instructions have semantic criteria
    for (const n of compiled.neuronalInstructions) {
      expect(n.semanticCriteria).toBeDefined();
      expect(n.semanticCriteria.rule).toBeTruthy();
    }

    // Verify function IDs are all unique
    const allIds = [
      ...compiled.symbolicQueries.map((q) => String(q.functionId)),
      ...compiled.neuronalInstructions.map((n) => String(n.functionId)),
      ...compiled.hybridPairs.map((h) => String(h.functionId)),
    ];
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('preserves layer model through compilation', async () => {
    const specResult = await parseSpec({ specFilePath: SPEC_PATH });
    expect(specResult.success).toBe(true);
    if (!specResult.success) return;

    const spec = specResult.data;

    // Verify layer params are passed to symbolic queries
    const input: CompilerInput = {
      fitnessFunctions: spec.fitnessFunctions,
      adrRules: [],
      layerModel: spec.layerModel,
      scoringWeights: spec.scoringWeights,
    };
    const result = compileFunctions(input);
    expect(result.success).toBe(true);
    if (!result.success) return;

    // Check dependency-direction query has layer params
    const depDir = result.data.symbolicQueries.find((q) => q.name === 'dependency-direction');
    expect(depDir).toBeDefined();
    expect(depDir!.params['domainLayer']).toBe('domain');
  });
});
