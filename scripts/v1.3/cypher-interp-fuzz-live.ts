/**
 * Live check of the fuzz regression cases (tests/unit/cypher-interp/fuzz-regressions.cases.ts): each case's graph is
 * written to Neo4j through the ingestion statements and its query run there and in the interpreter; every expectation
 * must be Neo4j's answer and the interpreter's. Entry file: no exports. Wipes the database; holds the Neo4j lock.
 * Usage (Neo4j env loaded): node --import tsx scripts/v1.3/cypher-interp-fuzz-live.ts
 */
import { Neo4jRepository } from '../../src/neo4j-ingestion/neo4j-repository.js';
import { MemoryGraphRepository } from '../../src/cypher-interp/repository.js';
import type { GraphRepository, QueryResult } from '../../src/shared/interfaces/graph-repository.js';
import type { DomainResult } from '../../src/shared/errors/domain-result.js';
import { acquireNeo4jLock } from '../../src/shared/process/neo4j-lock.js';
import { canon } from './lib/memory-sweep.js';
import { REGRESSION_CASES } from '../../tests/unit/cypher-interp/fuzz-regressions.cases.js';
import type { RegressionCase } from '../../tests/unit/cypher-interp/fuzz-regressions.cases.js';

async function load(repo: GraphRepository, c: RegressionCase): Promise<void> {
  await repo.executeQuery('MATCH (n) DETACH DELETE n');
  for (const label of [...new Set(c.nodes.map((n) => n.label))]) {
    const batch = c.nodes.filter((n) => n.label === label).map((n) => ({ ...n.props, id: n.id }));
    const r = await repo.executeQuery(`UNWIND $batch AS node\n      CREATE (n:APGNode:${label})\n      SET n = node\n    `, { batch });
    if (!r.success) throw new Error(`load ${c.title}: ${r.errors[0]?.message ?? ''}`);
  }
  for (const type of [...new Set(c.edges.map((e) => e.type))]) {
    const batch = c.edges.filter((e) => e.type === type).map((e) => ({ sourceId: e.from, targetId: e.to, props: { ...e.props } }));
    const r = await repo.executeQuery(`\n      UNWIND $batch AS edge\n      MATCH (src:APGNode {id: edge.sourceId})\n      MATCH (tgt:APGNode {id: edge.targetId})\n      CREATE (src)-[r:${type}]->(tgt)\n      SET r = edge.props\n    `, { batch });
    if (!r.success) throw new Error(`load ${c.title}: ${r.errors[0]?.message ?? ''}`);
  }
}

function outcome(r: DomainResult<QueryResult>): string {
  return r.success ? JSON.stringify(r.data.records.map(canon)) : JSON.stringify({ error: r.errors[0]?.code ?? '' });
}

async function main(): Promise<number> {
  const env = process.env;
  const neo = new Neo4jRepository({ neo4jUri: env.NEO4J_URI ?? '', neo4jUser: env.NEO4J_USER ?? 'neo4j', neo4jPassword: env.NEO4J_PASSWORD ?? '' });
  const lock = await acquireNeo4jLock(env.NEO4J_URI ?? '', { label: 'cypher-interp-fuzz-live', env });
  let bad = 0;
  try {
    for (const c of REGRESSION_CASES) {
      const mem = new MemoryGraphRepository();
      await load(neo, c);
      await load(mem, c);
      const n = outcome(await neo.executeQuery(c.query, { ...c.params }));
      const m = outcome(await mem.executeQuery(c.query, { ...c.params }));
      const want = JSON.stringify('error' in c.expect ? c.expect : c.expect.map(canon));
      const ok = n === want && m === want;
      if (!ok) bad += 1;
      process.stdout.write(`${ok ? 'ok  ' : 'FAIL'} ${c.finding}: ${c.title}${ok ? '' : `\n     expect ${want}\n     neo4j  ${n}\n     interp ${m}`}\n`);
    }
    await neo.executeQuery('MATCH (n) DETACH DELETE n');
  } finally {
    await neo.close();
    lock.release();
  }
  process.stdout.write(`${String(REGRESSION_CASES.length)} cases, ${String(bad)} failing\n`);
  return bad === 0 ? 0 : 1;
}

void main().then((c) => { process.exitCode = c; }, (e: unknown) => { process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`); process.exitCode = 2; });
