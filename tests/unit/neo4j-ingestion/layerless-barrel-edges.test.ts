/**
 * MT-B1 regression (Docs/DiagnosticRuns/v1.3-mtb1-fix-2026-10-16.md): a barrel that belongs to no layer hid what it
 * re-exports from the literal-view layer rules. Fixture `fixtures/unit/v13-mtb1-layerless-barrel` is the minimal
 * nestjs v10 + barrel-add shape: `src/domain/registration-policy.ts` imports `InMemoryRegistrationRepository` through
 * `src/registrations/index.ts`, which no directory glob or file pattern of the nestjs spec matches.
 *
 * The fix is a graph-build step (`liftLayerlessBarrelEdges`), OFF by default; the Cypher templates are untouched.
 */
import * as os from 'node:os';
import * as path from 'node:path';
import { extractAPG } from '../../../src/apg-extractor/index.js';
import { annotateNodes } from '../../../src/neo4j-ingestion/layer-annotator.js';
import { liftLayerlessBarrelEdges } from '../../../src/neo4j-ingestion/layerless-barrel-edges.js';
import { createPipeline } from '../../../src/pipeline/pipeline-factory.js';
import type { PipelineConfig } from '../../../src/pipeline/types.js';
import { literalEdgeView } from '../../../src/shared/apg-edge-view.js';
import type { APGEdge, APGNode, APGResult } from '../../../src/shared/types/apg.js';
import type { EvaluationReport } from '../../../src/shared/types/evaluation.js';
import type { LayerModel } from '../../../src/shared/types/spec.js';

const FIXTURE = path.resolve(__dirname, '../../../fixtures/unit/v13-mtb1-layerless-barrel');
const POLICY = 'src/domain/registration-policy.ts';
const REPO = 'src/registrations/in-memory-registration.repository.ts';

async function evaluate(literalThroughLayerlessBarrels: boolean): Promise<EvaluationReport> {
  const config: PipelineConfig = {
    projectPath: FIXTURE,
    specFilePath: path.join(FIXTURE, 'spec.yaml'),
    neo4jUri: '', neo4jUser: '', neo4jPassword: '',
    evaluationMode: 'symbolic-only',
    pipelineMode: 'stateless',
    persist: false, diff: false, verbose: false,
    apgStorePath: path.join(os.tmpdir(), 'daedalus-mtb1-apg-store'),
    scoringMode: 'v1.3',
    graphEngine: 'cypher-interp',
    ...(literalThroughLayerlessBarrels && { literalThroughLayerlessBarrels: true }),
  };
  const { executor, cleanup } = createPipeline(config);
  try {
    const r = await executor.execute();
    if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
    return r.data;
  } finally {
    await cleanup();
  }
}

function layerRows(report: EvaluationReport): string[] {
  return report.violations
    .filter((v) => v.functionId === 'FF-S01' || v.functionId === 'FF-S04')
    .map((v) => `${v.functionId} ${v.filePath} -> ${String((v as { target?: string }).target)}`)
    .sort();
}

describe('MT-B1: a layerless barrel and the literal-view layer rules (cypher-interp, end to end)', () => {
  let off: EvaluationReport;
  let on: EvaluationReport;
  beforeAll(async () => {
    off = await evaluate(false);
    on = await evaluate(true);
  }, 120_000);

  it('default (OFF): the domain -> infrastructure import through the barrel is invisible to FF-S01 and FF-S04', () => {
    expect(layerRows(off)).toEqual([]);
  });

  it('ON: FF-S01 and FF-S04 report it, against the declaring file', () => {
    expect(layerRows(on)).toEqual([`FF-S01 ${POLICY} -> ${REPO}`, `FF-S04 ${POLICY} -> ${REPO}`]);
    const blocking = (r: EvaluationReport): string[] =>
      (r.tiers?.blocking.rules ?? []).filter((x) => x.violated).map((x) => x.functionId).sort();
    expect(blocking(off)).toEqual(['FF-P03']);
    expect(blocking(on)).toEqual(['FF-P03', 'FF-S01', 'FF-S04']);
  });
});

// ── The graph-build step on its own ─────────────────────────────────────────────────────────────────────────────────

function file(id: string, filePath: string): APGNode {
  return { id, type: 'File', name: path.basename(filePath), filePath, properties: {} } as unknown as APGNode;
}

function imports(id: string, from: string, to: string, props: Record<string, unknown>): APGEdge {
  return { id, type: 'IMPORTS', sourceId: from, targetId: to, properties: { importedNames: ['X'], ...props } };
}

const LAYERS = (ddd?: LayerModel['ddd']): LayerModel => ({
  layers: [
    { name: 'domain', directories: ['src/*/domain/**', 'src/domain/**'], naming: [], role: '' },
    { name: 'infrastructure', directories: ['src/infra/**'], naming: [], filePatterns: ['**/*.repository.ts'], role: '' },
  ],
  ...(ddd !== undefined && { ddd }),
});

const NODES = [
  file('a', 'src/domain/a.ts'),
  file('barrel', 'src/feature/index.ts'),
  file('repo', 'src/feature/x.repository.ts'),
  file('plain', 'src/feature/plain.ts'),
  file('infraBarrel', 'src/infra/index.ts'),
  file('infraFile', 'src/infra/y.ts'),
  file('ctxBarrel', 'src/ordering/index.ts'),
  file('ctxFile', 'src/ordering/domain/Order.ts'),
];

function lift(edges: APGEdge[], ddd?: LayerModel['ddd']): ReturnType<typeof liftLayerlessBarrelEdges> {
  const model = LAYERS(ddd);
  return liftLayerlessBarrelEdges(NODES, edges, annotateNodes(NODES, model).annotations, model);
}

describe('liftLayerlessBarrelEdges', () => {
  const resolved = imports('e1', 'a', 'repo', { viaReExport: true, reExportBarrels: ['src/feature/index.ts'] });
  const hop = imports('e0', 'a', 'barrel', { reExportHop: true });

  it('drops viaReExport on a resolved edge through a layerless barrel to a layered file; the hop edge is unchanged', () => {
    const r = lift([hop, resolved]);
    expect(r.lifted).toEqual(['e1']);
    expect(r.edges[0]).toBe(hop);
    expect(r.edges[1]?.properties).toEqual({
      importedNames: ['X'], reExportBarrels: ['src/feature/index.ts'], literalThroughLayerlessBarrel: true,
    });
    expect(literalEdgeView(r.edges).map((e) => e.id)).toEqual(['e0', 'e1']);
  });

  it('leaves the edge alone when a barrel has a layer, the target has none, or the barrel is unknown', () => {
    const layeredBarrel = imports('e2', 'a', 'infraFile', { viaReExport: true, reExportBarrels: ['src/infra/index.ts'] });
    const mixed = imports('e3', 'a', 'repo', { viaReExport: true, reExportBarrels: ['src/feature/index.ts', 'src/infra/index.ts'] });
    const layerlessTarget = imports('e4', 'a', 'plain', { viaReExport: true, reExportBarrels: ['src/feature/index.ts'] });
    const unknown = imports('e5', 'a', 'repo', { viaReExport: true, reExportBarrels: ['src/elsewhere/index.ts'] });
    const plain = imports('e6', 'a', 'repo', {});
    const edges = [layeredBarrel, mixed, layerlessTarget, unknown, plain];
    const r = lift(edges);
    expect(r.lifted).toEqual([]);
    r.edges.forEach((e, i) => {
      expect(e).toBe(edges[i]);
    });
  });

  it('keeps a declared DDD public-API barrel as the boundary (MT-B3, probe g02)', () => {
    const ddd = {
      sourceRoot: 'src/', outsideContexts: [], aggregates: [], valueObjects: [], repositories: [],
      domainEventTypes: [], applicationServices: [],
      contexts: [{ name: 'ordering', root: 'src/ordering/', publicApi: ['src/ordering/index.ts'], acl: [] }],
    };
    const viaApi = imports('e7', 'a', 'ctxFile', { viaReExport: true, reExportBarrels: ['src/ordering/index.ts'] });
    expect(lift([viaApi], ddd).lifted).toEqual([]);
    // Without the declaration the same barrel is just a layerless file.
    expect(lift([viaApi]).lifted).toEqual(['e7']);
  });
});

describe('the fixture graph', () => {
  let apg: APGResult;
  beforeAll(async () => {
    const r = await extractAPG(FIXTURE, {});
    if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
    apg = r.data;
  }, 60_000);

  it('the extractor marks the resolved edge with the barrel path the step reads (project-relative)', () => {
    const byId = new Map(apg.nodes.map((n) => [n.id, n.filePath]));
    const mine = apg.edges.filter((e) => e.type === 'IMPORTS' && byId.get(e.sourceId) === POLICY && byId.get(e.targetId) === REPO);
    expect(mine.length).toBe(1);
    expect(mine[0]?.properties.viaReExport).toBe(true);
    expect(mine[0]?.properties.reExportBarrels).toEqual(['src/registrations/index.ts']);
  });
});
