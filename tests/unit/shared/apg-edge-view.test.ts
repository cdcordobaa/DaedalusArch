/**
 * v1.3 fix round, fix 5 (Docs/v1.3/edge-views.md, addendum 2026-10-15): the IMPORTS readers outside the templates read
 * the literal edge view. Each reader drops the resolved `viaReExport` IMPORTS edge and keeps everything else, so on a
 * v1.2E graph (no edge carries the mark) its output is unchanged.
 */
import { isResolvedReExportEdge, literalEdgeView } from '../../../src/shared/apg-edge-view.js';
import {
  computeUniversalMetrics, UNIVERSAL_METRIC_QUERIES, UNIVERSAL_METRIC_QUERIES_LITERAL,
} from '../../../src/scoring-engine/universal-metrics.js';
import type { UniversalMetric } from '../../../src/scoring-engine/universal-metrics.js';
import { detectCouplingDrift } from '../../../src/neo4j-ingestion/drift-detector.js';
import { DEFAULT_DRIFT_THRESHOLDS } from '../../../src/neo4j-ingestion/types.js';
import { buildGraphData } from '../../../src/report/graph-data-builder.js';
import { JUDGE_GRAPH_QUERIES } from '../../../src/llm-critic/judge-graph.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { GraphRepository } from '../../../src/shared/interfaces/graph-repository.js';
import type { APGEdge, APGNode, APGResult } from '../../../src/shared/types/apg.js';
import type { ParsedSpec } from '../../../src/shared/types/spec.js';

const file = (id: string, layer = 'presentation'): APGNode => ({ id, type: 'File', filePath: id, name: id, decorators: [], properties: { layer } });
let n = 0;
const edge = (type: APGEdge['type'], s: string, t: string, properties: Record<string, unknown> = {}): APGEdge => ({ id: `e${String(n++)}`, type, sourceId: s, targetId: t, properties });

// ctrl.ts imports { Order } from './model' (a barrel re-exporting model/Order.ts).
const NODES = [file('ctrl.ts'), file('model/index.ts', 'domain'), file('model/Order.ts', 'domain')];
const LITERAL = edge('IMPORTS', 'ctrl.ts', 'model/index.ts', { reExportHop: true });
const RESOLVED = edge('IMPORTS', 'ctrl.ts', 'model/Order.ts', { viaReExport: true, reExportBarrels: ['model/index.ts'] });
const REEXPORT = edge('RE_EXPORTS', 'model/index.ts', 'model/Order.ts');
const V13_EDGES = [LITERAL, RESOLVED, REEXPORT];
const V12E_EDGES = [edge('IMPORTS', 'ctrl.ts', 'model/Order.ts'), REEXPORT];

describe('literalEdgeView', () => {
  it('drops exactly the resolved re-export IMPORTS edges', () => {
    expect(literalEdgeView(V13_EDGES)).toEqual([LITERAL, REEXPORT]);
    expect(isResolvedReExportEdge(RESOLVED)).toBe(true);
    expect(isResolvedReExportEdge(edge('RE_EXPORTS', 'a', 'b', { viaReExport: true }))).toBe(false);
  });
  it('is the identity on a v1.2E graph', () => {
    expect(literalEdgeView(V12E_EDGES)).toEqual(V12E_EDGES);
  });
});

describe('universal metrics (scoring engine)', () => {
  const METRICS = Object.keys(UNIVERSAL_METRIC_QUERIES) as UniversalMetric[];
  const repo = (seen: string[]): GraphRepository => ({
    executeQuery: (cypher: string) => {
      seen.push(cypher);
      return Promise.resolve(DomainResult.ok({ records: [{ cnt: 0, val: 0 }], summary: { counters: {} } }));
    },
    clearGraph: () => Promise.resolve(DomainResult.ok(undefined)),
    healthCheck: () => Promise.resolve(true),
    close: () => Promise.resolve(),
  });

  it('the literal set filters every IMPORTS pattern and leaves the frozen set as it was', () => {
    for (const m of METRICS) {
      const q = UNIVERSAL_METRIC_QUERIES_LITERAL[m];
      if (m === 'abstractionRatio') expect(q).toBe(UNIVERSAL_METRIC_QUERIES[m]);
      else expect([m, q]).toEqual([m, expect.stringContaining('NOT coalesce(')]);
      expect(UNIVERSAL_METRIC_QUERIES[m]).not.toContain('viaReExport');
    }
  });

  it('view literal (the v1.3 scoring mode) runs the literal queries; the default runs the frozen ones', async () => {
    const lit: string[] = [];
    await computeUniversalMetrics(repo(lit), 'cypher', undefined, undefined, 'literal');
    expect([...lit].sort()).toEqual(METRICS.map((m) => UNIVERSAL_METRIC_QUERIES_LITERAL[m]).sort());
    const frozen: string[] = [];
    await computeUniversalMetrics(repo(frozen), 'cypher');
    expect([...frozen].sort()).toEqual(METRICS.map((m) => UNIVERSAL_METRIC_QUERIES[m]).sort());
  });

  it('the SCC path drops the resolved edges in the literal view', async () => {
    // b.ts -> a.ts directly; a.ts reaches b.ts only through a resolved edge: a cycle in the resolved graph only.
    const nodes = [file('a.ts'), file('b.ts')];
    const edges = [edge('IMPORTS', 'a.ts', 'b.ts', { viaReExport: true }), edge('IMPORTS', 'b.ts', 'a.ts')];
    const r1 = await computeUniversalMetrics(repo([]), 'scc', { nodes, edges }, undefined, 'literal');
    const r2 = await computeUniversalMetrics(repo([]), 'scc', { nodes, edges });
    expect(r1.success && r1.data.metrics.cyclicDependencyCount).toBe(0);
    expect(r2.success && r2.data.metrics.cyclicDependencyCount).toBe(2);
  });
});

describe('drift detector, report graph and judge context', () => {
  it('coupling drift counts the literal edges only', () => {
    const d = detectCouplingDrift(V13_EDGES, V12E_EDGES, NODES, NODES, DEFAULT_DRIFT_THRESHOLDS);
    // one literal IMPORTS edge now (to the barrel), one before (to Order.ts): no fan-out change
    expect(d.perLayer.find((l) => l.layer === 'presentation')?.deltaPercent).toBe(0);
    expect(d.topContributors).toEqual([]);
  });

  it('the report graph draws the literal IMPORTS edges', () => {
    const apg = { nodes: NODES, edges: V13_EDGES } as unknown as APGResult;
    const spec = { layerModel: { layers: [] } } as unknown as ParsedSpec;
    const g = buildGraphData(apg, spec, []);
    expect(g.edges.map((e) => `${String(e.data.source)}>${String(e.data.target)}`)).toEqual(['ctrl.ts>model/index.ts']);
  });

  it("the judge's graph view reads the literal edges", () => {
    expect(JUDGE_GRAPH_QUERIES.edges).toContain(' WHERE NOT coalesce(r.viaReExport, false) WITH type(r)');
  });
});
