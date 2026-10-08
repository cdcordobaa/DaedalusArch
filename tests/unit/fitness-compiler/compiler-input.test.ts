import * as path from 'node:path';
import { compilerInputFromSpec } from '../../../src/fitness-compiler/compiler-input.js';
import { compileFunctions, FitnessCompilerStage } from '../../../src/fitness-compiler/fitness-compiler.js';
import { CompileCommand } from '../../../src/pipeline/commands/compile-command.js';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';
import { FirewallContext } from '../../../src/shared/context/firewall-context.js';
import { runId } from '../../../src/shared/types/value-objects.js';
import type { ParsedSpec } from '../../../src/shared/types/spec.js';

const SPEC_PATH = path.resolve(__dirname, '../../../specs/clean-arch.yaml');

async function loadSpec(): Promise<ParsedSpec> {
  const result = await parseSpec({ specFilePath: SPEC_PATH });
  if (!result.success) throw new Error('clean-arch.yaml did not parse');
  return result.data;
}

describe('compilerInputFromSpec (BR-U1-11)', () => {
  it('maps the four spec fields by reference', async () => {
    const spec = await loadSpec();
    const input = compilerInputFromSpec(spec);
    expect(input.fitnessFunctions).toBe(spec.fitnessFunctions);
    expect(input.adrRules).toBe(spec.adrRules);
    expect(input.layerModel).toBe(spec.layerModel);
    expect(input.scoringWeights).toBe(spec.scoringWeights);
  });

  it('lower-cases style', async () => {
    const spec = { ...(await loadSpec()), style: 'Clean-Architecture' };
    expect(compilerInputFromSpec(spec).style).toBe('clean-architecture');
  });

  it('omits the style key when the spec has none', async () => {
    const spec = await loadSpec();
    expect(spec.style).toBeUndefined();
    const input = compilerInputFromSpec(spec);
    expect(Object.prototype.hasOwnProperty.call(input, 'style')).toBe(false);
    expect(Object.keys(input).sort()).toEqual(['adrRules', 'fitnessFunctions', 'layerModel', 'scoringWeights']);
  });

  it('FitnessCompilerStage and CompileCommand compile the same as the pre-change literal', async () => {
    const spec = await loadSpec();
    const legacy = compileFunctions({
      fitnessFunctions: spec.fitnessFunctions,
      adrRules: spec.adrRules,
      layerModel: spec.layerModel,
      scoringWeights: spec.scoringWeights,
    });
    expect(legacy.success).toBe(true);
    if (!legacy.success) return;

    const stageCtx = new FirewallContext(runId('test-run'));
    const stageResult = await new FitnessCompilerStage().execute(spec, stageCtx);
    expect(stageResult.success).toBe(true);
    if (!stageResult.success) return;
    expect(stageResult.data).toEqual(legacy.data);

    const cmdCtx = new FirewallContext(runId('test-run'));
    cmdCtx.setParsedSpec(spec);
    const cmdResult = await new CompileCommand().execute(cmdCtx);
    expect(cmdResult.success).toBe(true);
    expect(cmdCtx.getCompiledFunctions()).toEqual(legacy.data);
  });
});
