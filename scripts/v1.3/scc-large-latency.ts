/**
 * B1 (Docs/DiagnosticRuns/v1.3-jury-fixes-2026-10-16.md): FF-S02 on a large project through both cycle paths, from
 * ONE extracted APG: the compiled Cypher template on the in-process interpreter (`cypher-interp`, the path the
 * reference results use) and the prepared SCC path (`src/evaluation-engine/scc-cycles.ts`). Latency of each, and how
 * their rows agree. No template, tier or default is changed (`CYCLE_STRATEGY` stays `cypher`; the SCC path is called
 * directly). No Neo4j, no LLM. Entry file: no exports.
 *
 * Usage (repository root):
 *   node --max-old-space-size=8192 --import tsx scripts/v1.3/scc-large-latency.ts --id <id> --root <analysis root>
 *     --spec <spec.yaml> [--tsconfig <file>] [--runs 3] [--out <file.json>]
 * The interpreter has no query timeout, so wrap the run in `timeout <s>` for a budget: the SCC half and the graph are
 * written to --out before the Cypher half starts (`cypher.status: "running"`), so a killed run keeps them.
 *
 * Agreement is reported at three grains, because the two paths have different row contracts (BR-U3-45): Cypher emits
 * one row per simple cycle of length <= 10 (closed path, capped at CYCLE_ROW_CAP rows); SCC emits one row per strongly
 * connected component of size >= 2. (1) Exact row multiset on (functionId, filePath, target, discriminator); (2) the
 * set of files on any cycle; (3) per SCC: does at least one Cypher cycle lie inside it.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { extractAPG } from '../../src/apg-extractor/index.js';
import { ingestAPG } from '../../src/neo4j-ingestion/index.js';
import { MemoryGraphRepository } from '../../src/cypher-interp/repository.js';
import { parseSpec, readSpecExcludePaths } from '../../src/spec-parser/index.js';
import { compilerInputFromSpec } from '../../src/fitness-compiler/compiler-input.js';
import { compileFunctions, V13_COMPILE_OPTIONS } from '../../src/fitness-compiler/fitness-compiler.js';
import { evaluateSymbolic } from '../../src/evaluation-engine/symbolic-evaluator.js';
import { buildFileGraph, findSccViolations, stronglyConnectedComponents, SCC_TEMPLATE_NAME } from '../../src/evaluation-engine/scc-cycles.js';
import type { SnapshotStore } from '../../src/shared/interfaces/snapshot-store.js';
import type { Violation } from '../../src/shared/taxonomy/violation-types.js';

const argv = process.argv.slice(2);
const opt = (n: string): string | undefined => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const need = (n: string): string => { const v = opt(n); if (v === undefined) throw new Error(`--${n} is required`); return v; };
const id = need('id');
const root = path.resolve(need('root'));
const specPath = path.resolve(need('spec'));
const tsconfig = opt('tsconfig');
const runs = Number(opt('runs') ?? '3');
const out = opt('out');
const nullStore = {} as SnapshotStore; // stateless ingestion never touches the store

const median = (xs: readonly number[]): number => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] ?? Number.NaN; };
const ms = (x: number): number => Math.round(x * 10) / 10;
const rel = (p: string): string => p.split(',').map((x) => { const t = x.trim(); return t.startsWith(root + '/') ? t.slice(root.length + 1) : t; }).join(',');
const rowKey = (v: Violation): string => JSON.stringify([String(v.functionId), rel(v.filePath), rel(v.target ?? ''), v.discriminator ?? []]);

/** The files of a Cypher cycle row: its comma-joined path (closed), or the filePath alone. */
function cycleFiles(v: Violation): string[] {
  const ev = (v.evidence ?? []).find((e) => e.startsWith('cycle='));
  if (ev !== undefined) { try { return (JSON.parse(ev.slice('cycle='.length)) as string[]).map(rel); } catch { /* fall through */ } }
  return rel(v.filePath).split(',').filter((x) => x !== '');
}

async function main(): Promise<void> {
  const parsed = await parseSpec({ specFilePath: specPath });
  if (!parsed.success) throw new Error(`spec: ${parsed.errors.map((e) => e.message).join('; ')}`);
  const spec = parsed.data;
  const compiled = compileFunctions(compilerInputFromSpec(spec), { ...V13_COMPILE_OPTIONS });
  if (!compiled.success) throw new Error(`compile: ${compiled.errors.map((e) => e.message).join('; ')}`);
  const query = compiled.data.symbolicQueries.find((q) => q.name === SCC_TEMPLATE_NAME && q.source === 'template');
  if (query === undefined) throw new Error('the spec compiles no FF-S02 (no-cyclic-deps) template');

  const tExtract = performance.now();
  const ex = await extractAPG(root, { excludePatterns: readSpecExcludePaths(specPath) }, tsconfig === undefined ? undefined : path.resolve(tsconfig));
  if (!ex.success) throw new Error(`extract: ${ex.errors.map((e) => e.message).join('; ')}`);
  const apg = ex.data;
  const extractMs = performance.now() - tExtract;

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-large-'));
  const repo = new MemoryGraphRepository();
  const tIngest = performance.now();
  const ing = await ingestAPG({ apgResult: apg, layerModel: spec.layerModel, mode: 'stateless', apgStorePath: path.join(work, '.apg-store') }, repo, nullStore);
  if (!ing.success) throw new Error(`ingest: ${ing.errors.map((e) => e.message).join('; ')}`);
  const ingestMs = performance.now() - tIngest;

  const excludePatterns = Array.isArray(query.params.excludePatterns) ? query.params.excludePatterns.map(String) : [];
  // The SCC path as prepared reads every IMPORTS|RE_EXPORTS edge (both v1.3 edge views). FF-S02 reads the literal
  // view (edge-views.ts: IMPORTS without viaReExport, plus RE_EXPORTS), so the SCC is also run on that view.
  const literalApg = { nodes: apg.nodes, edges: apg.edges.filter((e) => !(e.type === 'IMPORTS' && e.properties.viaReExport === true)) };
  const sccRun = (g: Pick<typeof apg, 'nodes' | 'edges'>) => {
    const times: number[] = [];
    let rows: readonly Violation[] = [];
    for (let i = 0; i < runs; i++) {
      const t0 = performance.now();
      rows = findSccViolations(g, { functionId: String(query.functionId), dimension: query.dimension, severity: query.severity, excludePatterns });
      times.push(performance.now() - t0);
    }
    const fg = buildFileGraph(g, { excludePatterns });
    const comps = stronglyConnectedComponents(fg).filter((c) => c.length >= 2 || (fg.get(c[0] ?? '') ?? []).includes(c[0] ?? ''));
    return { times, rows, graph: fg, comps };
  };
  const union = sccRun(apg);
  const literal = sccRun(literalApg);
  const { times: sccTimes, rows: sccRows, graph, comps: sccs } = literal;
  const unionSummary = { rows: union.rows.length, sizes: union.comps.map((c) => c.length).sort((a, b) => b - a), fileEdges: [...union.graph.values()].reduce((s2, a) => s2 + a.length, 0), latencyMedianMs: ms(median(union.times)) };
  const log = (t: string): void => { process.stderr.write(`${id}: ${t}\n`); };
  log(`extract ${String(ms(extractMs))} ms, ingest ${String(ms(ingestMs))} ms, ${String(graph.size)} files; SCC median ${String(ms(median(sccTimes)))} ms, ${String(sccRows.length)} rows`);
  const partial = { id, root: path.basename(root), spec: need('spec'), runs,
    graph: { files: graph.size, apgNodes: apg.nodes.length, apgEdges: apg.edges.length },
    latencyMs: { extract: ms(extractMs), ingest: ms(ingestMs), scc: { median: ms(median(sccTimes)), all: sccTimes.map(ms) } },
    cypher: { status: 'running', startedAt: new Date().toISOString() },
    scc: { view: 'literal', rows: sccRows.length, components: sccs.length, sizes: sccs.map((c) => c.length).sort((a, b) => b - a) }, sccUnionGraph: unionSummary };
  if (out !== undefined) { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(partial, null, 1) + '\n'); }
  const cypherTimes: number[] = [];
  let cypherRows: readonly Violation[] = [];
  let truncated = false;
  let cypherFailure: string | undefined;
  for (let i = 0; i < runs; i++) {
    log(`cypher run ${String(i + 1)}/${String(runs)}`);
    const t0 = performance.now();
    const r = await evaluateSymbolic({ queries: [query], graphRepository: repo });
    cypherTimes.push(performance.now() - t0);
    if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
    const res = r.data.results[0];
    if (res === undefined) { cypherFailure = r.data.failures.map((f) => `${f.code}: ${f.message}`).join('; '); break; }
    cypherRows = res.violations;
    truncated = res.truncated === true;
    if ((cypherTimes[0] ?? 0) > 60_000) break; // one timing is enough when a run takes minutes
  }

  fs.rmSync(work, { recursive: true, force: true });

  // (1) exact rows
  const count = (rows: readonly Violation[]): Map<string, number> => { const m = new Map<string, number>(); for (const v of rows) m.set(rowKey(v), (m.get(rowKey(v)) ?? 0) + 1); return m; };
  const cm = count(cypherRows); const sm = count(sccRows);
  let shared = 0; for (const [k, n] of cm) shared += Math.min(n, sm.get(k) ?? 0);
  // (2) files on a cycle
  const cypherFiles = new Set(cypherRows.flatMap(cycleFiles));
  const sccFiles = new Set(sccs.flat().map(rel));
  const both = [...cypherFiles].filter((f) => sccFiles.has(f)).length;
  // (3) SCCs with a Cypher cycle inside
  const memberOf = new Map<string, number>(); sccs.forEach((c, i) => { for (const f of c) memberOf.set(rel(f), i); });
  const hit = new Set<number>();
  let cyclesOutsideOneScc = 0;
  for (const v of cypherRows) {
    const comps = new Set(cycleFiles(v).map((f) => memberOf.get(f)));
    if (comps.size === 1 && !comps.has(undefined)) hit.add([...comps][0] as number); else cyclesOutsideOneScc++;
  }

  const result = {
    id, root: path.basename(root), spec: need('spec'), runs,
    graph: { files: graph.size, fileEdges: [...graph.values()].reduce((s, a) => s + a.length, 0), apgNodes: apg.nodes.length, apgEdges: apg.edges.length },
    latencyMs: {
      extract: ms(extractMs), ingest: ms(ingestMs),
      cypherInterp: { median: ms(median(cypherTimes)), all: cypherTimes.map(ms) },
      scc: { median: ms(median(sccTimes)), all: sccTimes.map(ms) },
    },
    cypher: { status: 'finished', rows: cypherRows.length, truncated, ...(cypherFailure !== undefined ? { failure: cypherFailure } : {}) },
    scc: { view: 'literal', rows: sccRows.length, components: sccs.length, sizes: sccs.map((c) => c.length).sort((a, b) => b - a) },
    sccUnionGraph: unionSummary,
    agreement: {
      exactRowMultiset: { cypherRows: cypherRows.length, sccRows: sccRows.length, shared, identical: shared === cypherRows.length && shared === sccRows.length },
      filesOnACycle: { cypher: cypherFiles.size, scc: sccFiles.size, both, cypherOnly: cypherFiles.size - both, sccOnly: sccFiles.size - both },
      sccsWithACypherCycle: hit.size, sccsWithoutACypherCycle: sccs.length - hit.size, cypherCyclesNotInsideOneScc: cyclesOutsideOneScc,
    },
  };
  const text = JSON.stringify(result, null, 1) + '\n';
  if (out !== undefined) { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, text); }
  process.stdout.write(text);
}

main().catch((e: unknown) => { process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`); process.exit(1); });
