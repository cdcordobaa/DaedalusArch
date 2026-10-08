/**
 * U1 K15: `layered` style library and preset (FR-20; U1 Q6 A, Q7 A; ADR-016 d).
 * BR-U1-17 (a)-(e); BR-U1-19 (a) visible denominator; BR-U1-15 kind-disablement on the preset;
 * BR-U1-08 (b) the six BR-SPEC-10 errors of a minimal `style: layered` spec (business-rules.md §6).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import YAML from 'yaml';
import { CYPHER_TEMPLATES } from '../../../src/fitness-compiler/cypher-templates.js';
import { bindLayerParams } from '../../../src/fitness-compiler/layer-binding.js';
import { compileFunctions } from '../../../src/fitness-compiler/fitness-compiler.js';
import { compilerInputFromSpec } from '../../../src/fitness-compiler/compiler-input.js';
import { findUnboundParameters } from '../../../src/fitness-compiler/bound-param-checker.js';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';
import { LAYERED_TEMPLATE, resolveTemplate } from '../../../src/spec-parser/template-registry.js';
import { FUNCTION_FIELD_KEYS } from '../../../src/spec-parser/function-fields.js';
import type { ParsedSpec } from '../../../src/shared/types/spec.js';
import type { CompiledFunctions } from '../../../src/shared/types/evaluation.js';

const ROOT = path.resolve(__dirname, '../../..');
const LAYERED = path.join(ROOT, 'presets/layered.yaml');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'u1-k15-'));
afterAll(() => { fs.rmSync(TMP, { recursive: true, force: true }); });

const STYLE = 'not applicable to style layered';
const NO_APP = 'no application layer';

/** business-rules.md §3.1, column `layered` (frozen): templates that compile in the layered preset. */
const LAYERED_APPLICABLE = [
  'dependency-direction', 'no-cyclic-deps', 'no-layer-skip', 'domain-purity', 'module-fan-out',
  'component-instability', 'no-orphan-files', 'max-fan-in', 'abstraction-ratio', 'single-responsibility-proxy',
  'interface-segregation-proxy', 'inheritance-depth', 'naming-repos', 'test-file-pairing', 'no-index-logic',
];

async function parsed(file: string): Promise<{ spec: ParsedSpec; warnings: readonly { code: string; message: string }[] }> {
  const r = await parseSpec({ specFilePath: file }, { strictMode: true });
  if (!r.success) throw new Error(`spec did not parse: ${r.errors.map((e) => e.message).join('; ')}`);
  return { spec: r.data, warnings: r.warnings ?? [] };
}

function compiled(spec: ParsedSpec): CompiledFunctions {
  const r = compileFunctions(compilerInputFromSpec(spec));
  if (!r.success) throw new Error(`compile failed: ${r.errors.map((e) => e.message).join('; ')}`);
  return r.data;
}

function rawFunctions(rel: string): Record<string, unknown>[] {
  const raw = YAML.parse(fs.readFileSync(path.join(ROOT, rel), 'utf-8')) as { fitness_functions?: Record<string, unknown>[] };
  return raw.fitness_functions ?? [];
}

describe('BR-U1-17 layered library', () => {
  it('(a) parseSpec on presets/layered.yaml succeeds with style layered and three explicit layers in order', async () => {
    const { spec, warnings } = await parsed(LAYERED);
    expect(spec.style).toBe('layered');
    expect(spec.layerModel.layers.map((l) => [l.name, l.kind, l.kindSource])).toEqual([
      ['persistence', 'infrastructure', 'explicit'],
      ['business', 'domain', 'explicit'],
      ['presentation', 'presentation', 'explicit'],
    ]);
    expect(spec.layerModel.layers.every((l) => l.directories.length > 0 && l.role.length > 0)).toBe(true);
    expect(warnings.filter((w) => w.code !== 'SPEC_002')).toEqual([]);
    expect(spec.fullModeWeights).toMatchObject({ semantic: 0.04, integrity: 0.04, intent: 0 });
  });

  it('(b) resolveTemplate(layered) is LAYERED_TEMPLATE: the 26 clean-architecture ids, no FR-07 values, FF-N01 integrity/neuronal, FF-N02 semantic', () => {
    const t = resolveTemplate('layered');
    expect(t).toBe(LAYERED_TEMPLATE);
    expect(t?.style).toBe('layered');
    const clean = resolveTemplate('clean-architecture');
    expect(t?.functions.map((f) => String(f.id))).toEqual(clean?.functions.map((f) => String(f.id)));
    expect(t?.functions).toHaveLength(26);
    const fr07 = Object.values(FUNCTION_FIELD_KEYS);
    expect(t?.functions.filter((f) => fr07.some((k) => k in f)).map((f) => String(f.id))).toEqual([]);
    const n01 = t?.functions.find((f) => String(f.id) === 'FF-N01');
    const n02 = t?.functions.find((f) => String(f.id) === 'FF-N02');
    expect([n01?.dimension, n01?.route]).toEqual(['integrity', 'neuronal']);
    expect(n02?.dimension).toBe('semantic');
    expect(t?.defaultVerdictThresholds).toEqual({ pass: 0.8, warning: 0.65, softBlock: 0.5 });
  });

  it('(c) binding and compiled templates follow the §3.1 layered column', async () => {
    const { spec } = await parsed(LAYERED);
    expect(bindLayerParams(spec.layerModel.layers)).toEqual({
      domainLayer: 'business', applicationLayers: [], infraLayer: 'persistence', presentationLayer: 'presentation',
    });
    const c = compiled(spec);
    expect(c.symbolicQueries.map((q) => q.name).sort()).toEqual([...LAYERED_APPLICABLE].sort());
    expect(c.hybridPairs).toEqual([]);
    expect(c.neuronalInstructions.map((n) => [String(n.functionId), n.dimension, n.judgeUnit])).toEqual([
      ['FF-N01', 'integrity', 'module'], ['FF-N02', 'semantic', 'file'],
    ]);
    const params = (name: string): Readonly<Record<string, unknown>> | undefined => c.symbolicQueries.find((q) => q.name === name)?.params;
    expect(params('dependency-direction')).toEqual({ layerOrder: ['persistence', 'business', 'presentation'] });
    expect(params('no-layer-skip')).toEqual({ allowedTransitions: ['business>persistence', 'presentation>business'] });
    expect(params('domain-purity')).toMatchObject({ domainLayer: 'business' });
  });

  it('(d) no forbidden_imports entry in any presets/*.yaml starts with node:', () => {
    const presets = fs.readdirSync(path.join(ROOT, 'presets')).filter((f) => f.endsWith('.yaml')).sort();
    expect(presets).toContain('layered.yaml');
    const entries = presets.flatMap((f) => rawFunctions(`presets/${f}`).flatMap((fn) => (fn.forbidden_imports as string[] | undefined) ?? []));
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.filter((e) => e.startsWith('node:'))).toEqual([]);
  });

  it('(e) FF-P01 forbidden_imports of presets/layered.yaml equals presets/clean-architecture.yaml element by element', () => {
    const p01 = (rel: string): unknown => rawFunctions(rel).find((f) => f.id === 'FF-P01')?.forbidden_imports;
    expect(p01('presets/layered.yaml')).toEqual(['@nestjs/*', 'typeorm', 'express', 'prisma', '@prisma/*', 'sequelize']);
    expect(p01('presets/layered.yaml')).toEqual(p01('presets/clean-architecture.yaml'));
  });

  it('every declared function with an FR-07 parameter carries its value (disabled ones included); FF-CV02 is *Service|*UseCase', () => {
    const fns = rawFunctions('presets/layered.yaml');
    expect(fns.map((f) => f.id)).toEqual(LAYERED_TEMPLATE.functions.map((f) => String(f.id)));
    const reverse = new Map(Object.entries(FUNCTION_FIELD_KEYS).map(([yaml, field]) => [field as string, yaml]));
    const missing: string[] = [];
    for (const fn of fns) {
      const t = CYPHER_TEMPLATES.get(String(fn.name));
      for (const param of [...(t?.requiredParams ?? []), ...(t?.optionalParams ?? [])]) {
        const key = reverse.get(param);
        if (key != null && fn[key] == null) missing.push(`${String(fn.id)}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
    expect(fns.find((f) => f.id === 'FF-CV02')?.pattern).toBe('*Service|*UseCase');
    expect(fns.filter((f) => String(f.id).startsWith('FF-N')).every((f) => f.semantic_criteria != null)).toBe(true);
  });
});

describe('BR-U1-19 (a) visible denominator and BR-U1-15 on presets/layered.yaml', () => {
  it('declared 26, compiled 17, disabled 9 (7 by style, 2 by kind) with reasons; no ADR', async () => {
    const { spec } = await parsed(LAYERED);
    const c = compiled(spec);
    expect(spec.fitnessFunctions).toHaveLength(26);
    expect(spec.adrRules).toEqual([]);
    expect(c.totalCompiled).toBe(17);
    expect(c.disabledFunctions.map((d) => [String(d.id), d.reason])).toEqual([
      ['FF-S04', STYLE], ['FF-P02', STYLE], ['FF-P03', STYLE], ['FF-P04', STYLE], ['FF-P05', STYLE], ['FF-C01', STYLE],
      ['FF-CV01', NO_APP], ['FF-CV02', NO_APP], ['FF-CV04', STYLE],
    ]);
    expect(c.warnings.filter((w) => w.code === 'COMPILER_004')).toHaveLength(9);
  });

  it('BR-U1-15: FF-CV01 and FF-CV02 are disabled with "no application layer"', async () => {
    const c = compiled((await parsed(LAYERED)).spec);
    expect(c.disabledFunctions.filter((d) => d.reason === NO_APP).map((d) => String(d.id))).toEqual(['FF-CV01', 'FF-CV02']);
  });

  it('BR-U1-09 (d) on the preset: no unbound parameter', async () => {
    expect(findUnboundParameters(compilerInputFromSpec((await parsed(LAYERED)).spec))).toEqual([]);
  });
});

describe('BR-U1-08 (b) minimal style: layered spec (business-rules.md §6)', () => {
  it('a layered spec that declares no function fails with the six BR-SPEC-10 errors in id order', async () => {
    const file = path.join(TMP, 'minimal-layered.yaml');
    fs.writeFileSync(file, `spec_version: "1.0.0"
architecture:
  style: layered
  layers:
    - { name: persistence, kind: infrastructure, directories: [src/persistence/**], roles: [repository] }
    - { name: business, kind: domain, directories: [src/business/**], roles: [entity] }
    - { name: presentation, kind: presentation, directories: [src/presentation/**], roles: [controller] }
scoring:
  weights: { structural: 0.35, coupling: 0.20, pattern: 0.30, solid: 0.10, convention: 0.05 }
  thresholds: { pass: 0.80, warning: 0.65, soft_block: 0.50 }
confidence_thresholds: { high: 0.85, medium: 0.60, icc_minimum: 0.70 }
`);
    const { spec } = await parsed(file);
    expect(spec.fitnessFunctions).toHaveLength(26);
    const r = compileFunctions(compilerInputFromSpec(spec));
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.errors.map((e) => [e.code, e.message])).toEqual([
      ['MISSING_REQUIRED_PARAM', 'BR-SPEC-10 FF-CV03: pattern'],
      ['MISSING_REQUIRED_PARAM', 'BR-SPEC-10 FF-P01: forbiddenImports'],
      ['MISSING_REQUIRED_PARAM', 'BR-SPEC-10 FF-SO01: maxPublicMethods'],
      ['MISSING_REQUIRED_PARAM', 'BR-SPEC-10 FF-SO01: maxDependencies'],
      ['MISSING_REQUIRED_PARAM', 'BR-SPEC-10 FF-SO02: maxInterfaceMethods'],
      ['MISSING_REQUIRED_PARAM', 'BR-SPEC-10 FF-SO03: maxDepth'],
    ]);
  });
});
