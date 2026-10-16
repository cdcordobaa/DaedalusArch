/**
 * Live check of the interpreter's unit-test expectations: every query text in tests/unit/cypher-interp/interpreter.test.ts
 * runs against Neo4j and the interpreter on the test's sample graph, through the parity tee (lib/memory-sweep.ts).
 * Entry file: no exports. Usage (Neo4j env loaded; holds the Neo4j lock; wipes the database):
 *   node --import tsx scripts/v1.3/cypher-interp-unit-live.ts
 * Expected: every query `equal`, except the unsupported `gds` call, the three `both-error` cases (same error code on
 * both sides) and the per-type count, whose row order follows Neo4j's node ids (trap T1).
 */
import * as fs from 'node:fs';
import neo4j from 'neo4j-driver';
import { Neo4jRepository } from '../../src/neo4j-ingestion/index.js';
import { MemoryGraphRepository } from '../../src/cypher-interp/repository.js';
import { ParityTee } from './lib/memory-sweep.js';
import { acquireNeo4jLock } from '../../src/shared/process/neo4j-lock.js';
async function main(): Promise<void> {
  const env = process.env;
  const neo = new Neo4jRepository({ neo4jUri: env.NEO4J_URI!, neo4jUser: env.NEO4J_USER ?? 'neo4j', neo4jPassword: env.NEO4J_PASSWORD! });
  const lock = await acquireNeo4jLock(env.NEO4J_URI!, { label: 'cypher-interp-unit-live', env });
  const src = fs.readFileSync('tests/unit/cypher-interp/interpreter.test.ts', 'utf8');
  const qs: string[] = [];
  /** The value of a JS string literal from the test file (no interpolation is used there). */
  const literal = (lit: string): string => lit.slice(1, -1).replace(/\\(.)/g, '$1');
  for (const m of src.matchAll(/(?:rows|failure)\((?:repo|g), (`[^`]*`|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g)) qs.push(literal(m[1]!));
  const tee = new ParityTee(neo, new MemoryGraphRepository());
  await tee.executeQuery('MATCH (n) DETACH DELETE n');
  const node = (t: string) => `UNWIND $batch AS node\n      CREATE (n:APGNode:${t})\n      SET n = node\n    `;
  const edge = (type: string) => `\n      UNWIND $batch AS edge\n      MATCH (src:APGNode {id: edge.sourceId})\n      MATCH (tgt:APGNode {id: edge.targetId})\n      CREATE (src)-[r:${type}]->(tgt)\n      SET r = edge.props\n    `;
  await tee.executeQuery(node('File'), { batch: [1, 2, 3, 4, 5].map((i) => ({ id: `f${i}`, type: 'File', name: `p${i}.ts`, filePath: `src/p${i}.ts`, layer: i <= 2 ? 'domain' : i === 5 ? null : 'infrastructure', isBarrel: false })) });
  await tee.executeQuery(node('Class'), { batch: [{ id: 'c1', type: 'Class', name: 'A', filePath: 'src/p1.ts' }, { id: 'c2', type: 'Class', name: 'B', filePath: 'src/p1.ts' }, { id: 'c3', type: 'Class', name: 'C', filePath: 'src/p2.ts' }] });
  await tee.executeQuery(edge('IMPORTS'), { batch: [[1, 2, 1], [1, 3, 2], [1, 4, 3], [2, 1, 4], [5, 1, 5]].map(([s, t, k]) => ({ sourceId: `f${s}`, targetId: `f${t}`, props: { id: `e${k}`, line: k } })) });
  await tee.executeQuery(edge('RE_EXPORTS'), { batch: [{ sourceId: 'f1', targetId: 'f5', props: { id: 'e6', line: 6 } }, { sourceId: 'f3', targetId: 'f1', props: { id: 'e7', line: 7 } }] });
  await tee.executeQuery(edge('EXTENDS'), { batch: [{ sourceId: 'c1', targetId: 'c2', props: { id: 'x1' } }, { sourceId: 'c2', targetId: 'c3', props: { id: 'x2' } }] });
  const params = { xs: [0.1, 0.7, 0.3333333333333333, 0.6666666666666666, 0.2, 0.9, 0.125, 0.55, 0.45, 0.123456789], x: 3, i: neo4j.int(3) };
  for (const q of qs) await tee.executeQuery(q, params);
  for (const e of tee.entries) if (e.klass !== 'equal') console.log(e.klass, JSON.stringify(e.cypher.slice(0, 120)), e.detail?.slice(0, 400));
  console.log('queries', qs.length, 'classes', JSON.stringify(tee.entries.reduce((a: Record<string, number>, e) => { a[e.klass] = (a[e.klass] ?? 0) + 1; return a; }, {})));
  await tee.executeQuery('MATCH (n) DETACH DELETE n');
  await neo.close();
  lock.release();
}

void main().catch((e: unknown) => { process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`); process.exitCode = 2; });
