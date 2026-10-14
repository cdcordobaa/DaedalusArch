/**
 * v1.3 hexagonal library: preset, registry entry, graph binding and compile path.
 * The frozen v1.2E instrument (CYPHER_TEMPLATES, TEMPLATE_REGISTRY) must not change.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { CYPHER_TEMPLATES } from '../../../src/fitness-compiler/cypher-templates.js';
import { compileFunctions } from '../../../src/fitness-compiler/fitness-compiler.js';
import { compilerInputFromSpec } from '../../../src/fitness-compiler/compiler-input.js';
import { bindHexagonalLayers, HEXAGONAL_TEMPLATES } from '../../../src/fitness-compiler/hexagonal-templates.js';
import { listPresets, loadPreset } from '../../../src/spec-parser/preset-loader.js';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';
import { EXTENSION_TEMPLATES, resolveTemplate, TEMPLATE_REGISTRY } from '../../../src/spec-parser/template-registry.js';
import type { LayerModel, ParsedSpec } from '../../../src/shared/types/spec.js';
import type { CompilerInput } from '../../../src/fitness-compiler/types.js';
import { functionId } from '../../../src/shared/types/value-objects.js';

const ROOT = path.resolve(__dirname, '../../..');
const PRESET = path.join(ROOT, 'presets/hexagonal.yaml');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'hex-preset-'));
afterAll(() => { fs.rmSync(TMP, { recursive: true, force: true }); });

const HEX_NAMES = ['dependency-direction-graph', 'layer-skip-graph', 'core-isolation', 'port-adapter-pattern', 'port-dependency-inversion'];

async function parsedPreset(): Promise<{ spec: ParsedSpec; warnings: readonly { code: string; message: string }[] }> {
  const r = await parseSpec({ specFilePath: PRESET }, { strictMode: true });
  if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
  return { spec: r.data, warnings: r.warnings ?? [] };
}

function compiledNames(input: CompilerInput): { symbolic: string[]; disabled: { name: string; reason?: string }[] } {
  const r = compileFunctions(input);
  if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
  return {
    symbolic: r.data.symbolicQueries.map((q) => q.name),
    disabled: r.data.disabledFunctions.map((d) => ({ name: d.name, ...(d.reason != null ? { reason: d.reason } : {}) })),
  };
}

describe('frozen instrument is untouched', () => {
  it('the hexagonal templates are not in CYPHER_TEMPLATES and the style is not in TEMPLATE_REGISTRY', () => {
    for (const n of HEX_NAMES) expect(CYPHER_TEMPLATES.has(n)).toBe(false);
    expect([...TEMPLATE_REGISTRY.keys()].sort()).toEqual(['clean-architecture', 'layered', 'nestjs']);
    expect([...EXTENSION_TEMPLATES.keys()]).toEqual(['hexagonal']);
  });

  it('every hexagonal template is restricted to the hexagonal style', () => {
    expect([...HEXAGONAL_TEMPLATES.keys()].sort()).toEqual([...HEX_NAMES].sort());
    for (const t of HEXAGONAL_TEMPLATES.values()) expect(t.applicableStyles).toEqual(['hexagonal']);
  });
});

describe('presets/hexagonal.yaml', () => {
  it('is listed and loads', () => {
    expect(listPresets()).toContain('hexagonal');
    const r = loadPreset('hexagonal');
    expect(r.success).toBe(true);
  });

  it('parses with five layers, explicit kinds and the allowed-dependency graph', async () => {
    const { spec, warnings } = await parsedPreset();
    expect(spec.style).toBe('hexagonal');
    expect(spec.layerModel.layers.map((l) => [l.name, l.kind, l.kindSource])).toEqual([
      ['domain', 'domain', 'explicit'],
      ['application', 'application', 'explicit'],
      ['adapters-inbound', 'presentation', 'explicit'],
      ['adapters-outbound', 'infrastructure', 'explicit'],
      ['config', 'application', 'explicit'],
    ]);
    expect(spec.layerModel.allowedDependencies).toContainEqual({ from: 'adapters-inbound', to: 'application' });
    expect(spec.layerModel.allowedDependencies).not.toContainEqual({ from: 'adapters-inbound', to: 'adapters-outbound' });
    expect(spec.layerModel.allowedDependencies).toHaveLength(9);
    expect(warnings.filter((w) => w.code !== 'SPEC_002')).toEqual([]);
  });

  it('resolveTemplate(hexagonal) swaps the five order-based ids and drops the Clean-only ones', () => {
    const t = resolveTemplate('hexagonal');
    expect(t?.style).toBe('hexagonal');
    const byId = new Map((t?.functions ?? []).map((f) => [String(f.id), f.name]));
    expect(byId.get('FF-S01')).toBe('dependency-direction-graph');
    expect(byId.get('FF-S03')).toBe('layer-skip-graph');
    expect(byId.get('FF-S04')).toBe('core-isolation');
    expect(byId.get('FF-P02')).toBe('port-dependency-inversion');
    expect(byId.get('FF-P03')).toBe('port-adapter-pattern');
    for (const dropped of ['FF-P04', 'FF-P05', 'FF-C01']) expect(byId.has(dropped)).toBe(false);
    expect(resolveTemplate('layered')?.functions).toHaveLength(27);
  });

  it('the preset declares the functions of the registry entry (same ids and names)', async () => {
    const { spec } = await parsedPreset();
    const fromPreset = spec.fitnessFunctions.map((f) => `${String(f.id)}:${f.name}`).sort();
    const fromRegistry = (resolveTemplate('hexagonal')?.functions ?? []).map((f) => `${String(f.id)}:${f.name}`).sort();
    expect(fromPreset).toEqual(fromRegistry);
  });

  it('compiles the five hexagonal functions; the graph rides in the query params', async () => {
    const { spec } = await parsedPreset();
    const r = compileFunctions(compilerInputFromSpec(spec));
    expect(r.success).toBe(true);
    if (!r.success) return;
    const byName = new Map(r.data.symbolicQueries.map((q) => [q.name, q]));
    for (const n of HEX_NAMES) expect(byName.has(n)).toBe(true);
    expect(byName.get('layer-skip-graph')?.params.allowedDependencies).toContain('config>adapters-outbound');
    expect(byName.get('port-adapter-pattern')?.params).toMatchObject({
      infraLayer: 'adapters-outbound', portLayers: ['domain', 'application'],
    });
    // the composition root (`config`) is not a use-case layer
    expect(byName.get('port-dependency-inversion')?.params.applicationLayers).toEqual(['application']);
    // only the two functions the layered preset also switches off (ADR-016 b) are disabled
    expect(r.data.disabledFunctions.map((d) => d.name)).toEqual(['naming-conventions', 'naming-controllers']);
    const ids = r.data.symbolicQueries.map((q) => String(q.functionId));
    expect(ids).toEqual([...ids].sort((a, b) => spec.fitnessFunctions.findIndex((f) => String(f.id) === a) - spec.fitnessFunctions.findIndex((f) => String(f.id) === b)));
  });

  it('a Clean-Architecture-only function declared under the hexagonal style is disabled with the style reason', async () => {
    const { spec } = await parsedPreset();
    const [first] = spec.fitnessFunctions;
    if (first === undefined) throw new Error('preset has no functions');
    const extra = { ...first, id: functionId('FF-P09'), name: 'repository-pattern' };
    const out = compiledNames({ ...compilerInputFromSpec(spec), fitnessFunctions: [...spec.fitnessFunctions, extra] });
    expect(out.disabled).toContainEqual({ name: 'repository-pattern', reason: 'not applicable to style hexagonal' });
  });
});

describe('allowed_dependencies is read by the hexagonal style only', () => {
  it('another style ignores it with SPEC_001', async () => {
    const text = fs.readFileSync(path.join(ROOT, 'presets/layered.yaml'), 'utf-8')
      .replace('  layers:', '  allowed_dependencies:\n    - from: business\n      to: [persistence]\n  layers:');
    const file = path.join(TMP, 'layered-with-graph.yaml');
    fs.writeFileSync(file, text);
    const r = await parseSpec({ specFilePath: file }, { strictMode: true });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.layerModel.allowedDependencies).toBeUndefined();
    expect(r.warnings?.some((w) => w.code === 'SPEC_001' && w.message.includes('allowed_dependencies'))).toBe(true);
  });
});

describe('bindHexagonalLayers', () => {
  const layer = (name: string, kind: 'domain' | 'application' | 'presentation' | 'infrastructure'): LayerModel['layers'][number] =>
    ({ name, directories: [`src/${name}/**`], naming: [], role: 'x', kind });
  const base: LayerModel = {
    layers: [layer('core', 'domain'), layer('uc', 'application'), layer('in', 'presentation'), layer('out', 'infrastructure')],
    allowedDependencies: [{ from: 'uc', to: 'core' }, { from: 'in', to: 'uc' }, { from: 'out', to: 'uc' }],
  };

  it('binds roles by kind and builds from>to strings', () => {
    const r = bindHexagonalLayers(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.binding).toMatchObject({
      domainLayer: 'core', applicationLayers: ['uc'], inboundLayer: 'in', outboundLayer: 'out', compositionRoots: [], portLayers: ['core', 'uc'],
    });
    expect(r.binding.allowedDependencies).toEqual(['uc>core', 'in>uc', 'out>uc']);
  });

  it('a layer nothing points to that reaches every other layer is the composition root', () => {
    const withRoot: LayerModel = {
      layers: [...base.layers, layer('wiring', 'application')],
      allowedDependencies: [...(base.allowedDependencies ?? []), ...['core', 'uc', 'in', 'out'].map((to) => ({ from: 'wiring', to }))],
    };
    const r = bindHexagonalLayers(withRoot);
    expect(r.ok && r.binding.compositionRoots).toEqual(['wiring']);
    expect(r.ok && r.binding.applicationLayers).toEqual(['uc']);
  });

  it('refuses a missing graph, an unknown layer, a self edge and a missing role', () => {
    const noGraph = bindHexagonalLayers({ layers: base.layers });
    expect(!noGraph.ok && noGraph.errors).toContain('hexagonal style requires architecture.allowed_dependencies');
    const unknown = bindHexagonalLayers({ ...base, allowedDependencies: [{ from: 'uc', to: 'nowhere' }] });
    expect(!unknown.ok && unknown.errors).toContain('allowed_dependencies names unknown layer "nowhere"');
    const self = bindHexagonalLayers({ ...base, allowedDependencies: [{ from: 'uc', to: 'uc' }] });
    expect(!self.ok && self.errors).toContain('allowed_dependencies has a self edge on "uc"');
    const noOut = bindHexagonalLayers({ ...base, layers: base.layers.filter((l) => l.name !== 'out') });
    expect(!noOut.ok && noOut.errors.some((e) => e.includes('outbound'))).toBe(true);
  });

  it('compileFunctions fails a hexagonal input without a graph and leaves other styles alone', async () => {
    const { spec } = await parsedPreset();
    const { allowedDependencies: _dropped, ...noGraph } = spec.layerModel;
    const failed = compileFunctions({ ...compilerInputFromSpec(spec), layerModel: noGraph });
    expect(failed.success).toBe(false);
    const layered = await parseSpec({ specFilePath: path.join(ROOT, 'presets/layered.yaml') }, { strictMode: true });
    expect(layered.success).toBe(true);
    if (!layered.success) return;
    const names = compiledNames(compilerInputFromSpec(layered.data)).symbolic;
    expect(names).toContain('no-layer-skip');
    for (const n of HEX_NAMES) expect(names).not.toContain(n);
  });
});
