/**
 * Live Neo4j run of the team-declared-rules study (`Docs/DiagnosticRuns/v1.3-declared-rules-2026-10-16.md`). The study
 * itself ran without Neo4j (none in its environment): DaedalusArch's two enabled rules were evaluated in memory
 * (`evaluateGraphRules`, the predicate of the compiled FF-S01 / FF-S03 Cypher, on the literal edge view). This script
 * runs the same cases through the real pipeline and checks that the live rows equal the in-memory ones.
 *
 * For each case: parse the translated spec (`<out>/spec.yaml`), extract the APG with the v1.3 defaults and the case's
 * tsconfig, ingest it with the spec's layer model, compile with `V13_SEALED_COMPILE_OPTIONS` (edge views on: both templates
 * read the literal view), run `evaluateSymbolic`, and compare the FF-S01/FF-S03 (source, target) pairs with the
 * in-memory evaluation on the same extraction. Writes `<out>/live.json`; exit code 1 when any case differs.
 *
 * Neo4j: NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD; the cross-process Neo4j lock is held for the run.
 * Usage (repository root): npx tsx scripts/v1.3/declared-rules-live.ts <case.json>...
 * (case.json as written by declared-rules-case.sh; the worktree it names must still exist, i.e. KEEP=1.)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { extractAPG, V13_DEFAULT_OPTIONS } from '../../src/apg-extractor/index.js';
import { compileFunctions, V13_SEALED_COMPILE_OPTIONS } from '../../src/fitness-compiler/index.js';
import { compilerInputFromSpec } from '../../src/fitness-compiler/compiler-input.js';
import { globToRegex } from '../../src/fitness-compiler/glob-to-regex.js';
import { evaluateSymbolic } from '../../src/evaluation-engine/index.js';
import { ingestAPG, Neo4jRepository } from '../../src/neo4j-ingestion/index.js';
import { parseSpec } from '../../src/spec-parser/index.js';
import { acquireNeo4jLock } from '../../src/shared/process/neo4j-lock.js';
import { scrubSecrets } from '../../src/shared/errors/scrub.js';
import type { SnapshotStore } from '../../src/shared/interfaces/snapshot-store.js';
import type { APGResult } from '../../src/shared/types/apg.js';
import { assignLayers } from './lib/layer-assignment.js';
import { projectApg, splitKey } from './lib/graph-fidelity.js';
import type { ApgLike } from './lib/graph-fidelity.js';
import { evaluateGraphRules } from './declared-to-aac.js';
import type { CaseInput } from './declared-rules-run.js';

const nullStore = {} as SnapshotStore; // stateless ingestion never touches the store

async function liveCase(repo: Neo4jRepository, c: CaseInput): Promise<{ id: string; live: number; memory: number; onlyLive: string[]; onlyMemory: string[] }> {
  const parsed = await parseSpec({ specFilePath: join(c.out, 'spec.yaml') });
  if (!parsed.success) throw new Error(`${c.id}: spec: ${parsed.errors.map((e) => e.message).join('; ')}`);
  const spec = parsed.data;
  const ext = await extractAPG(c.root, { ...V13_DEFAULT_OPTIONS }, c.tsconfig);
  if (!ext.success) throw new Error(`${c.id}: extract: ${ext.errors.map((e) => e.message).join('; ')}`);
  const apg: APGResult = ext.data;
  const ing = await ingestAPG({ apgResult: apg, layerModel: spec.layerModel, mode: 'stateless' }, repo, nullStore);
  if (!ing.success) throw new Error(`${c.id}: ingest: ${ing.errors.map((e) => e.message).join('; ')}`);
  const compiled = compileFunctions(compilerInputFromSpec(spec), V13_SEALED_COMPILE_OPTIONS);
  if (!compiled.success) throw new Error(`${c.id}: compile: ${compiled.errors.map((e) => e.message).join('; ')}`);
  const r = await evaluateSymbolic({ queries: compiled.data.symbolicQueries, graphRepository: repo, knownSecrets: [], apg });
  if (!r.success) throw new Error(`${c.id}: evaluate: ${r.errors.map((e) => e.message).join('; ')}`);
  const rel = (p: string): string => (p.startsWith('/') ? relative(c.root, p) : p);
  const live = new Set(r.data.results
    .filter((x) => ['FF-S01', 'FF-S03'].includes(String(x.functionId)))
    .flatMap((x) => x.violations.map((v) => `${rel(v.filePath)}\t${rel(v.target ?? '')}`)));

  // In-memory mirror on the same extraction.
  const flag = (e: ApgLike['edges'][number]): boolean => e.type === 'IMPORTS' && (e.properties as Record<string, unknown>).viaReExport === true;
  const g = apg as unknown as ApgLike;
  const lit = projectApg({ nodes: g.nodes, edges: g.edges.filter((e) => !flag(e)) });
  const layer = new Map(assignLayers([...lit.files], spec.layerModel).assignments.map((a) => [a.file, a.layer]));
  const allowed = new Set((spec.layerModel.allowedDependencies ?? []).map((e) => `${e.from}>${e.to}`));
  const ff = spec.fitnessFunctions.find((f) => String(f.id) === 'FF-S01');
  const excludes = (ff?.excludePaths ?? []).map((p) => globToRegex(p));
  const mem = new Set(evaluateGraphRules([...lit.edges.keys()].map((k) => { const [source, target] = splitKey(k); return { source, target }; }),
    (f) => layer.get(f) ?? null, allowed, excludes).map((v) => `${v.source}\t${v.target}`));
  const onlyLive = [...live].filter((k) => !mem.has(k)).sort();
  const onlyMemory = [...mem].filter((k) => !live.has(k)).sort();
  const out = { id: c.id, live: live.size, memory: mem.size, onlyLive, onlyMemory };
  writeFileSync(join(c.out, 'live.json'), JSON.stringify(out, null, 1) + '\n');
  return out;
}

async function main(argv: readonly string[]): Promise<number> {
  const uri = process.env.NEO4J_URI ?? '';
  const password = process.env.NEO4J_PASSWORD ?? '';
  if (uri === '' || password === '' || argv.length === 0) {
    process.stderr.write('usage: NEO4J_URI=... NEO4J_PASSWORD=... declared-rules-live.ts <case.json>...\n');
    return 2;
  }
  const lock = await acquireNeo4jLock(uri, { label: 'declared-rules-live', onWait: (t) => process.stderr.write(`${t}\n`) });
  const repo = new Neo4jRepository({ neo4jUri: uri, neo4jUser: process.env.NEO4J_USER ?? 'neo4j', neo4jPassword: password });
  let differ = 0;
  try {
    for (const p of argv) {
      const c = JSON.parse(readFileSync(p, 'utf8')) as CaseInput;
      const res = await liveCase(repo, { ...c, out: resolve(c.out) });
      if (res.onlyLive.length + res.onlyMemory.length > 0) differ++;
      process.stdout.write(`${res.id}: live ${String(res.live)}, in-memory ${String(res.memory)}, only-live ${String(res.onlyLive.length)}, only-memory ${String(res.onlyMemory.length)}\n`);
    }
  } finally {
    await repo.close();
    lock.release();
  }
  return differ > 0 ? 1 : 0;
}

void main(process.argv.slice(2)).then(
  (code) => { process.exitCode = code; },
  (e: unknown) => {
    process.stderr.write(`${scrubSecrets(e instanceof Error ? e.message : String(e), [process.env.NEO4J_PASSWORD ?? ''].filter((s) => s !== ''))}\n`);
    process.exitCode = 2;
  },
);
