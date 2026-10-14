/**
 * v1.3 DDD library (FR-V4): preset, registry entry, tiers, declarations binding and compile path.
 * The frozen v1.2E instrument (CYPHER_TEMPLATES, TEMPLATE_REGISTRY) must not change.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import YAML from 'yaml';
import { CYPHER_TEMPLATES } from '../../../src/fitness-compiler/cypher-templates.js';
import { compileFunctions } from '../../../src/fitness-compiler/fitness-compiler.js';
import { compilerInputFromSpec } from '../../../src/fitness-compiler/compiler-input.js';
import { bindDddModel, DDD_TEMPLATES, SETTER_NAME_PATTERN } from '../../../src/fitness-compiler/ddd-templates.js';
import { HEXAGONAL_TEMPLATES } from '../../../src/fitness-compiler/hexagonal-templates.js';
import { getExtensionTemplate } from '../../../src/fitness-compiler/extension-templates.js';
import { listPresets, loadPreset } from '../../../src/spec-parser/preset-loader.js';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';
import { EXTENSION_TEMPLATES, resolveTemplate, TEMPLATE_REGISTRY } from '../../../src/spec-parser/template-registry.js';
import type { DddModel, LayerModel } from '../../../src/shared/types/spec.js';
import { must } from './reference-project.js';

const ROOT = path.resolve(__dirname, '../../..');
const PRESET = path.join(ROOT, 'presets/ddd.yaml');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ddd-preset-'));
afterAll(() => { fs.rmSync(TMP, { recursive: true, force: true }); });

const DDD_NAMES = ['bounded-context-modules', 'context-isolation', 'aggregate-boundary', 'repository-aggregate-root',
  'value-object-immutability', 'domain-event-placement', 'application-service-thin'];

/** The tiers sealed in Docs/v1.3/rule-tiers.md (Docs/v1.3-ddd-notes.md §2). */
const TIERS: Readonly<Record<string, 'blocking' | 'advisory'>> = {
  'FF-DS01': 'blocking', 'FF-DS02': 'blocking', 'FF-DT01': 'blocking', 'FF-DT02': 'blocking', 'FF-DT03': 'blocking',
  'FF-DT04': 'blocking', 'FF-DT05': 'advisory', 'FF-DT06': 'advisory', 'FF-S01': 'blocking', 'FF-S03': 'advisory',
};

function presetRaw(): Record<string, unknown> {
  return YAML.parse(fs.readFileSync(PRESET, 'utf8')) as Record<string, unknown>;
}

async function parseRaw(raw: Record<string, unknown>, name: string) {
  const file = path.join(TMP, `${name}.yaml`);
  fs.writeFileSync(file, YAML.stringify(raw));
  return parseSpec({ specFilePath: file }, { strictMode: true });
}

async function presetLayerModel(): Promise<LayerModel> {
  const r = await parseSpec({ specFilePath: PRESET }, { strictMode: true });
  if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
  return r.data.layerModel;
}

function withDdd(model: LayerModel, change: (d: DddModel) => DddModel): LayerModel {
  return { ...model, ddd: change(must(model.ddd, 'ddd')) };
}

describe('frozen instrument is untouched', () => {
  it('no DDD template is in CYPHER_TEMPLATES and the style is not in TEMPLATE_REGISTRY', () => {
    for (const n of DDD_NAMES) expect(CYPHER_TEMPLATES.has(n)).toBe(false);
    expect([...TEMPLATE_REGISTRY.keys()].sort()).toEqual(['clean-architecture', 'layered', 'nestjs']);
    expect([...EXTENSION_TEMPLATES.keys()].sort()).toEqual(['ddd', 'hexagonal']);
  });

  it('every DDD template is restricted to the ddd style and found by the extension lookup', () => {
    expect([...DDD_TEMPLATES.keys()].sort()).toEqual([...DDD_NAMES].sort());
    for (const t of DDD_TEMPLATES.values()) {
      expect(t.applicableStyles).toEqual(['ddd']);
      expect(getExtensionTemplate(t.functionName)).toBe(t);
    }
    for (const t of HEXAGONAL_TEMPLATES.values()) expect(getExtensionTemplate(t.functionName)).toBe(t);
  });
});

describe('presets/ddd.yaml', () => {
  it('is listed, loads and resolves to the ddd library', () => {
    expect(listPresets()).toContain('ddd');
    expect(loadPreset('ddd').success).toBe(true);
    expect(resolveTemplate('ddd')?.style).toBe('ddd');
    expect(resolveTemplate('DDD')?.style).toBe('ddd');
  });

  it('parses strictly; the only warnings are the expected template overrides', async () => {
    const r = await parseSpec({ specFilePath: PRESET }, { strictMode: true });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect((r.warnings ?? []).filter((w) => w.code !== 'SPEC_002')).toEqual([]);
    expect(r.data.style).toBe('ddd');
    expect(r.data.layerModel.ddd?.contexts.map((c) => c.name)).toEqual(['ordering', 'billing']);
    expect(r.data.layerModel.allowedDependencies?.length).toBe(9);
  });

  it('every function carries its a-priori tier, in the preset and in the built-in library', async () => {
    const r = await parseSpec({ specFilePath: PRESET }, { strictMode: true });
    if (!r.success) throw new Error('parse');
    expect(Object.fromEntries(r.data.fitnessFunctions.map((f) => [String(f.id), f.tier]))).toEqual(TIERS);
    expect(Object.fromEntries(must(resolveTemplate('ddd'), 'ddd template').functions.map((f) => [String(f.id), f.tier]))).toEqual(TIERS);
  });

  it('advisory rules are not critical; blocking rules are', async () => {
    const r = await parseSpec({ specFilePath: PRESET }, { strictMode: true });
    if (!r.success) throw new Error('parse');
    for (const f of r.data.fitnessFunctions) {
      if (f.tier === 'blocking') expect(f.severity).toBe('critical');
      else expect(f.severity).not.toBe('critical');
    }
  });

  it('compiles all ten functions, none disabled, each from the right template map', async () => {
    const r = await parseSpec({ specFilePath: PRESET }, { strictMode: true });
    if (!r.success) throw new Error('parse');
    const c = compileFunctions(compilerInputFromSpec(r.data));
    expect(c.success).toBe(true);
    if (!c.success) return;
    expect(c.data.disabledFunctions).toEqual([]);
    expect(c.data.symbolicQueries.map((q) => String(q.functionId))).toEqual(Object.keys(TIERS));
    for (const q of c.data.symbolicQueries) {
      const t = DDD_TEMPLATES.get(q.name) ?? HEXAGONAL_TEMPLATES.get(q.name) ?? CYPHER_TEMPLATES.get(q.name);
      expect(t).toBeDefined();
      for (const p of must(t, q.name).requiredParams) expect(q.params).toHaveProperty(p);
    }
  });
});

describe('ddd-only spec additions', () => {
  it('another style ignores `tier` and `ddd` with SPEC_001', async () => {
    const raw = presetRaw();
    const arch = raw.architecture as Record<string, unknown>;
    const layered = YAML.parse(fs.readFileSync(path.join(ROOT, 'presets/layered.yaml'), 'utf8')) as Record<string, unknown>;
    const larch = layered.architecture as Record<string, unknown>;
    larch.ddd = arch.ddd;
    must((layered.fitness_functions as Record<string, unknown>[])[0], 'function').tier = 'blocking';
    const r = await parseRaw(layered, 'layered-with-ddd');
    expect(r.success).toBe(true);
    if (!r.success) return;
    const w = (r.warnings ?? []).filter((x) => x.code === 'SPEC_001').map((x) => x.message);
    expect(w.some((m) => m.includes('"ddd"'))).toBe(true);
    expect(w.some((m) => m.includes('"tier"'))).toBe(true);
    expect(r.data.layerModel.ddd).toBeUndefined();
    expect(r.data.fitnessFunctions.every((f) => f.tier === undefined)).toBe(true);
  });

  it('an invalid tier value is a schema error', async () => {
    const raw = presetRaw();
    must((raw.fitness_functions as Record<string, unknown>[])[0], 'function').tier = 'mandatory';
    const r = await parseRaw(raw, 'bad-tier');
    expect(r.success).toBe(false);
  });

  it('the ddd style without architecture.ddd fails to compile with a clear error', async () => {
    const raw = presetRaw();
    delete (raw.architecture as Record<string, unknown>).ddd;
    const r = await parseRaw(raw, 'no-ddd-block');
    if (!r.success) throw new Error('parse');
    const c = compileFunctions(compilerInputFromSpec(r.data));
    expect(c.success).toBe(false);
    if (c.success) return;
    expect(c.errors.map((e) => e.message)).toContain('ddd style requires architecture.ddd');
  });
});

describe('bindDddModel', () => {
  it('binds the preset: roots as prefixes, globs as anchored regexes', async () => {
    const b = bindDddModel(await presetLayerModel());
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.binding.contextRoots).toEqual(['src/ordering/', 'src/billing/']);
    expect(b.binding.domainLayers).toEqual(['domain']);
    expect(b.binding.aggregates.map((a) => a.name)).toEqual(['Order', 'Customer', 'Invoice']);
    const vo = new RegExp(must(b.binding.valueObjectPatterns[0], 'vo'));
    expect(vo.test('src/ordering/domain/order/value-objects/OrderId.ts')).toBe(true);
    expect(vo.test('src/ordering/domain/order/Order.ts')).toBe(false);
    const svc = new RegExp(must(b.binding.applicationServicePatterns[0], 'svc'));
    expect(svc.test('src/billing/application/IssueInvoice.ts')).toBe(true);
    expect(svc.test('src/billing/application/ports/OrderSource.ts')).toBe(false);
  });

  it('refuses a context root that is not a top-level module', async () => {
    const m = withDdd(await presetLayerModel(), (d) => ({ ...d, contexts: d.contexts.map((c, i) => (i === 0 ? { ...c, root: 'src/modules/ordering/' } : c)) }));
    const b = bindDddModel(m);
    expect(b.ok).toBe(false);
    if (b.ok) return;
    expect(b.errors.join('\n')).toMatch(/not a top-level module/);
  });

  it('refuses public-API and ACL globs outside their context root', async () => {
    const m = withDdd(await presetLayerModel(), (d) => ({ ...d, contexts: d.contexts.map((c) => ({ ...c, acl: ['src/shared-kernel/**'] })) }));
    const b = bindDddModel(m);
    expect(b.ok).toBe(false);
  });

  it('refuses an aggregate in an unknown context, outside its context, or whose root is an inner entity', async () => {
    const base = await presetLayerModel();
    const bad = [
      withDdd(base, (d) => ({ ...d, aggregates: [{ ...must(d.aggregates[0], 'aggregate'), context: 'shipping' }] })),
      withDdd(base, (d) => ({ ...d, aggregates: [{ ...must(d.aggregates[0], 'aggregate'), module: 'src/billing/domain/order/**' }] })),
      withDdd(base, (d) => ({ ...d, aggregates: [{ ...must(d.aggregates[0], 'aggregate'), innerEntities: [must(d.aggregates[0], 'aggregate').root] }] })),
    ];
    for (const m of bad) expect(bindDddModel(m).ok).toBe(false);
  });

  it('refuses a duplicate context and a source root without a trailing slash', async () => {
    const base = await presetLayerModel();
    expect(bindDddModel(withDdd(base, (d) => ({ ...d, contexts: [must(d.contexts[0], 'context'), must(d.contexts[0], 'context')] }))).ok).toBe(false);
    expect(bindDddModel(withDdd(base, (d) => ({ ...d, sourceRoot: 'src' }))).ok).toBe(false);
  });
});

describe('template text', () => {
  const cypher = (name: string): string => must(DDD_TEMPLATES.get(name), name).template;

  it('context-isolation allows the public API and the ACL, and compares the first matching root', () => {
    const c = cypher('context-isolation');
    expect(c).toContain('srcCtx[0] <> tgtCtx[0]');
    expect(c).toContain('NONE(p IN $publicApiPatterns WHERE tgt.filePath =~ p)');
    expect(c).toContain('NONE(p IN $aclPatterns WHERE src.filePath =~ p)');
    // files a public-API barrel of the target context re-exports count as published (barrel routing, notes §6)
    expect(c).toContain('MATCH (api:File)-[:RE_EXPORTS*1..]->(tgt)');
    expect(c).toContain('api.filePath STARTS WITH tgtCtx[0]');
  });

  it('aggregate-boundary and repository-aggregate-root read the inner entities per aggregate', () => {
    expect(cypher('aggregate-boundary')).toContain('AND NOT src.filePath =~ agg.module');
    expect(cypher('repository-aggregate-root')).toContain('ANY(p IN $repositoryPatterns WHERE src.filePath =~ p)');
    for (const n of ['aggregate-boundary', 'repository-aggregate-root']) expect(cypher(n)).toContain('ANY(p IN agg.innerEntities WHERE tgt.filePath =~ p)');
  });

  it('the value-object proxy matches setter names only, non-static', () => {
    expect(cypher('value-object-immutability')).toContain("last(split(m.name, '.')) =~ $setterPattern");
    const re = new RegExp(`^(?:${SETTER_NAME_PATTERN})$`);
    expect(['setValue', 'setX'].every((n) => re.test(n))).toBe(true);
    expect(['settle', 'set', 'reset', 'value'].some((n) => re.test(n))).toBe(false);
  });

  it('domain-event-placement follows IMPLEMENTS and EXTENDS transitively', () => {
    expect(cypher('domain-event-placement')).toContain('-[:IMPLEMENTS|EXTENDS*1..]->(e)');
  });

  it('exclude_paths are injected into a DDD template', async () => {
    const raw = presetRaw();
    const ff = must((raw.fitness_functions as Record<string, unknown>[]).find((f) => f.id === 'FF-DS01'), 'FF-DS01');
    ff.exclude_paths = ['src/generated/**'];
    const r = await parseRaw(raw, 'excludes');
    if (!r.success) throw new Error('parse');
    const c = compileFunctions(compilerInputFromSpec(r.data));
    if (!c.success) throw new Error('compile');
    const q = must(c.data.symbolicQueries.find((x) => String(x.functionId) === 'FF-DS01'), 'FF-DS01 query');
    expect(q.cypher).toContain('AND NONE(ep IN $excludePatterns WHERE f.filePath =~ ep)');
    expect(q.params).toHaveProperty('excludePatterns');
    for (const other of c.data.symbolicQueries.filter((x) => String(x.functionId) !== 'FF-DS01')) expect(other.cypher).not.toContain('$excludePatterns');
  });
});
