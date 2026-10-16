/**
 * Regression tests for the interpreter bugs found by the differential fuzz against Neo4j 5.26.24
 * (Docs/v1.3/cypher-interp-fuzz.md §5). The cases and their expected answers live in `fuzz-regressions.cases.ts`;
 * `scripts/v1.3/cypher-interp-fuzz-live.ts` checks every expectation against live Neo4j.
 */
import neo4j from 'neo4j-driver';
import { MemoryGraphRepository } from '../../../src/cypher-interp/repository.js';
import { REGRESSION_CASES } from './fuzz-regressions.cases.js';
import type { RegressionCase } from './fuzz-regressions.cases.js';

/** The parity harness's canonical form: INTEGER and FLOAT kept apart, maps key-sorted. */
function canon(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (neo4j.isInt(v)) return { $int: (v as { toString(): string }).toString() };
  if (typeof v === 'number') return { $float: String(v) };
  if (Array.isArray(v)) return v.map(canon);
  if (typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon((v as Record<string, unknown>)[k])]));
  return v;
}

/** Builds the case's graph through the ingestion statements, as `ingestAPG` sends them. */
async function caseGraph(c: RegressionCase): Promise<MemoryGraphRepository> {
  const repo = new MemoryGraphRepository();
  for (const label of [...new Set(c.nodes.map((n) => n.label))]) {
    const batch = c.nodes.filter((n) => n.label === label).map((n) => ({ ...n.props, id: n.id }));
    const r = await repo.executeQuery(`UNWIND $batch AS node\n      CREATE (n:APGNode:${label})\n      SET n = node\n    `, { batch });
    expect(r.success).toBe(true);
  }
  for (const type of [...new Set(c.edges.map((e) => e.type))]) {
    const batch = c.edges.filter((e) => e.type === type).map((e) => ({ sourceId: e.from, targetId: e.to, props: { ...e.props } }));
    const r = await repo.executeQuery(`
      UNWIND $batch AS edge
      MATCH (src:APGNode {id: edge.sourceId})
      MATCH (tgt:APGNode {id: edge.targetId})
      CREATE (src)-[r:${type}]->(tgt)
      SET r = edge.props
    `, { batch });
    expect(r.success).toBe(true);
  }
  return repo;
}

describe('cypher-interp: fuzz regressions', () => {
  for (const c of REGRESSION_CASES) {
    it(`${c.finding}: ${c.title}`, async () => {
      const repo = await caseGraph(c);
      const t0 = performance.now();
      const r = await repo.executeQuery(c.query, c.params ?? {});
      const ms = performance.now() - t0;
      if ('error' in c.expect) {
        expect(r.success ? 'rows' : r.errors[0]?.code).toBe(c.expect.error);
      } else {
        if (!r.success) throw new Error(r.errors.map((e) => `${e.code}: ${e.message}`).join('; '));
        expect(r.data.records.map(canon)).toEqual(c.expect);
      }
      if (c.withinMs !== undefined) expect(ms).toBeLessThan(c.withinMs);
    });
  }
});
