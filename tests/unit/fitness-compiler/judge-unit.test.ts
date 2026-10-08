/**
 * U1 Step 25: FR-33 `judge_unit`, parse side (BR-U1-26, BR-U1-04; AD-2; D-U1-12).
 * `judge_unit` is parsed into FitnessFunction.judgeUnit; compileNeuronal sets
 * NeuronalInstruction.judgeUnit = ff.judgeUnit ?? (integrity ? 'module' : 'file'); ADR instructions use 'file'.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { compileFunctions } from '../../../src/fitness-compiler/fitness-compiler.js';
import { compilerInputFromSpec } from '../../../src/fitness-compiler/compiler-input.js';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';
import type { ADRRule, ParsedSpec } from '../../../src/shared/types/spec.js';
import type { CompiledFunctions } from '../../../src/shared/types/evaluation.js';

const ROOT = path.resolve(__dirname, '../../..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'u1-judge-unit-'));
afterAll(() => { fs.rmSync(TMP, { recursive: true, force: true }); });

const NEURONAL = (id: string, dimension: string, extra = ''): string => `  - id: ${id}
    name: n-${id.toLowerCase()}
    dimension: ${dimension}
    severity: major
    route: neuronal${extra}
    semantic_criteria:
      rule: "r"
      rubric: { pass: "p", fail: "f", evidence_required: "e" }
`;

let counter = 0;
function writeSpec(functionsYaml: string): string {
  const file = path.join(TMP, `spec-${String(++counter)}.yaml`);
  fs.writeFileSync(file, `spec_version: "1.0.0"
architecture:
  layers:
    - { name: domain, roles: [r] }
    - { name: application, roles: [r] }
    - { name: infrastructure, roles: [r] }
fitness_functions:
${functionsYaml}scoring:
  weights: { structural: 0.35, coupling: 0.20, pattern: 0.30, solid: 0.10, convention: 0.05 }
  thresholds: { pass: 0.80, warning: 0.65, soft_block: 0.50 }
confidence_thresholds: { high: 0.85, medium: 0.70, icc_minimum: 0.75 }
`);
  return file;
}

async function parsed(file: string): Promise<ParsedSpec> {
  const r = await parseSpec({ specFilePath: file });
  if (!r.success) throw new Error(`spec did not parse: ${r.errors.map((e) => e.message).join('; ')}`);
  return r.data;
}

function compiled(spec: ParsedSpec, adrRules: readonly ADRRule[] = []): CompiledFunctions {
  const r = compileFunctions({ ...compilerInputFromSpec(spec), adrRules });
  if (!r.success) throw new Error(`compile failed: ${r.errors.map((e) => e.message).join('; ')}`);
  return r.data;
}

const unitOf = (c: CompiledFunctions, id: string): string | undefined =>
  c.neuronalInstructions.find((n) => String(n.functionId) === id)?.judgeUnit;

describe('BR-U1-26 judge unit', () => {
  it('FF-N01 (integrity) without judge_unit → module; FF-N02 (semantic) → file (specs/clean-arch.yaml)', async () => {
    const c = compiled(await parsed(path.join(ROOT, 'specs/clean-arch.yaml')));
    expect(unitOf(c, 'FF-N01')).toBe('module');
    expect(unitOf(c, 'FF-N02')).toBe('file');
  });

  it('judge_unit: class → class (parsed into FitnessFunction.judgeUnit and carried into the instruction)', async () => {
    const spec = await parsed(writeSpec(NEURONAL('FF-N01', 'integrity', '\n    judge_unit: class')));
    expect(spec.fitnessFunctions.find((f) => String(f.id) === 'FF-N01')?.judgeUnit).toBe('class');
    expect(unitOf(compiled(spec), 'FF-N01')).toBe('class');
  });

  it('an absent judge_unit leaves FitnessFunction.judgeUnit absent', async () => {
    const spec = await parsed(writeSpec(NEURONAL('FF-N02', 'semantic')));
    const fn = spec.fitnessFunctions.find((f) => String(f.id) === 'FF-N02');
    expect(fn).toBeDefined();
    expect(fn && 'judgeUnit' in fn).toBe(false);
  });

  it('ADR instructions use file', async () => {
    const adr: ADRRule = { id: 'ADR-001', title: 't', format: 'MADR', rawContent: 'Decision: d.' };
    const c = compiled(await parsed(writeSpec(NEURONAL('FF-N02', 'semantic'))), [adr]);
    expect(unitOf(c, 'ADR-001')).toBe('file');
  });

  it('judge_unit: page → SCHEMA_VALIDATION_FAILED', async () => {
    const r = await parseSpec({ specFilePath: writeSpec(NEURONAL('FF-N02', 'semantic', '\n    judge_unit: page')) });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors.map((e) => e.code)).toEqual(['SCHEMA_VALIDATION_FAILED']);
  });
});
