import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { bindLayerParams } from '../../../src/fitness-compiler/layer-binding.js';
import { compileFunctions } from '../../../src/fitness-compiler/fitness-compiler.js';
import { compilerInputFromSpec } from '../../../src/fitness-compiler/compiler-input.js';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';
import { validateSpecSchema } from '../../../src/spec-parser/spec-validator.js';
import type { FitnessFunction, LayerModel, ParsedSpec } from '../../../src/shared/types/spec.js';
import type { CompiledFunctions } from '../../../src/shared/types/evaluation.js';
import { functionId } from '../../../src/shared/types/value-objects.js';

const ROOT = path.resolve(__dirname, '../../..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'u1-k1-'));
afterAll(() => { fs.rmSync(TMP, { recursive: true, force: true }); });

const SCORING = `scoring:
  weights: { structural: 0.35, coupling: 0.20, pattern: 0.30, solid: 0.10, convention: 0.05 }
  thresholds: { pass: 0.80, warning: 0.65, soft_block: 0.50 }
confidence_thresholds: { high: 0.85, medium: 0.70, icc_minimum: 0.75 }
`;

let counter = 0;
async function parseInline(layersYaml: string, functionsYaml: string): Promise<ParsedSpec> {
  const file = path.join(TMP, `spec-${String(++counter)}.yaml`);
  fs.writeFileSync(file, `spec_version: "1.0.0"\narchitecture:\n  layers:\n${layersYaml}fitness_functions:\n${functionsYaml}${SCORING}`);
  const result = await parseSpec({ specFilePath: file });
  if (!result.success) throw new Error(`inline spec did not parse: ${result.errors.map((e) => e.message).join('; ')}`);
  return result.data;
}

async function parseShipped(rel: string): Promise<ParsedSpec> {
  const result = await parseSpec({ specFilePath: path.join(ROOT, rel) });
  if (!result.success) throw new Error(`${rel} did not parse`);
  return result.data;
}

function compile(spec: ParsedSpec): CompiledFunctions {
  const result = compileFunctions(compilerInputFromSpec(spec));
  if (!result.success) throw new Error(`compile failed: ${result.errors.map((e) => e.message).join('; ')}`);
  return result.data;
}

function compiledIds(c: CompiledFunctions): string[] {
  return [
    ...c.symbolicQueries.map((q) => String(q.functionId)),
    ...c.hybridPairs.map((h) => String(h.functionId)),
  ];
}

function fn(id: string, name: string, dimension: FitnessFunction['dimension'] = 'pattern'): FitnessFunction {
  return {
    id: functionId(id), name, dimension, severity: 'major', route: 'symbolic',
    isBuiltIn: false, validated: true, enabled: true, excludePaths: [],
  };
}

describe('K1 undefined-kind rule (C4 reads only LayerDefinition.kind)', () => {
  const kindless: LayerModel = {
    layers: [
      { name: 'domain', directories: [], naming: [], role: 'x' },
      { name: 'infrastructure', directories: [], naming: [], role: 'y' },
    ],
  };

  it('bindLayerParams binds nothing for kind-less layers', () => {
    const b = bindLayerParams(kindless.layers);
    expect(b.domainLayer).toBeUndefined();
    expect(b.infraLayer).toBeUndefined();
    expect(b.applicationLayers).toEqual([]);
  });

  it('FF-P02 no-domain-outward-dep is disabled with "no domain layer"', () => {
    const result = compileFunctions({
      fitnessFunctions: [fn('FF-P02', 'no-domain-outward-dep', 'structural')],
      adrRules: [], layerModel: kindless,
      scoringWeights: { structural: 0.35, coupling: 0.2, pattern: 0.3, solid: 0.1, convention: 0.05, semantic: 0, integrity: 0, intent: 0 },
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.symbolicQueries).toEqual([]);
    expect(result.data.disabledFunctions).toEqual([{ id: 'FF-P02', name: 'no-domain-outward-dep', reason: 'no domain layer' }]);
    expect(result.data.warnings.filter((w) => w.code === 'COMPILER_004'))
      .toEqual([expect.objectContaining({ functionId: 'FF-P02' })]);
  });
});

describe('K1 parser: layer kind (schema, parseLayerA)', () => {
  const base = {
    spec_version: '1.0.0',
    scoring: {
      weights: { structural: 0.35, coupling: 0.2, pattern: 0.3, solid: 0.1, convention: 0.05 },
      thresholds: { pass: 0.8, warning: 0.65, soft_block: 0.5 },
    },
    confidence_thresholds: { high: 0.85, medium: 0.7, icc_minimum: 0.75 },
  };
  const withKind = (kind: string): unknown => ({
    ...base,
    architecture: { layers: [{ name: 'a', roles: ['r'], kind }, { name: 'b', roles: ['r'] }] },
  });

  it.each(['domain', 'application', 'infrastructure', 'presentation'])('schema accepts kind: %s', (k) => {
    expect(validateSpecSchema(withKind(k)).valid).toBe(true);
  });

  it('schema rejects kind: core', () => {
    expect(validateSpecSchema(withKind('core')).valid).toBe(false);
  });

  it('parseSpec fails with SCHEMA_VALIDATION_FAILED for kind: core', async () => {
    const file = path.join(TMP, 'bad-kind.yaml');
    fs.writeFileSync(file, `spec_version: "1.0.0"\narchitecture:\n  layers:\n    - { name: a, roles: [r], kind: core }\n    - { name: b, roles: [r] }\nfitness_functions:\n  - { id: FF-C02, name: module-fan-out, dimension: coupling, severity: major, route: symbolic, threshold: 10 }\n${SCORING}`);
    const result = await parseSpec({ specFilePath: file });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors[0]?.code).toBe('SCHEMA_VALIDATION_FAILED');
  });

  it('every layer leaves C3 with kind and kindSource', async () => {
    const spec = await parseInline(
      '    - { name: core, roles: [r] }\n    - { name: services, roles: [r], kind: application }\n    - { name: infrastructure, roles: [r] }\n',
      '  - { id: FF-C02, name: module-fan-out, dimension: coupling, severity: major, route: symbolic, threshold: 10 }\n',
    );
    expect(spec.layerModel.layers.map((l) => [l.name, l.kind, l.kindSource])).toEqual([
      ['core', 'domain', 'position'],
      ['services', 'application', 'explicit'],
      ['infrastructure', 'infrastructure', 'name'],
    ]);
  });

  it('SPEC_005 reaches the parseSpec warnings (BR-U1-13)', async () => {
    const file = path.join(TMP, 'dup-kind.yaml');
    fs.writeFileSync(file, `spec_version: "1.0.0"\narchitecture:\n  layers:\n    - { name: core, roles: [r] }\n    - { name: domain, roles: [r] }\n    - { name: edge, roles: [r] }\nfitness_functions:\n  - { id: FF-C02, name: module-fan-out, dimension: coupling, severity: major, route: symbolic, threshold: 10 }\n${SCORING}`);
    const result = await parseSpec({ specFilePath: file });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect((result.warnings ?? []).filter((w) => w.code === 'SPEC_005')).toEqual([{
      code: 'SPEC_005', message: 'Layer kind "domain" resolved for layers core, domain; binding uses core',
    }]);
    expect(bindLayerParams(result.data.layerModel.layers).domainLayer).toBe('core');
  });
});

describe('BR-U1-14 binding of the four shipped specs (parseSpec + bindLayerParams)', () => {
  it.each([
    ['presets/clean-architecture.yaml', { domainLayer: 'domain', applicationLayers: ['application'], infraLayer: 'infrastructure', controllerLayer: 'infrastructure' }],
    ['presets/nestjs.yaml', {
      domainLayer: 'domain', applicationLayers: ['application'], infraLayer: 'infrastructure', presentationLayer: 'presentation',
      controllerLayer: 'presentation', // K16 (ADR-016 a, BR-U1-46)
    }],
    ['specs/daedalus-arch.yaml', { domainLayer: 'domain', applicationLayers: ['application'], infraLayer: 'core-modules', controllerLayer: 'core-modules' }],
    ['specs/clean-arch.yaml', { domainLayer: 'domain', applicationLayers: ['application'], infraLayer: 'infrastructure', controllerLayer: 'infrastructure' }],
  ])('%s', async (rel, expected) => {
    const spec = await parseShipped(rel);
    expect(bindLayerParams(spec.layerModel.layers)).toEqual(expected);
  });

  it('self-spec core-modules is explicit infrastructure (BR-U1-16)', async () => {
    const spec = await parseShipped('specs/daedalus-arch.yaml');
    const core = spec.layerModel.layers.find((l) => l.name === 'core-modules');
    expect([core?.kind, core?.kindSource]).toEqual(['infrastructure', 'explicit']);
  });

  it('self-spec: FF-P03, FF-P05, FF-CV01, FF-CV04 compile with infraLayer = core-modules (BR-U1-16 a)', async () => {
    const c = compile(await parseShipped('specs/daedalus-arch.yaml'));
    // FF-P05 and FF-CV04 bind core-modules through $controllerLayer from K16 (no presentation layer; BR-U1-46).
    for (const [id, param] of [['FF-P03', 'infraLayer'], ['FF-P05', 'controllerLayer'], ['FF-CV01', 'infraLayer'], ['FF-CV04', 'controllerLayer']] as const) {
      const q = c.symbolicQueries.find((x) => String(x.functionId) === id);
      expect(q?.params[param]).toBe('core-modules');
    }
    expect(c.disabledFunctions).toEqual([]);
  });
});

describe('BR-U1-10: disable before checking', () => {
  it('2-layer spec declaring FF-P04 compiles; FF-P04 disabled "no application layer"', async () => {
    const spec = await parseInline(
      '    - { name: inner, roles: [r] }\n    - { name: outer, roles: [r] }\n',
      '  - { id: FF-P04, name: use-case-isolation, dimension: pattern, severity: major, route: symbolic }\n'
      + '  - { id: FF-C02, name: module-fan-out, dimension: coupling, severity: major, route: symbolic, threshold: 10 }\n',
    );
    const result = compileFunctions(compilerInputFromSpec(spec));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.disabledFunctions).toEqual([{ id: 'FF-P04', name: 'use-case-isolation', reason: 'no application layer' }]);
    expect(compiledIds(result.data)).toEqual(['FF-C02']);
  });
});

describe('BR-U1-15: missing layer kinds (persistence / business / presentation)', () => {
  it('FF-CV01 naming-conventions and FF-CV02 naming-services disabled "no application layer"', async () => {
    const spec = await parseInline(
      '    - { name: persistence, roles: [r], kind: infrastructure }\n'
      + '    - { name: business, roles: [r], kind: domain }\n'
      + '    - { name: presentation, roles: [r], kind: presentation }\n',
      '  - { id: FF-CV01, name: naming-conventions, dimension: convention, severity: minor, route: symbolic }\n'
      + '  - { id: FF-CV02, name: naming-services, dimension: convention, severity: minor, route: symbolic, pattern: "*Service|*UseCase" }\n'
      + '  - { id: FF-P03, name: repository-pattern, dimension: pattern, severity: major, route: symbolic }\n',
    );
    const c = compile(spec);
    expect(c.disabledFunctions).toEqual([
      { id: 'FF-CV01', name: 'naming-conventions', reason: 'no application layer' },
      { id: 'FF-CV02', name: 'naming-services', reason: 'no application layer' },
    ]);
    const p03 = c.symbolicQueries.find((q) => String(q.functionId) === 'FF-P03');
    expect(p03?.params).toMatchObject({ domainLayer: 'business', infraLayer: 'persistence' });
  });
});

describe('no-layer-skip layer-count rule through compileFunctions', () => {
  it('keeps the reason text for a 2-layer spec without file_patterns', async () => {
    const spec = await parseInline(
      '    - { name: domain, roles: [r] }\n    - { name: infrastructure, roles: [r] }\n',
      '  - { id: FF-S03, name: no-layer-skip, dimension: structural, severity: major, route: symbolic }\n',
    );
    expect(compile(spec).disabledFunctions).toEqual([{
      id: 'FF-S03', name: 'no-layer-skip',
      reason: 'Auto-disabled: only 2 layer(s) defined with no file_patterns — no intermediate layer to skip',
    }]);
  });
});
