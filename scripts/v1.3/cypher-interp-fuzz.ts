/**
 * Differential fuzz of the in-process Cypher interpreter against live Neo4j 5.26.24 + APOC
 * (Docs/v1.3/cypher-interp-fuzz.md). Entry file: no exports.
 *
 * Graph fuzz (default): for every seed in [--from, --from + --count), `fuzzProject(seed)` (lib/fuzz-apg.ts) is ingested
 * into Neo4j and into a fresh `MemoryGraphRepository` through the real `ingestAPG` (writes and verification counts
 * compared), then every catalogue template in every text the compiler can emit (exclude marker off/on × v1.2E text /
 * v1.3 rewrites) runs under the parity harness's three bindings (the generic one, `low`, `high`; lib/memory-bindings.ts),
 * followed by the judge's graph view and both universal-metric sets. Each statement gets a verdict (lib/fuzz-verdict.ts).
 * Every mismatch is counted; the first `--shrink-per` of each (template, verdict) signature are minimised: the graph is
 * reduced one step at a time (lib/fuzz-apg.ts `shrinkCandidates`) while the same statement keeps the same verdict.
 *
 * Rejection fuzz (`--reject <n>`): n queries built around constructs outside the supported subset must fail in the
 * interpreter with `CypherInterp.Unsupported` or a syntax error, never return rows; and n random mutations of the
 * template texts, run on a fuzz graph: whenever the interpreter accepts a mutant, Neo4j must accept it too and return
 * the same rows (a read transaction, so a mutant can never write).
 *
 * Usage (repository root, NEO4J_URI / NEO4J_PASSWORD in the environment; holds the cross-process Neo4j lock):
 *   node --import tsx scripts/v1.3/cypher-interp-fuzz.ts --from 1 --count 2000 [--reject 3000] [--shrink-per 2]
 *     [--only <template substring>] --out results/v1.3-cypher-interp/fuzz
 * Writes <out>/fuzz-summary.json, <out>/fuzz-mismatches.json (every mismatch, minimised repros) and <out>/fuzz.md.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import neo4j from 'neo4j-driver';
import { Neo4jRepository } from '../../src/neo4j-ingestion/neo4j-repository.js';
import { ingestAPG } from '../../src/neo4j-ingestion/index.js';
import { MemoryGraphRepository } from '../../src/cypher-interp/repository.js';
import { evalDiagnostics } from '../../src/cypher-interp/eval.js';
import { CYPHER_TEMPLATES } from '../../src/fitness-compiler/cypher-templates.js';
import { V13_EXTENSION_TEMPLATE_CATALOGUES } from '../../src/fitness-compiler/extension-templates.js';
import { UNIVERSAL_METRIC_QUERIES, UNIVERSAL_METRIC_QUERIES_LITERAL } from '../../src/scoring-engine/universal-metrics.js';
import { JUDGE_GRAPH_QUERIES } from '../../src/llm-critic/judge-graph.js';
import { apg2Params } from '../../src/fitness-compiler/apg2-in-memory.js';
import type { CypherTemplate } from '../../src/fitness-compiler/types.js';
import type { SnapshotStore } from '../../src/shared/interfaces/snapshot-store.js';
import type { GraphRepository, QueryResult } from '../../src/shared/interfaces/graph-repository.js';
import { DomainResult } from '../../src/shared/errors/domain-result.js';
import { acquireNeo4jLock } from '../../src/shared/process/neo4j-lock.js';
import { scrubSecrets } from '../../src/shared/errors/scrub.js';
import { classify, sweepTexts } from './lib/memory-sweep.js';
import { permissive, statementParams, sweepParams } from './lib/memory-bindings.js';
import { fuzzProject, mulberry32, shrinkCandidates, sizeOf } from './lib/fuzz-apg.js';
import type { FuzzProject } from './lib/fuzz-apg.js';
import { isMismatch, verdictOf } from './lib/fuzz-verdict.js';
import type { Verdict } from './lib/fuzz-verdict.js';
import { mutants, rejectionQueries } from './lib/fuzz-reject.js';

const argv = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const from = Number(opt('--from') ?? '1');
const count = Number(opt('--count') ?? '100');
const rejectN = Number(opt('--reject') ?? '0');
const shrinkPer = Number(opt('--shrink-per') ?? '2');
const only = opt('--only');
const trace = argv.includes('--trace');
const outDir = path.resolve(opt('--out') ?? 'results/v1.3-cypher-interp/fuzz');
const env = process.env;
const secrets = [env.NEO4J_PASSWORD ?? ''].filter((s) => s !== '');
const nullStore = {} as SnapshotStore;
const TIMEOUT_MS = 10_000;

if ((env.NEO4J_URI ?? '') === '' || (env.NEO4J_PASSWORD ?? '') === '') {
  process.stderr.write('cypher-interp-fuzz needs live Neo4j: set NEO4J_URI and NEO4J_PASSWORD\n');
  process.exit(2);
}

const ALL_TEMPLATES: [string, CypherTemplate][] = [
  ...[...CYPHER_TEMPLATES].map(([k, t]): [string, CypherTemplate] => [k, t]),
  ...[...V13_EXTENSION_TEMPLATE_CATALOGUES.values()].flatMap((m) => [...m].map(([k, t]): [string, CypherTemplate] => [k, t])),
];

/** One statement of the sweep: what to run, given the project (its parameters depend on the graph and layer model). */
interface Statement {
  readonly label: string;
  readonly binding: 'spec' | 'low' | 'high' | 'none';
  readonly text: string;
}

const STATEMENTS: Statement[] = [
  ...(['spec', 'low', 'high'] as const).flatMap((binding) => ALL_TEMPLATES.flatMap(([name, t]) => sweepTexts(t).map((s) => ({ label: `${name} [${s.variant}]`, binding, text: s.text })))),
  ...Object.entries(JUDGE_GRAPH_QUERIES).map(([k, q]) => ({ label: `judge-graph:${k}`, binding: 'none' as const, text: q })),
  ...Object.entries(UNIVERSAL_METRIC_QUERIES).map(([k, q]) => ({ label: `universal:${k}`, binding: 'none' as const, text: q })),
  ...Object.entries(UNIVERSAL_METRIC_QUERIES_LITERAL).map(([k, q]) => ({ label: `universal-literal:${k}`, binding: 'none' as const, text: q })),
].filter((s) => only === undefined || s.label.includes(only));

function paramsFor(p: FuzzProject, cand: MemoryGraphRepository): Record<'spec' | 'low' | 'high' | 'none', Record<string, unknown>> {
  const filePaths = cand.graph.nodesWithLabel('File').map((n) => String(n.properties.get('filePath') ?? ''));
  const spec = sweepParams(p.layerModel, new Map(), apg2Params(p.layerModel), filePaths);
  return { spec, low: permissive(spec, 'low'), high: permissive(spec, 'high'), none: {} };
}

/** Ingestion through the real `ingestAPG` on both engines; compares every write's counters and the verification reads. */
async function ingestBoth(neo: GraphRepository, p: FuzzProject): Promise<{ cand: MemoryGraphRepository; issues: string[] }> {
  const cand = new MemoryGraphRepository();
  const issues: string[] = [];
  const tee: GraphRepository = {
    executeQuery: async (cypher, params, options) => {
      const ref = await neo.executeQuery(cypher, params, options);
      const c = await cand.executeQuery(cypher, params, options);
      const write = /^\s*(UNWIND \$batch|MATCH \(n\) DETACH DELETE|CREATE INDEX|CALL db\.awaitIndexes)/.test(cypher);
      const k = write ? classify(ref, c, true, cypher) : verdictToClass(verdictOf(cypher, ref, c).verdict);
      if (k.klass !== 'equal') issues.push(`${cypher.trim().slice(0, 80)}: ${k.klass} ${k.detail ?? ''}`);
      return ref;
    },
    clearGraph: async () => {
      const r = await tee.executeQuery('MATCH (n) DETACH DELETE n');
      return r.success ? DomainResult.ok(undefined) : DomainResult.fail(r.errors);
    },
    healthCheck: () => Promise.resolve(true),
    close: () => Promise.resolve(),
  };
  const r = await ingestAPG({ apgResult: p.apg, layerModel: p.layerModel, mode: 'stateless' }, tee, nullStore);
  if (!r.success) issues.push(`ingestAPG failed: ${r.errors.map((e) => e.message).join('; ')}`);
  return { cand, issues };
}

function verdictToClass(v: Verdict): { klass: string; detail?: string } {
  return v === 'ok' || v.startsWith('quirk:') ? { klass: 'equal' } : { klass: v };
}

interface Mismatch {
  seed: number;
  label: string;
  binding: string;
  verdict: Verdict;
  detail?: string;
  text: string;
  minimised?: { size: string; steps: number; verdict: Verdict; detail?: string; project: unknown; params: unknown };
}

async function runStatement(neo: GraphRepository, cand: GraphRepository, s: Statement, params: Record<string, unknown>): Promise<{ verdict: Verdict; detail?: string; ref: DomainResult<QueryResult> }> {
  const p = statementParams(s.text, params);
  const t0 = performance.now();
  const ref = await neo.executeQuery(s.text, p, { timeoutMs: TIMEOUT_MS });
  const t1 = performance.now();
  if (trace) process.stderr.write(`  ${s.label} (${s.binding}) neo4j ${String(Math.round(t1 - t0))} ms...`);
  // Neo4j timed out: nothing to compare against, and the interpreter (no timeout) would enumerate the same paths.
  if (!ref.success && /TransactionTimedOut|timed out|terminated/i.test(`${ref.errors[0]?.code ?? ''} ${ref.errors[0]?.message ?? ''}`)) {
    if (trace) process.stderr.write(' timeout\n');
    return { verdict: 'timeout', ref };
  }
  evalDiagnostics.suppressed.clear();
  const c = await cand.executeQuery(s.text, p);
  if (trace) process.stderr.write(` interp ${String(Math.round(performance.now() - t1))} ms\n`);
  return { ...verdictOf(s.text, ref, c, evalDiagnostics.suppressed), ref };
}

/** Greedy minimisation: keep the first one-step reduction that reproduces the same verdict, until none does. */
async function shrink(neo: GraphRepository, p0: FuzzProject, s: Statement, verdict: Verdict): Promise<NonNullable<Mismatch['minimised']>> {
  let p = p0;
  let steps = 0;
  let last: { verdict: Verdict; detail?: string } = { verdict };
  const deadline = Date.now() + 180_000;
  for (let progress = true; progress && Date.now() < deadline;) {
    progress = false;
    for (const c of shrinkCandidates(p)) {
      if (Date.now() >= deadline) break;
      const { cand, issues } = await ingestBoth(neo, c);
      if (issues.some((i) => i.startsWith('ingestAPG failed'))) continue;
      const r = await runStatement(neo, cand, s, paramsFor(c, cand)[s.binding]);
      if (r.verdict === verdict) {
        p = c;
        last = r;
        steps += 1;
        progress = true;
        break;
      }
    }
  }
  const { cand } = await ingestBoth(neo, p);
  return { size: sizeOf(p), steps, verdict: last.verdict, ...(last.detail !== undefined ? { detail: last.detail } : {}), project: jsonable(p), params: jsonable(statementParams(s.text, paramsFor(p, cand)[s.binding])) };
}

/** JSON with INTEGERs kept apart from FLOATs (`{"$int": "…"}`) and -0.0 kept. */
function jsonable(v: unknown): unknown {
  if (typeof v === 'bigint') return { $int: v.toString() };
  if (typeof v === 'number' && Object.is(v, -0)) return { $float: '-0' };
  if (Array.isArray(v)) return v.map(jsonable);
  if (v !== null && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, jsonable(x)]));
  return v;
}

async function graphFuzz(neo: GraphRepository): Promise<{ summary: Record<string, unknown>; mismatches: Mismatch[] }> {
  const verdicts = new Map<string, number>();
  const byLabel = new Map<string, Map<string, number>>();
  const mismatches: Mismatch[] = [];
  const shrunk = new Map<string, number>();
  const ingestIssues: { seed: number; issue: string }[] = [];
  let statements = 0;
  let neoRows = 0;
  let nodes = 0;
  let edges = 0;
  const t0 = Date.now();
  for (let seed = from; seed < from + count; seed++) {
    const p = fuzzProject(seed);
    nodes += (p.apg.nodes as unknown[]).length;
    edges += (p.apg.edges as unknown[]).length;
    const ingested = await ingestBoth(neo, p);
    let cand = ingested.cand;
    const issues = ingested.issues;
    for (const issue of issues) ingestIssues.push({ seed, issue });
    if (issues.some((i) => i.startsWith('ingestAPG failed'))) continue;
    const params = paramsFor(p, cand);
    for (const s of STATEMENTS) {
      const r = await runStatement(neo, cand, s, params[s.binding]);
      statements += 1;
      if (r.ref.success) neoRows += r.ref.data.records.length;
      verdicts.set(r.verdict, (verdicts.get(r.verdict) ?? 0) + 1);
      const fam = s.label.replace(/ \[.*\]$/, '');
      let m = byLabel.get(fam);
      if (m === undefined) byLabel.set(fam, (m = new Map()));
      m.set(r.verdict, (m.get(r.verdict) ?? 0) + 1);
      if (!isMismatch(r.verdict)) continue;
      const mm: Mismatch = { seed, label: s.label, binding: s.binding, verdict: r.verdict, ...(r.detail !== undefined ? { detail: r.detail.slice(0, 1500) } : {}), text: s.text };
      const sig = `${fam}|${r.verdict}`;
      if ((shrunk.get(sig) ?? 0) < shrinkPer) {
        shrunk.set(sig, (shrunk.get(sig) ?? 0) + 1);
        process.stdout.write(`  seed ${String(seed)} ${s.label} (${s.binding}): ${r.verdict}; minimising...\n`);
        mm.minimised = await shrink(neo, p, s, r.verdict);
        process.stdout.write(`    -> ${mm.minimised.size} after ${String(mm.minimised.steps)} steps\n`);
        // The shrinker re-ingested: restore this seed's graph for the rest of its statements.
        cand = (await ingestBoth(neo, p)).cand;
      }
      mismatches.push(mm);
      fs.appendFileSync(path.join(outDir, 'fuzz-mismatches.jsonl'), JSON.stringify(mm) + '\n');
    }
    if ((seed - from + 1) % 25 === 0) {
      process.stdout.write(`seed ${String(seed)}: ${String(statements)} statements, ${[...verdicts].map(([k, n]) => `${k} ${String(n)}`).join(', ')} (${String(Math.round((Date.now() - t0) / 1000))} s)\n`);
    }
  }
  const families = [...byLabel].sort(([a], [b]) => a.localeCompare(b)).map(([family, m]) => ({ family, ...Object.fromEntries(m) }));
  return {
    summary: {
      seeds: { from, count }, graphs: count, nodes, edges, statements, statementsPerGraph: STATEMENTS.length, neo4jRows: neoRows,
      verdicts: Object.fromEntries(verdicts), seconds: Math.round((Date.now() - t0) / 1000), ingestIssues, families,
    },
    mismatches,
  };
}

/** Rejection fuzz: unsupported constructs must not return rows; accepted mutants must agree with Neo4j. */
async function rejectFuzz(neo: GraphRepository): Promise<Record<string, unknown>> {
  const rng = mulberry32(0x5eed + from);
  const out: Record<string, unknown> = {};
  // A fuzz graph with a bit of everything for the mutants to run on, small enough that no mutant's enumeration
  // (an unbounded variable-length pattern, a cartesian product) runs away in the interpreter, which has no timeout.
  let p = fuzzProject(from);
  for (let s = from; !(p.apg.edges.length >= 15 && p.apg.edges.length <= 35 && p.apg.nodes.length <= 30); s++) p = fuzzProject(s + 1);
  const { cand } = await ingestBoth(neo, p);
  const driver = neo4j.driver(env.NEO4J_URI ?? '', neo4j.auth.basic(env.NEO4J_USER ?? 'neo4j', env.NEO4J_PASSWORD ?? ''));
  const readOnly = async (text: string, params: Record<string, unknown>): Promise<DomainResult<QueryResult>> => {
    const session = driver.session({ defaultAccessMode: neo4j.session.READ });
    try {
      const recs = await session.executeRead((tx) => tx.run(text, params), { timeout: 5000 });
      return DomainResult.ok({ records: recs.records.map((r) => Object.fromEntries((r.keys as string[]).map((k) => [k, r.get(k)]))), summary: { counters: {} } });
    } catch (e) {
      const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : 'UNEXPECTED_ERROR';
      return DomainResult.fail([{ code, message: e instanceof Error ? e.message : String(e) }]);
    } finally {
      await session.close();
    }
  };
  try {
    // 1. Constructs outside the subset.
    const rej = rejectionQueries(rejectN, rng);
    const rejBad: unknown[] = [];
    const rejCodes = new Map<string, number>();
    let neoAccepted = 0;
    for (const q of rej) {
      const c = await cand.executeQuery(q.text, q.params);
      const code = c.success ? 'ROWS' : (c.errors[0]?.code ?? '');
      rejCodes.set(`${q.construct}: ${code}`, (rejCodes.get(`${q.construct}: ${code}`) ?? 0) + 1);
      if (c.success || !/^(CypherInterp\.Unsupported|Neo\.ClientError\.Statement\.SyntaxError)$/.test(code)) {
        rejBad.push({ construct: q.construct, text: q.text, interp: c.success ? `${String(c.data.records.length)} rows` : `${code}: ${c.errors[0]?.message ?? ''}` });
      }
      const n = await readOnly(q.text, q.params);
      if (n.success) neoAccepted += 1;
    }
    out.rejection = { queries: rej.length, notRejected: rejBad, neo4jAcceptedReadOnly: neoAccepted, byConstructAndCode: Object.fromEntries([...rejCodes].sort()) };
    // 2. Mutants of the template texts.
    const params = paramsFor(p, cand);
    const bases = STATEMENTS.filter((s) => s.binding !== 'low' && s.binding !== 'high');
    const tally = new Map<string, number>();
    const bad: unknown[] = [];
    for (let i = 0; i < rejectN; i++) {
      const s = bases[Math.floor(rng() * bases.length)] as Statement;
      const text = mutants(s.text, rng);
      const sp = statementParams(text, params[s.binding]);
      const c = await cand.executeQuery(text, sp);
      if (!c.success && c.errors[0]?.code === 'CypherInterp.Unsupported') { tally.set('interp unsupported', (tally.get('interp unsupported') ?? 0) + 1); continue; }
      const n = await readOnly(text, sp);
      const v = !n.success && !c.success ? (n.errors[0]?.code === c.errors[0]?.code ? 'both error, same code' : 'both error, different code')
        : verdictOf(text, n, c).verdict;
      const key = c.success && !n.success ? 'mismatch:interp rows, neo4j error' : v;
      tally.set(key, (tally.get(key) ?? 0) + 1);
      if (key.startsWith('mismatch:') || key === 'both error, different code') {
        if (bad.length < 300) bad.push({ base: s.label, verdict: key, text, neo4j: n.success ? `${String(n.data.records.length)} rows` : `${n.errors[0]?.code ?? ''}: ${(n.errors[0]?.message ?? '').slice(0, 200)}`, interp: c.success ? `${String(c.data.records.length)} rows` : `${c.errors[0]?.code ?? ''}: ${(c.errors[0]?.message ?? '').slice(0, 200)}` });
      }
    }
    out.mutation = { mutants: rejectN, graph: `seed ${String(p.seed)} (${sizeOf(p)})`, tally: Object.fromEntries([...tally].sort()), disagreements: bad };
  } finally {
    await driver.close();
  }
  return out;
}

async function main(): Promise<number> {
  evalDiagnostics.enabled = true;
  const neo = new Neo4jRepository({ neo4jUri: env.NEO4J_URI ?? '', neo4jUser: env.NEO4J_USER ?? 'neo4j', neo4jPassword: env.NEO4J_PASSWORD ?? '' });
  const lock = await acquireNeo4jLock(env.NEO4J_URI ?? '', { label: 'cypher-interp-fuzz', env, onWait: (t) => process.stderr.write(`${t}\n`) });
  fs.mkdirSync(outDir, { recursive: true });
  fs.rmSync(path.join(outDir, 'fuzz-mismatches.jsonl'), { force: true });
  try {
    const result: Record<string, unknown> = {};
    let failing = 0;
    if (count > 0) {
      const g = await graphFuzz(neo);
      result.graph = g.summary;
      fs.writeFileSync(path.join(outDir, 'fuzz-mismatches.json'), JSON.stringify(g.mismatches, null, 1) + '\n');
      failing += g.mismatches.length;
      process.stdout.write(`graphs ${String(count)}: ${JSON.stringify(g.summary.verdicts)}\n`);
    }
    if (rejectN > 0) {
      const r = await rejectFuzz(neo);
      result.reject = r;
      const rj = r.rejection as { notRejected: unknown[] };
      const mu = r.mutation as { tally: Record<string, number> };
      failing += rj.notRejected.length + Object.entries(mu.tally).filter(([k]) => k.startsWith('mismatch:')).reduce((s, [, n]) => s + n, 0);
      process.stdout.write(`rejection: not rejected ${String(rj.notRejected.length)}; mutants: ${JSON.stringify(mu.tally)}\n`);
    }
    fs.writeFileSync(path.join(outDir, 'fuzz-summary.json'), JSON.stringify(result, null, 1) + '\n');
    return failing === 0 ? 0 : 1;
  } finally {
    await neo.close();
    lock.release();
  }
}

void main().then(
  (c) => { process.exitCode = c; },
  (e: unknown) => {
    process.stderr.write(`${scrubSecrets(e instanceof Error ? e.stack ?? e.message : String(e), secrets)}\n`);
    process.exitCode = 2;
  },
);
