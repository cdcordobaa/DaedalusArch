/**
 * U1 Step 29: visible denominator and disabled reasons (FR-20; BR-U1-19 (b), BR-U1-39 automatable
 * part, BR-U1-02 cycle bound).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { compileFunctions } from '../../../src/fitness-compiler/fitness-compiler.js';
import { compilerInputFromSpec } from '../../../src/fitness-compiler/compiler-input.js';
import { CYPHER_TEMPLATES, MAX_CYCLE_LENGTH } from '../../../src/fitness-compiler/cypher-templates.js';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';
import type { CompilerInput } from '../../../src/fitness-compiler/types.js';
import type { ADRRule, FitnessFunction, ParsedSpec } from '../../../src/shared/types/spec.js';
import type { CompiledFunctions } from '../../../src/shared/types/evaluation.js';

const ROOT = path.resolve(__dirname, '../../..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'u1-denominator-'));
afterAll(() => { fs.rmSync(TMP, { recursive: true, force: true }); });

const SHIPPED = [
  'presets/clean-architecture.yaml',
  'presets/nestjs.yaml',
  'specs/clean-arch.yaml',
  'specs/daedalus-arch.yaml',
  'presets/layered.yaml',
] as const;

async function loadSpec(file: string): Promise<ParsedSpec> {
  const r = await parseSpec({ specFilePath: file });
  if (!r.success) throw new Error(`${file} did not parse: ${r.errors.map((e) => e.message).join('; ')}`);
  return r.data;
}

function compile(input: CompilerInput): CompiledFunctions {
  const r = compileFunctions(input);
  if (!r.success) throw new Error(`compile failed: ${r.errors.map((e) => e.message).join('; ')}`);
  return r.data;
}

/** Dropped per BR-U1-19 (b): compiles to nothing although enabled and not disabled by applicability. */
function isDropped(ff: FitnessFunction, disabledIds: ReadonlySet<string>): boolean {
  if (!ff.enabled || disabledIds.has(String(ff.id))) return false;
  const hasTemplate = CYPHER_TEMPLATES.has(ff.name);
  const hasCriteria = ff.semanticCriteria != null;
  if (ff.route === 'symbolic') return !hasTemplate;
  if (ff.route === 'neuronal') return !hasCriteria;
  return !hasTemplate && !hasCriteria;
}

/** ADR-derived per BR-U1-19 (b): ADR rules compiled at the end of `compileFunctions` (first id wins). */
function adrDerivedCount(spec: ParsedSpec, adrRules: readonly ADRRule[]): number {
  const seen = new Set(spec.fitnessFunctions.filter((f) => f.enabled).map((f) => String(f.id)));
  let n = 0;
  for (const adr of adrRules) {
    if (seen.has(adr.id)) continue;
    seen.add(adr.id);
    n++;
  }
  return n;
}

function compiledIds(c: CompiledFunctions): string[] {
  return [
    ...c.symbolicQueries.map((q) => String(q.functionId)),
    ...c.neuronalInstructions.map((n) => String(n.functionId)),
    ...c.hybridPairs.map((h) => String(h.functionId)),
  ];
}

function checkDenominator(spec: ParsedSpec, adrRules: readonly ADRRule[]): { declared: number; compiled: number; adr: number; disabled: number; dropped: number } {
  const c = compile({ ...compilerInputFromSpec(spec), adrRules });
  const disabledIds = new Set(c.disabledFunctions.map((d) => String(d.id)));
  const dropped = spec.fitnessFunctions.filter((f) => isDropped(f, disabledIds));
  const adr = adrDerivedCount(spec, adrRules);
  const declared = spec.fitnessFunctions.length;

  expect(declared).toBe((c.totalCompiled - adr) + c.disabledFunctions.length + dropped.length);

  // Each declared id lands in exactly one bucket.
  const declaredIds = new Set(spec.fitnessFunctions.map((f) => String(f.id)));
  const fromFunctions = compiledIds(c).filter((id) => declaredIds.has(id));
  const buckets = [...fromFunctions, ...disabledIds, ...dropped.map((f) => String(f.id))].sort();
  expect(buckets).toEqual([...declaredIds].sort());
  return { declared, compiled: c.totalCompiled, adr, disabled: c.disabledFunctions.length, dropped: dropped.length };
}

describe('BR-U1-19 (b): declared = (compiled − ADR-derived) + disabled + dropped', () => {
  it.each(SHIPPED)('%s', async (rel) => {
    const spec = await loadSpec(path.join(ROOT, rel));
    checkDenominator(spec, spec.adrRules);
  });

  it('presets/layered.yaml: 27 = (18 − 0) + 9 + 0 (BR-U1-19 a)', async () => {
    const spec = await loadSpec(path.join(ROOT, 'presets/layered.yaml'));
    expect(checkDenominator(spec, spec.adrRules)).toEqual({ declared: 27, compiled: 18, adr: 0, disabled: 9, dropped: 0 }); // U3-R6 (BR-U3-25): attributed cross-unit update
  });

  it('every term is live: ADR rules, enabled: false, and the three dropped kinds', async () => {
    const file = path.join(TMP, 'all-terms.yaml');
    fs.writeFileSync(file, `spec_version: "1.0.0"
architecture:
  layers:
    - { name: domain, roles: [r] }
    - { name: application, roles: [r] }
    - { name: infrastructure, roles: [r] }
fitness_functions:
  - { id: FF-S02, name: no-cyclic-deps, dimension: structural, severity: critical, route: symbolic }
  - { id: FF-X01, name: no-such-template, dimension: structural, severity: minor, route: symbolic }
  - { id: FF-X02, name: neuronal-without-criteria, dimension: semantic, severity: minor, route: neuronal }
  - { id: FF-X03, name: hybrid-with-neither, dimension: semantic, severity: minor, route: hybrid }
  - { id: FF-X04, name: off-by-author, dimension: structural, severity: minor, route: symbolic, enabled: false, reason: "declared exclusion" }
scoring:
  weights: { structural: 0.35, coupling: 0.20, pattern: 0.30, solid: 0.10, convention: 0.05 }
  thresholds: { pass: 0.80, warning: 0.65, soft_block: 0.50 }
confidence_thresholds: { high: 0.85, medium: 0.70, icc_minimum: 0.75 }
`);
    const spec = await loadSpec(file);
    const adrs: ADRRule[] = [
      { id: 'ADR-001', title: 'Use repositories', format: 'MADR', rawContent: 'Decision: use repositories.' },
      {
        id: 'ADR-002', title: 'No cycles', format: 'MADR', rawContent: 'Decision: no cycles.',
        symbolicRule: { query: 'MATCH (f:File) RETURN f.filePath AS filePath ORDER BY filePath', params: {}, description: 'd' },
      },
    ];
    expect(checkDenominator(spec, adrs)).toEqual({ declared: 5, compiled: 3, adr: 2, disabled: 1, dropped: 3 });
  });
});

describe('BR-U1-39 (automatable): every enabled: false function has a reason that reaches disabledFunctions', () => {
  it.each(SHIPPED)('%s', async (rel) => {
    const file = path.join(ROOT, rel);
    const raw = parseYaml(fs.readFileSync(file, 'utf8')) as { fitness_functions?: { id: string; enabled?: boolean; reason?: unknown }[] };
    const off = (raw.fitness_functions ?? []).filter((f) => f.enabled === false);
    const c = compile(compilerInputFromSpec(await loadSpec(file)));
    for (const f of off) {
      expect(typeof f.reason).toBe('string');
      expect(String(f.reason).trim()).not.toBe('');
      expect(c.disabledFunctions).toContainEqual(expect.objectContaining({ id: f.id, reason: f.reason }));
    }
  });

  it('the check is live: an inline enabled: false function with a reason is listed with that reason', async () => {
    const file = path.join(TMP, 'declared-exclusion.yaml');
    fs.writeFileSync(file, `spec_version: "1.0.0"
architecture:
  layers:
    - { name: domain, roles: [r] }
    - { name: infrastructure, roles: [r] }
fitness_functions:
  - { id: FF-SO02, name: interface-segregation-proxy, dimension: solid, severity: minor, route: symbolic, enabled: false, reason: "cannot fire: no Interface CONTAINS Method edge" }
scoring:
  weights: { structural: 0.35, coupling: 0.20, pattern: 0.30, solid: 0.10, convention: 0.05 }
  thresholds: { pass: 0.80, warning: 0.65, soft_block: 0.50 }
confidence_thresholds: { high: 0.85, medium: 0.70, icc_minimum: 0.75 }
`);
    const c = compile(compilerInputFromSpec(await loadSpec(file)));
    expect(c.disabledFunctions).toEqual([
      { id: 'FF-SO02', name: 'interface-segregation-proxy', reason: 'cannot fire: no Interface CONTAINS Method edge' },
    ]);
  });
});

describe('BR-U1-02: frozen cycle bound', () => {
  it('MAX_CYCLE_LENGTH === 10', () => {
    expect(MAX_CYCLE_LENGTH).toBe(10);
  });
});
