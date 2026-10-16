/**
 * Scale (Docs/v1.3/scale.md §4): the in-memory answers to the bounded cycle queries against Neo4j itself. Each graph is
 * ingested once through the accelerated repository (so Neo4j and the mirror receive the same writes), then every
 * recognised query text runs in memory and on Neo4j; the rows must be identical, in order, with Neo4j Integers read as
 * numbers. Graphs: 60 seeded random graphs (parallel edges, self-loops, re-export flags, missing lines, a Package, a
 * shared node id) and the five golden fixtures. Same skip and host guards as the other golden suites (golden-env.ts);
 * every ingestion wipes the database.
 */
import { Neo4jRepository } from '../../src/neo4j-ingestion/neo4j-repository.js';
import { ensureIndexes, ingestEdges, ingestNodes } from '../../src/neo4j-ingestion/graph-ingester.js';
import { AcceleratedGraphRepository } from '../../src/graph-accelerator/accelerated-repository.js';
import { acceleratedTexts, answer } from '../../src/graph-accelerator/cycle-queries.js';
import { extractAPG } from '../../src/apg-extractor/index.js';
import { globToRegex } from '../../src/fitness-compiler/glob-to-regex.js';
import { isNeo4jNumber } from '../../src/evaluation-engine/violation-id.js';
import type { APGEdge, APGNode } from '../../src/shared/types/apg.js';
import { apgEdge, apgNode, randomGraph } from '../unit/graph-accelerator/helpers.js';
import { GOLDEN_CASES } from './golden-cases.js';
import { resolveGoldenEnv } from './golden-env.js';

const goldenEnv = resolveGoldenEnv();
if (!goldenEnv.enabled) console.warn(`[scale-accelerator] ${goldenEnv.reason}`);
const describeScale = goldenEnv.enabled ? describe : describe.skip;

const EXCLUDES = [globToRegex('**/a*.ts'), globToRegex('src/q?.ts'), globToRegex('**/index.ts', { segmentGlobstar: true })];

function plain(value: unknown): unknown {
  if (isNeo4jNumber(value)) return value.toNumber();
  if (Array.isArray(value)) return value.map(plain);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  return value;
}

async function compare(nodes: readonly APGNode[], edges: readonly APGEdge[]): Promise<{ answered: number; rows: number }> {
  if (!goldenEnv.enabled) throw new Error(goldenEnv.reason);
  const neo4j = new Neo4jRepository({ neo4jUri: goldenEnv.neo4j.uri, neo4jUser: goldenEnv.neo4j.user, neo4jPassword: goldenEnv.neo4j.password });
  const repo = new AcceleratedGraphRepository(neo4j);
  let answered = 0;
  let rows = 0;
  try {
    for (const step of [await repo.clearGraph(), await ensureIndexes(repo), await ingestNodes(nodes, new Map(), repo), await ingestEdges(edges, repo)]) {
      expect(step.success).toBe(true);
    }
    expect(repo.mirror.state).toBe('valid');
    for (const [text, q] of acceleratedTexts()) {
      const params = q.excludes ? { excludePatterns: EXCLUDES } : {};
      const memory = answer(repo.mirror, q, params);
      const live = await neo4j.executeQuery(text, params);
      expect(live.success).toBe(true);
      if (!live.success || memory === undefined) continue;
      answered += 1;
      rows += memory.length;
      expect([q, plain(memory)]).toEqual([q, plain(live.data.records)]);
    }
  } finally {
    await repo.close();
  }
  return { answered, rows };
}

describeScale('scale: in-memory cycle answers equal Neo4j (Docs/v1.3/scale.md §4)', () => {
  it('60 seeded random graphs: every recognised query, identical rows', async () => {
    let answered = 0;
    let rows = 0;
    for (let seed = 1; seed <= 60; seed += 1) {
      const { nodes, edges } = randomGraph(seed);
      // A shared id on two Method nodes, as overloaded methods produce.
      const extra = [apgNode({ id: 'm', type: 'Method', filePath: 'src/m.ts' }), apgNode({ id: 'm', type: 'Method', filePath: 'src/m.ts' })];
      const r = await compare([...nodes.map(apgNode), ...extra], edges.map(apgEdge));
      answered += r.answered;
      rows += r.rows;
    }
    expect(answered).toBe(60 * 6);
    expect(rows).toBeGreaterThan(100);
  }, 600_000);

  it.each(GOLDEN_CASES.map((c) => [c.id, c.projectPath] as const))('%s: every recognised query, identical rows', async (_id, projectPath) => {
    const extracted = await extractAPG(projectPath);
    expect(extracted.success).toBe(true);
    if (!extracted.success) return;
    const r = await compare(extracted.data.nodes, extracted.data.edges);
    expect(r.answered).toBe(6);
  }, 120_000);
});
