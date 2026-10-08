/**
 * U1 K2: typed FR-07 fields and BR-SPEC-10, always fatal (FR-07, FR-08).
 * BR-U1-03 (b), BR-U1-04, BR-U1-05, BR-U1-06 (b), BR-U1-07, BR-U1-08 (a), BR-U1-09, BR-U1-10 (BR-SPEC-10 part).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { compileFunctions } from '../../../src/fitness-compiler/fitness-compiler.js';
import { compilerInputFromSpec } from '../../../src/fitness-compiler/compiler-input.js';
import { checkBoundParameters, findUnboundParameters } from '../../../src/fitness-compiler/bound-param-checker.js';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';
import { parseLayerB } from '../../../src/spec-parser/layer-parsers.js';
import { resolveTemplate } from '../../../src/spec-parser/template-registry.js';
import type { SpecParserOptions } from '../../../src/spec-parser/types.js';
import type { ParsedSpec } from '../../../src/shared/types/spec.js';
import type { CompiledFunctions } from '../../../src/shared/types/evaluation.js';

const ROOT = path.resolve(__dirname, '../../..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'u1-k2-'));
afterAll(() => { fs.rmSync(TMP, { recursive: true, force: true }); });

const LAYERS3 = '    - { name: domain, roles: [r] }\n    - { name: application, roles: [r] }\n    - { name: infrastructure, roles: [r] }\n';
const SCORING = `scoring:
  weights: { structural: 0.35, coupling: 0.20, pattern: 0.30, solid: 0.10, convention: 0.05 }
  thresholds: { pass: 0.80, warning: 0.65, soft_block: 0.50 }
confidence_thresholds: { high: 0.85, medium: 0.70, icc_minimum: 0.75 }
`;

let counter = 0;
function writeSpec(functionsYaml: string, opts: { layers?: string; style?: string } = {}): string {
  const file = path.join(TMP, `spec-${String(++counter)}.yaml`);
  const style = opts.style != null ? `  style: ${opts.style}\n` : '';
  fs.writeFileSync(file, `spec_version: "1.0.0"\narchitecture:\n${style}  layers:\n${opts.layers ?? LAYERS3}fitness_functions:\n${functionsYaml}${SCORING}`);
  return file;
}

async function parse(functionsYaml: string, opts: { layers?: string; style?: string } = {}, parserOpts: SpecParserOptions = {}) {
  return parseSpec({ specFilePath: writeSpec(functionsYaml, opts) }, parserOpts);
}

async function parseOk(functionsYaml: string, opts: { layers?: string; style?: string } = {}): Promise<{ spec: ParsedSpec; warnings: readonly { code: string; message: string }[] }> {
  const r = await parse(functionsYaml, opts);
  if (!r.success) throw new Error(`inline spec did not parse: ${r.errors.map((e) => e.message).join('; ')}`);
  return { spec: r.data, warnings: r.warnings ?? [] };
}

function compile(spec: ParsedSpec): CompiledFunctions {
  const r = compileFunctions(compilerInputFromSpec(spec));
  if (!r.success) throw new Error(`compile failed: ${r.errors.map((e) => e.message).join('; ')}`);
  return r.data;
}

function compileErrors(spec: ParsedSpec): string[] {
  const r = compileFunctions(compilerInputFromSpec(spec));
  return r.success ? [] : r.errors.map((e) => `${e.code} ${e.message}`);
}

const FN = (id: string, name: string, extra = ''): string =>
  `  - { id: ${id}, name: ${name}, dimension: convention, severity: minor, route: symbolic${extra} }\n`;

describe('BR-U1-03 (b): merge by id keeps template values; declared keys override', () => {
  const template = resolveTemplate('clean-architecture');
  if (!template) throw new Error('clean-architecture template missing');

  it('FF-C03 override without threshold keeps the template 0.8; FF-SO03 max_depth: 0 gives maxDepth 0', () => {
    const raw = {
      fitness_functions: [
        { id: 'FF-C03', name: 'component-instability', dimension: 'coupling', severity: 'advisory', route: 'symbolic' },
        { id: 'FF-SO03', name: 'inheritance-depth', dimension: 'solid', severity: 'minor', route: 'symbolic', max_depth: 0 },
      ],
    };
    const { functions } = parseLayerB(raw, template.functions);
    const c03 = functions.find((f) => String(f.id) === 'FF-C03');
    const so03 = functions.find((f) => String(f.id) === 'FF-SO03');
    expect(c03?.threshold).toBe(0.8);
    expect(so03?.maxDepth).toBe(0);
    expect(c03 && 'maxDepth' in c03).toBe(false);
  });

  it('absent FR-07 keys are omitted, never undefined', () => {
    const { functions } = parseLayerB({ fitness_functions: [{ id: 'FF-C02', name: 'module-fan-out', dimension: 'coupling', severity: 'major', route: 'symbolic', threshold: 10 }] });
    const keys = Object.keys(functions[0] ?? {});
    for (const k of ['forbiddenImports', 'maxPublicMethods', 'maxDependencies', 'maxInterfaceMethods', 'maxDepth', 'pattern']) {
      expect({ k, present: keys.includes(k) }).toEqual({ k, present: false });
    }
  });
});

describe('BR-U1-04: FR-07 field types and ranges are schema errors (strictMode false)', () => {
  it.each([
    ['max_depth: -1', ', max_depth: -1'],
    ['max_depth: 2.5', ', max_depth: 2.5'],
    ['max_depth: "3"', ', max_depth: "3"'],
    ['forbidden_imports: "express"', ', forbidden_imports: "express"'],
    ['forbidden_imports: [""]', ', forbidden_imports: [""]'],
  ])('%s → SCHEMA_VALIDATION_FAILED', async (_label, extra) => {
    const r = await parse(FN('FF-SO03', 'inheritance-depth', extra), {}, { strictMode: false });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.errors[0]?.code).toBe('SCHEMA_VALIDATION_FAILED');
  });
});

describe('BR-U1-05: FR-07 key not used by the template raises SPEC_001', () => {
  it('FF-S01 with max_depth: 3 yields exactly one SPEC_001 with the design text', async () => {
    const { spec, warnings } = await parseOk(FN('FF-S01', 'dependency-direction', ', max_depth: 3'));
    expect(warnings.filter((w) => w.code === 'SPEC_001')).toEqual([
      { code: 'SPEC_001', message: 'Field "max_depth" of FF-S01 not used by template dependency-direction' },
    ]);
    expect(spec.fitnessFunctions[0]?.maxDepth).toBe(3); // value still carried
  });

  it('the golden spec (specs/clean-arch.yaml) yields no SPEC_001', async () => {
    const r = await parseSpec({ specFilePath: path.join(ROOT, 'specs/clean-arch.yaml') });
    expect(r.success).toBe(true);
    expect((r.warnings ?? []).filter((w) => w.code === 'SPEC_001')).toEqual([]);
  });
});

describe('BR-U1-06 (b): pattern grammar enforced by the schema', () => {
  it.each(['*Repo|', '|*Repo', 'a||b', '.*Service', '* Service'])('pattern "%s" → SCHEMA_VALIDATION_FAILED', async (p) => {
    const r = await parse(FN('FF-CV03', 'naming-repos', `, pattern: ${JSON.stringify(p)}`));
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.errors[0]?.code).toBe('SCHEMA_VALIDATION_FAILED');
  });

  it('a valid pattern is compiled to the anchored regex in the parameter map', async () => {
    const { spec } = await parseOk(FN('FF-CV03', 'naming-repos', ', pattern: "*Repository|*Repo"'));
    expect(compile(spec).symbolicQueries[0]?.params.pattern).toBe('^(?:[^/]*Repository|[^/]*Repo)$');
  });
});

describe('BR-U1-07: presence is != null; empty list unbound', () => {
  it('max_dependencies: 0 binds maxDependencies 0', async () => {
    const { spec } = await parseOk(FN('FF-SO01', 'single-responsibility-proxy', ', max_public_methods: 10, max_dependencies: 0'));
    expect(compile(spec).symbolicQueries[0]?.params).toMatchObject({ maxPublicMethods: 10, maxDependencies: 0 });
  });

  it('forbidden_imports: [] on FF-P01 fails with BR-SPEC-10 FF-P01: forbiddenImports', async () => {
    const { spec } = await parseOk(FN('FF-P01', 'domain-purity', ', forbidden_imports: []'));
    expect(compileErrors(spec)).toEqual(['MISSING_REQUIRED_PARAM BR-SPEC-10 FF-P01: forbiddenImports']);
  });
});

describe('BR-U1-08 (a): no template defaults for FR-07 fields', () => {
  it('style clean-architecture declaring FF-P01 without forbidden_imports fails; every template FR-07 parameter is reported', async () => {
    const { spec } = await parseOk(
      '  - { id: FF-P01, name: domain-purity, dimension: pattern, severity: critical, route: symbolic }\n',
      { style: 'clean-architecture' },
    );
    expect(compileErrors(spec)).toEqual([
      'MISSING_REQUIRED_PARAM BR-SPEC-10 FF-CV02: pattern',
      'MISSING_REQUIRED_PARAM BR-SPEC-10 FF-CV03: pattern',
      'MISSING_REQUIRED_PARAM BR-SPEC-10 FF-CV04: pattern',
      'MISSING_REQUIRED_PARAM BR-SPEC-10 FF-P01: forbiddenImports',
      'MISSING_REQUIRED_PARAM BR-SPEC-10 FF-SO01: maxPublicMethods',
      'MISSING_REQUIRED_PARAM BR-SPEC-10 FF-SO01: maxDependencies',
      'MISSING_REQUIRED_PARAM BR-SPEC-10 FF-SO02: maxInterfaceMethods',
      'MISSING_REQUIRED_PARAM BR-SPEC-10 FF-SO03: maxDepth',
    ]);
  });
});

describe('BR-U1-09: BR-SPEC-10 is always fatal and sorted', () => {
  const p01 = '  - { id: FF-P01, name: domain-purity, dimension: pattern, severity: critical, route: symbolic }\n';

  it.each([true, false])('(a) FF-P01 without forbidden_imports fails exactly, strictMode %s', async (strictMode) => {
    const r = await parse(p01, {}, { strictMode });
    expect(r.success).toBe(true);
    if (!r.success) return;
    const c = compileFunctions(compilerInputFromSpec(r.data));
    expect(c.success).toBe(false);
    if (c.success) return;
    expect(c.errors).toEqual([{
      code: 'MISSING_REQUIRED_PARAM', message: 'BR-SPEC-10 FF-P01: forbiddenImports', stage: 'fitness-compiler', critical: true,
    }]);
  });

  it('pairs are sorted by id (lexicographic), then requiredParams order; yamlKey filled', async () => {
    const { spec } = await parseOk(
      FN('FF-SO01', 'single-responsibility-proxy') + FN('FF-CV03', 'naming-repos') + p01 + FN('FF-SO03', 'inheritance-depth'),
    );
    expect(findUnboundParameters(compilerInputFromSpec(spec))).toEqual([
      { functionId: 'FF-CV03', parameter: 'pattern', yamlKey: 'pattern' },
      { functionId: 'FF-P01', parameter: 'forbiddenImports', yamlKey: 'forbidden_imports' },
      { functionId: 'FF-SO01', parameter: 'maxPublicMethods', yamlKey: 'max_public_methods' },
      { functionId: 'FF-SO01', parameter: 'maxDependencies', yamlKey: 'max_dependencies' },
      { functionId: 'FF-SO03', parameter: 'maxDepth', yamlKey: 'max_depth' },
    ]);
  });

  it('disabled (enabled: false), neuronal and template-less functions are outside BR-SPEC-10', async () => {
    const { spec } = await parseOk(
      '  - { id: FF-P01, name: domain-purity, dimension: pattern, severity: critical, route: symbolic, enabled: false, reason: off }\n'
      + FN('FF-X01', 'no-such-template')
      + '  - { id: FF-N01, name: srp-semantic, dimension: semantic, severity: minor, route: neuronal }\n'
      + FN('FF-C02', 'module-fan-out', ', threshold: 10'),
    );
    expect(checkBoundParameters(compilerInputFromSpec(spec)).success).toBe(true);
    expect(compileFunctions(compilerInputFromSpec(spec)).success).toBe(true);
  });

  it('(c, d) the four shipped specs compile with no MISSING_REQUIRED_PARAM', async () => {
    for (const rel of ['presets/clean-architecture.yaml', 'presets/nestjs.yaml', 'specs/daedalus-arch.yaml', 'specs/clean-arch.yaml']) {
      const r = await parseSpec({ specFilePath: path.join(ROOT, rel) });
      if (!r.success) throw new Error(`${rel} did not parse`);
      expect({ rel, unbound: findUnboundParameters(compilerInputFromSpec(r.data)) }).toEqual({ rel, unbound: [] });
      expect({ rel, errors: compileErrors(r.data) }).toEqual({ rel, errors: [] });
    }
  });
});

describe('BR-U1-10: disable before checking (BR-SPEC-10 part)', () => {
  it('2-layer spec: FF-CV02 without pattern is disabled "no application layer", not a BR-SPEC-10 error', async () => {
    const { spec } = await parseOk(
      FN('FF-CV02', 'naming-services') + FN('FF-C02', 'module-fan-out', ', threshold: 10'),
      { layers: '    - { name: inner, roles: [r] }\n    - { name: outer, roles: [r] }\n' },
    );
    const c = compile(spec);
    expect(c.disabledFunctions).toEqual([{ id: 'FF-CV02', name: 'naming-services', reason: 'no application layer' }]);
    expect(findUnboundParameters(compilerInputFromSpec(spec))).toEqual([]);
  });
});

describe('BR-U1-03 (c): no cast in buildParams', () => {
  it('fitness-compiler.ts has no "as unknown as Record"', () => {
    const text = fs.readFileSync(path.join(ROOT, 'src/fitness-compiler/fitness-compiler.ts'), 'utf8');
    expect(text.split('\n').filter((l) => l.includes('as unknown as Record'))).toEqual([]);
  });
});
