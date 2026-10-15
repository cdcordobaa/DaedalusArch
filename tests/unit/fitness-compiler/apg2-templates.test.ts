/**
 * APG v2 extension templates (`apg2-templates.ts`) and their in-memory mirrors (`apg2-in-memory.ts`), run on the
 * ablation suite `tests/fixtures/v1.3-apg2/cases.json`: (a) every planted case is reported on the APG v2 graph,
 * (b) not on the v1.3 graph (`V13_DEFAULT_OPTIONS`), and no near-miss or the clean control is reported. The live
 * Cypher run needs Neo4j and is not part of this suite (Docs/DiagnosticRuns/apg2-ablation-2026-10-15.md).
 */
import * as path from 'node:path';
import { readFileSync } from 'node:fs';
import { extractAPG, componentsFromLayerModel, V13_APG2_OPTIONS, V13_DEFAULT_OPTIONS } from '../../../src/apg-extractor/index.js';
import type { ComponentDeclaration } from '../../../src/apg-extractor/index.js';
import { APG2_TEMPLATES, APG2_TEMPLATE_TIERS } from '../../../src/fitness-compiler/apg2-templates.js';
import { APG2_IN_MEMORY, apg2Params, memGraph } from '../../../src/fitness-compiler/apg2-in-memory.js';
import type { MemGraph, Row } from '../../../src/fitness-compiler/apg2-in-memory.js';
import { linkingEdges, v13DependencyDirection, v13DomainPurity, v13NoCyclicDeps } from '../../../src/fitness-compiler/v13-in-memory-baselines.js';
import { V13_EXTENSION_TEMPLATE_CATALOGUES, v13ExtensionCatalogueOf } from '../../../src/fitness-compiler/extension-templates.js';
import { CYPHER_TEMPLATES } from '../../../src/fitness-compiler/cypher-templates.js';
import type { LayerDefinition, LayerModel } from '../../../src/shared/types/spec.js';
import type { LayerKind } from '../../../src/shared/types/enums.js';

const SUITE = path.resolve(__dirname, '../../fixtures/v1.3-apg2');

interface ProjectSpec {
  layers: { name: string; directories: string[]; kind: LayerKind }[];
  components: 'layers' | 'folders' | ComponentDeclaration[];
  forbiddenImports: string[];
  allowedAsync?: string[];
}
interface Case { id: string; project: string; kind: 'planted' | 'near-miss' | 'control'; template: string; match: Record<string, unknown>; locus?: { source: string; target?: string } }
const suite = JSON.parse(readFileSync(path.join(SUITE, 'cases.json'), 'utf8')) as { projects: Record<string, ProjectSpec>; cases: Case[] };

const layerModelOf = (p: ProjectSpec): LayerModel => ({
  layers: p.layers.map((l): LayerDefinition => ({ name: l.name, directories: l.directories, naming: [], role: '', kind: l.kind, kindSource: 'explicit' })),
});
const componentsOf = (p: ProjectSpec): ComponentDeclaration[] =>
  p.components === 'folders' ? [] : p.components === 'layers' ? componentsFromLayerModel(layerModelOf(p)) : p.components;
const matches = (row: Row, m: Record<string, unknown>): boolean => Object.entries(m).every(([k, v]) => JSON.stringify(row[k]) === JSON.stringify(v));

interface Graphs { v2: MemGraph; v13: MemGraph; params: ReturnType<typeof apg2Params>; spec: ProjectSpec }
const graphs = new Map<string, Graphs>();

beforeAll(async () => {
  for (const [name, p] of Object.entries(suite.projects)) {
    const dir = path.join(SUITE, name);
    const lm = layerModelOf(p);
    const v2 = await extractAPG(dir, { ...V13_APG2_OPTIONS, components: componentsOf(p) });
    const v13 = await extractAPG(dir, V13_DEFAULT_OPTIONS);
    if (!v2.success || !v13.success) throw new Error(`extraction failed: ${name}`);
    graphs.set(name, { v2: memGraph(v2.data, lm), v13: memGraph(v13.data, lm), params: apg2Params(lm, p.allowedAsync !== undefined ? { allowedAsync: p.allowedAsync } : {}), spec: p });
  }
}, 120_000);

function graphsOf(project: string): Graphs {
  const g = graphs.get(project);
  if (g === undefined) throw new Error(`no graphs for ${project}`);
  return g;
}

function run(template: string, g: MemGraph, params: Graphs['params']): Row[] {
  const f = APG2_IN_MEMORY.get(template);
  if (f === undefined) throw new Error(`no mirror for ${template}`);
  return f(g, params);
}

const rowsOf = (g: MemGraph, c: Case, params: Graphs['params']): Row[] =>
  (c.template === '*' ? [...APG2_IN_MEMORY.keys()] : [c.template]).flatMap((t) => run(t, g, params)).filter((r) => matches(r, c.match));

describe('APG v2 template catalogue', () => {
  it('is registered as the apg2 extension catalogue, apart from the frozen CYPHER_TEMPLATES', () => {
    expect(V13_EXTENSION_TEMPLATE_CATALOGUES.get('apg2')).toBe(APG2_TEMPLATES);
    for (const name of APG2_TEMPLATES.keys()) {
      expect(v13ExtensionCatalogueOf(name)).toBe('apg2');
      expect(CYPHER_TEMPLATES.has(name)).toBe(false);
    }
  });

  it('gives every template an in-memory mirror and an a priori tier', () => {
    expect([...APG2_IN_MEMORY.keys()].sort()).toEqual([...APG2_TEMPLATES.keys()].sort());
    expect([...APG2_TEMPLATE_TIERS.keys()].sort()).toEqual([...APG2_TEMPLATES.keys()].sort());
    const blocking = [...APG2_TEMPLATE_TIERS].filter(([, t]) => t.tier === 'blocking').map(([n]) => n).sort();
    expect(blocking).toEqual(['boundary-type-leak', 'component-adp-cycle', 'deep-import-declared-api', 'io-outside-adapters']);
  });

  it.each([...APG2_TEMPLATES.values()].map((t) => [t.functionName, t] as const))('%s: Cypher reads its APG v2 edges and binds its params', (_, t) => {
    expect(t.template).toMatch(/SIGNATURE_USES|DEPENDS_ON|:Component|DEEP_IMPORT|PUBLISHES|PERFORMS_IO/);
    for (const p of t.requiredParams) expect(t.template).toContain(`$${p}`);
    expect(t.template).toContain(`AS ${t.resultMapping.filePathColumn}`);
    for (const c of t.resultMapping.discriminatorColumns) expect(t.template).toContain(`AS ${c}`);
  });
});

describe('APG v2 ablation suite (in-memory)', () => {
  it.each(suite.cases.map((c) => [c.id, c] as const))('%s', (_, c) => {
    const g = graphsOf(c.project);
    const a = rowsOf(g.v2, c, g.params);
    if (c.kind === 'planted') {
      expect(a.length).toBeGreaterThan(0); // (a) APG v2 reports it
      expect(rowsOf(g.v13, c, g.params)).toEqual([]); // (b) the v1.3 graph has none of the edges
    } else {
      expect(a).toEqual([]);
    }
  });

  it('the v1.3 rules closest to each planted case do not report it at its locus', () => {
    for (const c of suite.cases.filter((x) => x.kind === 'planted')) {
      const g = graphsOf(c.project);
      const lm = layerModelOf(g.spec);
      const rows = [
        ...v13DependencyDirection(g.v13, lm.layers.map((l) => l.name)),
        ...v13NoCyclicDeps(g.v13),
        ...v13DomainPurity(g.v13, g.params.domainLayer, g.spec.forbiddenImports),
      ];
      const atLocus = rows.filter((r) => r.source === c.locus?.source && (c.locus?.target === undefined || r.target === c.locus.target));
      expect({ id: c.id, atLocus }).toEqual({ id: c.id, atLocus: [] });
    }
  });

  it('type leaks and async coupling have no v1.3 edge between the two files at all', () => {
    for (const c of suite.cases.filter((x) => x.kind === 'planted' && /^(TF[1-4]|AS\d)$/.test(x.id))) {
      const g = graphsOf(c.project);
      expect({ id: c.id, edges: linkingEdges(g.v13, c.locus?.source ?? '', c.locus?.target ?? '') }).toEqual({ id: c.id, edges: [] });
    }
  });

  it('the v1.3 baselines do fire on their own constructs (near-miss controls)', () => {
    const comp = graphsOf('components');
    expect(v13NoCyclicDeps(comp.v13).map((r) => r.cycle)).toEqual([['src/audit/a.ts', 'src/audit/b.ts']]);
    const io = graphsOf('io');
    expect(v13DomainPurity(io.v13, 'domain', ['fs'])).toEqual([{ rule: 'domain-purity', source: 'src/domain/stats.ts', target: 'fs' }]);
  });

  it('the cycles also violate SDP in one direction, as Martin notes; the planted SDP row is present', () => {
    const g = graphsOf('components');
    const sdp = run('component-sdp-violation', g.v2, g.params).map((r) => `${String(r.component)}->${String(r.target)}`);
    expect(sdp).toContain('kernel->plugins');
    expect(sdp).not.toContain('plugins->vendor-a');
  });
});

describe('apg2Params', () => {
  it('binds layers by kind, and allowedAsync from the hexagonal allowed dependencies when no list is given', () => {
    const lm: LayerModel = {
      layers: [
        { name: 'core', directories: ['src/core/**'], naming: [], role: '', kind: 'domain' },
        { name: 'adapters', directories: ['src/adapters/**'], naming: [], role: '', kind: 'infrastructure' },
      ],
      allowedDependencies: [{ from: 'adapters', to: 'core' }],
    };
    expect(apg2Params(lm)).toEqual({ domainLayer: 'core', applicationLayers: [], infraLayer: 'adapters', controllerLayer: 'adapters', threshold: 0.7, allowedAsync: ['adapters->core'] });
    expect(apg2Params(lm, { allowedAsync: [], threshold: 0.5 })).toMatchObject({ allowedAsync: [], threshold: 0.5 });
  });
});
