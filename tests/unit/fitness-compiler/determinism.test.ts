/**
 * U1 Step 29: compilation determinism (NFR-02, BR-U1-30).
 * The compiled queries, parameter maps, instructions, hybrid pairs and disabled list are
 * byte-identical over ten compilations of the same spec.
 */
import * as path from 'node:path';
import { compileFunctions } from '../../../src/fitness-compiler/fitness-compiler.js';
import { compilerInputFromSpec } from '../../../src/fitness-compiler/compiler-input.js';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';
import type { ParsedSpec } from '../../../src/shared/types/spec.js';

const ROOT = path.resolve(__dirname, '../../..');
const SPECS = [
  'presets/clean-architecture.yaml',
  'presets/nestjs.yaml',
  'specs/clean-arch.yaml',
  'specs/daedalus-arch.yaml',
  'presets/layered.yaml',
] as const;
const RUNS = 10;

async function loadSpec(rel: string): Promise<ParsedSpec> {
  const r = await parseSpec({ specFilePath: path.join(ROOT, rel) });
  if (!r.success) throw new Error(`${rel} did not parse: ${r.errors.map((e) => e.message).join('; ')}`);
  return r.data;
}

function compiledText(spec: ParsedSpec): string {
  const r = compileFunctions(compilerInputFromSpec(spec));
  if (!r.success) throw new Error(`compile failed: ${r.errors.map((e) => e.message).join('; ')}`);
  const { symbolicQueries, neuronalInstructions, hybridPairs, disabledFunctions } = r.data;
  return JSON.stringify({ symbolicQueries, neuronalInstructions, hybridPairs, disabledFunctions });
}

describe('BR-U1-30: ten compilations are byte-identical', () => {
  it.each(SPECS)('%s, one parse compiled ten times', async (rel) => {
    const spec = await loadSpec(rel);
    const texts = Array.from({ length: RUNS }, () => compiledText(spec));
    expect(new Set(texts).size).toBe(1);
    expect(texts[0]?.length).toBeGreaterThan(0);
  });

  it.each(SPECS)('%s, ten fresh parses each compiled once', async (rel) => {
    const texts: string[] = [];
    for (let i = 0; i < RUNS; i++) texts.push(compiledText(await loadSpec(rel)));
    expect(new Set(texts).size).toBe(1);
  });

  it.each(SPECS)('%s: every parameter map ends with excludePatterns when present', async (rel) => {
    const r = compileFunctions(compilerInputFromSpec(await loadSpec(rel)));
    expect(r.success).toBe(true);
    if (!r.success) return;
    const maps = [...r.data.symbolicQueries, ...r.data.hybridPairs.map((h) => h.symbolicQuery)].map((q) => Object.keys(q.params));
    for (const keys of maps) {
      const i = keys.indexOf('excludePatterns');
      if (i >= 0) expect(i).toBe(keys.length - 1);
    }
  });
});
