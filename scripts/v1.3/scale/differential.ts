/**
 * Differential check of the in-memory cycle answers against Neo4j on a real project (Docs/v1.3/scale.md §4).
 * Entry file: no exports.
 *
 * Extracts the APG, ingests it through the accelerated repository (so the mirror is built from the same writes), then
 * runs every recognised cycle query text twice: in memory, and on Neo4j with a long timeout (default 30 min instead of
 * the pipeline's 30 s). The two row lists must be identical (Neo4j Integers compared as numbers). The excluding forms
 * of FF-S02 run with `--excludes` globs (default: barrels and modules, which sit on many cycles).
 *
 * Usage (repository root; Neo4j env exported):
 *   NEO4J_PASSWORD=... node --import tsx scripts/v1.3/scale/differential.ts --project <dir> [--tsconfig <file>] \
 *     [--label <id>] [--timeout-ms 1800000] [--excludes '**\/index.ts,**\/*.module.ts'] [--out <file.json>]
 * Exit code 0 when every query agrees (a query Neo4j could not finish is reported, not counted as agreement).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { extractAPG } from '../../../src/apg-extractor/index.js';
import { Neo4jRepository } from '../../../src/neo4j-ingestion/neo4j-repository.js';
import { ensureIndexes, ingestEdges, ingestNodes } from '../../../src/neo4j-ingestion/graph-ingester.js';
import { AcceleratedGraphRepository } from '../../../src/graph-accelerator/accelerated-repository.js';
import { acceleratedTexts, answer } from '../../../src/graph-accelerator/cycle-queries.js';
import { globToRegex } from '../../../src/fitness-compiler/glob-to-regex.js';
import { isNeo4jNumber } from '../../../src/evaluation-engine/violation-id.js';

function arg(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

function plain(value: unknown): unknown {
  if (isNeo4jNumber(value)) return value.toNumber();
  if (Array.isArray(value)) return value.map(plain);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  }
  return value;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const project = arg(argv, '--project');
  const password = process.env['NEO4J_PASSWORD'];
  if (project === undefined || password === undefined || password === '') {
    process.stderr.write('usage: NEO4J_PASSWORD=... differential.ts --project <dir> [--tsconfig <file>] [--timeout-ms n] [--excludes globs] [--out file]\n');
    return 2;
  }
  const label = arg(argv, '--label') ?? path.basename(project);
  const timeoutMs = Number(arg(argv, '--timeout-ms') ?? 1_800_000);
  const excludeGlobs = (arg(argv, '--excludes') ?? '**/index.ts,**/*.module.ts').split(',').filter((g) => g.length > 0);
  const extracted = await extractAPG(project, {}, arg(argv, '--tsconfig'));
  if (!extracted.success) throw new Error(extracted.errors.map((e) => e.message).join('; '));
  const apg = extracted.data;

  const neo4j = new Neo4jRepository({
    neo4jUri: process.env['NEO4J_URI'] ?? 'bolt://localhost:7687',
    neo4jUser: process.env['NEO4J_USER'] ?? 'neo4j',
    neo4jPassword: password,
    lock: true,
  });
  const repo = new AcceleratedGraphRepository(neo4j);
  const results: Record<string, unknown>[] = [];
  let disagreements = 0;
  try {
    const steps = [
      await repo.clearGraph(),
      await ensureIndexes(repo),
      await ingestNodes(apg.nodes, new Map(), repo),
      await ingestEdges(apg.edges, repo),
    ];
    for (const s of steps) if (!s.success) throw new Error(s.errors.map((e) => e.message).join('; '));
    if (repo.mirror.state !== 'valid') throw new Error(`mirror is ${repo.mirror.state} after ingestion`);

    for (const [text, q] of acceleratedTexts()) {
      const params = q.excludes ? { excludePatterns: excludeGlobs.map((g) => globToRegex(g)) } : {};
      const t0 = performance.now();
      const memory = answer(repo.mirror, q, params);
      const memoryMs = Math.round(performance.now() - t0);
      const t1 = performance.now();
      const live = await neo4j.executeQuery(text, params, { timeoutMs });
      const neo4jMs = Math.round(performance.now() - t1);
      const memoryRows = memory === undefined ? undefined : JSON.stringify(plain(memory));
      const neo4jRows = live.success ? JSON.stringify(plain(live.data.records)) : undefined;
      const verdict = memoryRows === undefined ? 'memory-declined' : neo4jRows === undefined ? `neo4j-failed: ${live.success ? '' : live.errors[0]?.code ?? ''}` : memoryRows === neo4jRows ? 'identical' : 'DIFFERENT';
      if (verdict === 'DIFFERENT') disagreements += 1;
      const rows = memory?.length ?? 0;
      results.push({ query: q.name, filter: q.filter, excludes: q.excludes, rows, memoryMs, neo4jMs, verdict });
      process.stderr.write(`${label} ${q.name} ${q.filter}${q.excludes ? ' +excludes' : ''}: ${verdict} (rows ${String(rows)}, memory ${String(memoryMs)} ms, neo4j ${String(neo4jMs)} ms)\n`);
      if (verdict === 'DIFFERENT') {
        fs.writeFileSync(`${arg(argv, '--out') ?? label}.memory.json`, `${memoryRows ?? ''}\n`);
        fs.writeFileSync(`${arg(argv, '--out') ?? label}.neo4j.json`, `${neo4jRows ?? ''}\n`);
      }
    }
  } finally {
    await repo.close();
  }
  const out = arg(argv, '--out');
  if (out !== undefined) {
    fs.writeFileSync(out, `${JSON.stringify({ label, files: apg.parseCoverage.total, nodes: apg.nodes.length, edges: apg.edges.length, timeoutMs, excludeGlobs, results }, null, 2)}\n`);
  }
  return disagreements === 0 ? 0 : 1;
}

main().then(
  (code) => { process.exitCode = code; },
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
    process.exitCode = 1;
  },
);
