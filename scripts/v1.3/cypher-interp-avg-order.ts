/**
 * Trap T2 evidence for the `float-drift` bound (Docs/v1.3/cypher-interpreter.md §4-5). Entry file: no exports.
 *
 * For one reference variant's APG v2 graph: ingests it into Neo4j `--ingestions` times and into the interpreter once,
 * reads `averageInstability` and the same values through `collect()` in each engine's row order, and folds every one
 * of `--orders` random permutations of those values through Neo4j's incremental mean (`m += (x - m) / n`, trap T3).
 * Shows that the engines differ only by accumulation order: each engine's `avg` equals the fold of its own row order,
 * and Neo4j's answers across ingestions are values of that fold over some order.
 *
 * Usage (repository root, Neo4j env loaded; holds the Neo4j lock):
 *   node --import tsx scripts/v1.3/cypher-interp-avg-order.ts [--project hexagonal/v11-domain-model-cycle] [--orders 300000]
 *     [--ingestions 3] [--out results/v1.3-cypher-interp/parity/avg-order-spread.json]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Neo4jRepository } from '../../src/neo4j-ingestion/neo4j-repository.js';
import { ingestAPG } from '../../src/neo4j-ingestion/index.js';
import { MemoryGraphRepository } from '../../src/cypher-interp/repository.js';
import { extractAPG, V13_APG2_OPTIONS, componentsFromLayerModel } from '../../src/apg-extractor/index.js';
import { parseSpec, readSpecExcludePaths } from '../../src/spec-parser/index.js';
import { UNIVERSAL_METRIC_QUERIES } from '../../src/scoring-engine/universal-metrics.js';
import type { GraphRepository } from '../../src/shared/interfaces/graph-repository.js';
import type { SnapshotStore } from '../../src/shared/interfaces/snapshot-store.js';
import { acquireNeo4jLock } from '../../src/shared/process/neo4j-lock.js';
import { scrubSecrets } from '../../src/shared/errors/scrub.js';
import { makeTempRoot } from './lib/materialise.js';
import { referenceProjects } from './lib/memory-projects.js';
import { ulpDistance } from './lib/memory-sweep.js';

const argv = process.argv.slice(2);
const opt = (name: string, d: string): string => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] ?? d : d;
};
const projectId = opt('--project', 'hexagonal/v11-domain-model-cycle');
const orders = Number(opt('--orders', '300000'));
const ingestions = Number(opt('--ingestions', '3'));
const out = path.resolve(opt('--out', 'results/v1.3-cypher-interp/parity/avg-order-spread.json'));
const env = process.env;
const secrets = [env.NEO4J_PASSWORD ?? ''].filter((s) => s !== '');

const AVG = UNIVERSAL_METRIC_QUERIES.averageInstability;
const AVG_TAIL = 'RETURN avg(toFloat(fo) / (fo + fi)) AS val';
// Diagnostic text only (never a template): the same pipeline, the averaged values collected in the same row order.
const COLLECT = AVG.replace(AVG_TAIL, 'RETURN collect(toFloat(fo) / (fo + fi)) AS xs, avg(toFloat(fo) / (fo + fi)) AS val');

function fold(xs: readonly number[]): number {
  let m = 0;
  xs.forEach((x, i) => { m += (x - m) / (i + 1); });
  return m;
}

/** Deterministic PRNG (mulberry32), so the spread is reproducible. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function read(repo: GraphRepository): Promise<{ avg: number; xs: number[]; foldOwnOrder: number }> {
  const a = await repo.executeQuery(AVG);
  const c = await repo.executeQuery(COLLECT);
  if (!a.success || !c.success) throw new Error('query failed');
  const xs = c.data.records[0]?.xs as number[];
  return { avg: a.data.records[0]?.val as number, xs, foldOwnOrder: fold(xs) };
}

async function main(): Promise<void> {
  if (AVG === COLLECT) throw new Error('averageInstability text changed: update the diagnostic');
  const proj = referenceProjects(process.cwd(), (id) => id === projectId)[0];
  if (proj === undefined) throw new Error(`no reference variant ${projectId}`);
  const work = makeTempRoot('avg-order-');
  const lock = await acquireNeo4jLock(env.NEO4J_URI ?? '', { label: 'cypher-interp-avg-order', env });
  const neo = new Neo4jRepository({ neo4jUri: env.NEO4J_URI ?? '', neo4jUser: env.NEO4J_USER ?? 'neo4j', neo4jPassword: env.NEO4J_PASSWORD ?? '' });
  try {
    const dir = proj.materialise(work);
    const spec = await parseSpec({ specFilePath: proj.specPath });
    if (!spec.success) throw new Error('spec');
    const v2 = await extractAPG(dir, { ...V13_APG2_OPTIONS, excludePatterns: readSpecExcludePaths(proj.specPath), components: componentsFromLayerModel(spec.data.layerModel) });
    if (!v2.success) throw new Error('extract');
    const input = { apgResult: v2.data, layerModel: spec.data.layerModel, mode: 'stateless' as const };
    const mem = new MemoryGraphRepository();
    await ingestAPG(input, mem, {} as SnapshotStore);
    const interp = await read(mem);
    const neo4jRuns: { ingestion: number; avg: number; foldOwnOrder: number; ulpsFromInterp: number }[] = [];
    for (let i = 1; i <= ingestions; i++) {
      await ingestAPG(input, neo, {} as SnapshotStore);
      const r = await read(neo);
      neo4jRuns.push({ ingestion: i, avg: r.avg, foldOwnOrder: r.foldOwnOrder, ulpsFromInterp: Math.sign(r.avg - interp.avg) * ulpDistance(r.avg, interp.avg) });
    }
    const next = rng(20261016);
    const spread = new Map<number, number>();
    for (let t = 0; t < orders; t++) {
      const p = [...interp.xs];
      for (let i = p.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [p[i], p[j]] = [p[j] as number, p[i] as number];
      }
      const v = fold(p);
      spread.set(v, (spread.get(v) ?? 0) + 1);
    }
    const values = [...spread].sort((a, b) => a[0] - b[0]).map(([v, n]) => ({ value: String(v), ulpsFromInterp: Math.sign(v - interp.avg) * ulpDistance(v, interp.avg), orders: n }));
    const result = {
      project: projectId, graph: 'APG v2', query: 'universal:averageInstability', n: interp.xs.length, randomOrders: orders, seed: 20261016,
      interp: { avg: String(interp.avg), equalsFoldOfOwnOrder: interp.avg === interp.foldOwnOrder },
      neo4j: neo4jRuns.map((r) => ({ ...r, avg: String(r.avg), foldOwnOrder: String(r.foldOwnOrder), equalsFoldOfOwnOrder: r.avg === r.foldOwnOrder, reachableByReordering: spread.has(r.avg) })),
      spreadUlps: { min: Math.min(...values.map((v) => v.ulpsFromInterp)), max: Math.max(...values.map((v) => v.ulpsFromInterp)), distinctValues: values.length },
      values,
    };
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(result, null, 1) + '\n');
    process.stdout.write(`${JSON.stringify({ ...result, values: undefined })}\n`);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
    await neo.close();
    lock.release();
  }
}

void main().catch((e: unknown) => {
  process.stderr.write(`${scrubSecrets(e instanceof Error ? e.stack ?? e.message : String(e), secrets)}\n`);
  process.exitCode = 2;
});
