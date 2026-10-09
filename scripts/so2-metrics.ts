/**
 * SO2 metrics (ADR-021 SO2; audit SO2-1..5, X-2, X-4; ADR-016 e; NFR-07; BR-U5b-49; plan Steps 22-25).
 *
 * Writes the SO2 tables by script, from harness output directories and the extractor, never by hand:
 * - `tables --run-dir <dir> [--run-dir <dir> ...] --out <dir>`: `latency.csv` (one row per RunRecord, rejected and
 *   not-run included, with the H13 gate of each run), `nfr07_latency.csv` (the NFR-07 latency table),
 *   `graph_coverage.csv` (graph size by node and edge type, FLOWS_TO edges per resolved import) and `gate.json`
 *   (the plan-level gate decision per plan id, ADR-016 e).
 * - `ablation --run-dir <dir> --out <dir>`: `apg_ablation.csv` and `apg_ablation_summary.csv` from an `apg-ablation`
 *   plan run (full arm `projectId`, AST-only arm `projectId@ast-only`).
 * - `arms --plan <plan.json> --out <dir>`: `apg_arms.csv`, the pre-run check that each base's full and `ast-only` arms
 *   differ (extraction only, no database; ADR-021 item 8). Exit 1 (`SO2_ARMS_IDENTICAL`) when any base's
 *   pair is identical (that base would contribute no ablation contrast).
 * - `flows-to --plan <plan.json> --out <dir>`: `flows_to_stores.csv`, the extractor's FLOWS_TO store accounting for
 *   every `full` entry of a plan (extraction only, no database, no evaluation).
 * - `profile --project <path> --spec <spec> --project-id <id> --out <dir> [--reps 3] [--timeout-ms 120000]`: ingests
 *   the project into the lane database (credentials from the environment), then PROFILEs the FF-S02 template and
 *   the universal cycle metric through a direct driver session, one warm-up and `--reps` repetitions
 *   (`profile.csv`), and writes the SCC component sizes (`scc_components.csv`). It refuses an `--out` that already holds
 *   either file (one directory per base).
 * - `--self-test`: a known-bad input (a run directory that does not exist) and exit 1 (BR-U5b-73).
 *
 * The aggregate's `latency.csv` reads accepted reports only; this script's `latency.csv` is the SO2 output named
 * in the lane note (ADR-021 SO2; the analysis plan names it after P-U6).
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import neo4j from 'neo4j-driver';
import { extractAPG } from '../src/apg-extractor/index.js';
import { compileFunctions, compilerInputFromSpec } from '../src/fitness-compiler/index.js';
import { FileSystemSnapshotStore } from '../src/neo4j-ingestion/fs-snapshot-store.js';
import { ingestAPG } from '../src/neo4j-ingestion/index.js';
import { Neo4jRepository } from '../src/neo4j-ingestion/neo4j-repository.js';
import { UNIVERSAL_METRIC_QUERIES } from '../src/scoring-engine/universal-metrics.js';
import { parseSpec, readSpecExcludePaths } from '../src/spec-parser/index.js';
import type { GraphMode } from '../src/apg-extractor/types.js';
import { CYCLE_ROW_CAP, MAX_CYCLE_LENGTH } from '../src/fitness-compiler/cypher-templates.js';
import { buildFileGraph, stronglyConnectedComponents } from '../src/evaluation-engine/scc-cycles.js';
import type { APGResult } from '../src/shared/types/apg.js';
import { csvText, f6 } from './aggregate.js';
import type { ExperimentPlan } from './run-experiment.js';
import {
  ABLATION_COLUMNS, ABLATION_SUMMARY_COLUMNS, ablationCsvRows, ablationRows, ablationSummaryRows, ARMS_COLUMNS, armsRow, AST_ONLY_SUFFIX, FLOWS_TO_STORE_COLUMNS,
  flowsToStoreRow, GRAPH_COVERAGE_COLUMNS, graphCoverageRows, LATENCY_COLUMNS, latencyGateOf, latencyRows, NFR07_COLUMNS,
  nfr07Rows, planGate, PROFILE_COLUMNS, profileRows, SCC_COLUMNS, sccRows,
} from './lib/so2.js';
import type { GateResult, ProfileMeasurement, So2Run } from './lib/so2.js';
import { FF_S02_TEMPLATE, TIMEOUT_MARKER, totalDbHits } from './lib/so2.js';
import { knownSecretsOf, loadRunDir as loadRunDirOf, scrubbedJson } from './lib/report-io.js';

export const SO2_INPUT_INVALID = 'SO2_INPUT_INVALID';
export const SO2_ARMS_IDENTICAL = 'SO2_ARMS_IDENTICAL';

export const SO2_USAGE = [
  'Usage: npx tsx scripts/so2-metrics-cli.ts tables --run-dir <dir> [--run-dir <dir> ...] --out <dir>',
  '       npx tsx scripts/so2-metrics-cli.ts ablation --run-dir <dir> --out <dir>',
  '       npx tsx scripts/so2-metrics-cli.ts arms --plan <plan.json> --out <dir>',
  '       npx tsx scripts/so2-metrics-cli.ts flows-to --plan <plan.json> --out <dir>',
  '       npx tsx scripts/so2-metrics-cli.ts profile --project <path> --spec <spec> --project-id <id> --out <dir> [--reps <n>] [--timeout-ms <ms>]',
  '       npx tsx scripts/so2-metrics-cli.ts --self-test',
].join('\n');

export interface So2MainIo {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
  readonly writeFile: (path: string, text: string) => void;
}

/** The database side of `profile` (a lane Neo4j through the environment's credentials). */
export interface ProfileBackend {
  /** Clears the lane graph and ingests `apg` with the spec's layer model. */
  readonly ingest: (apg: APGResult, specPath: string) => Promise<void>;
  /** The compiled FF-S02 query of the spec (`no-cyclic-deps`). */
  readonly cycleTemplate: (specPath: string) => Promise<{ readonly cypher: string; readonly params: Readonly<Record<string, unknown>> }>;
  /** One `PROFILE <cypher>` through a direct driver session. */
  readonly profile: (cypher: string, params: Readonly<Record<string, unknown>>, timeoutMs: number) => Promise<ProfileMeasurement>;
  readonly close: () => Promise<void>;
}

export interface So2Deps {
  /**
   * Extracts `projectPath` in `graphMode` with `excludePatterns` beyond the extractor defaults: the evaluating spec's
   * `default_exclude_paths` (`specExcludesOf`), so the measured graph is the one the run evaluated (audit SO2-3, X-4).
   */
  readonly extract: (projectPath: string, graphMode: GraphMode, excludePatterns: readonly string[]) => Promise<APGResult>;
  /** Built only by `profile` (lazily: no other subcommand touches a database). */
  readonly profileBackend?: () => Promise<ProfileBackend>;
}

export const defaultSo2Deps: So2Deps = {
  extract: async (projectPath, graphMode, excludePatterns) => {
    const r = await extractAPG(projectPath, { graphMode, excludePatterns: [...excludePatterns] });
    if (!r.success) throw new Error(`${SO2_INPUT_INVALID}: extraction of ${projectPath} failed: ${r.errors.map((e) => e.message).join('; ')}`);
    return r.data;
  },
};

/**
 * The extraction excludes of the spec at `specPath` (repo-relative or absolute): its `default_exclude_paths`, read
 * by the same C3 rule the pipeline passes to `ExtractCommand` (`readSpecExcludePaths`). An unreadable or unparsable
 * spec is `SO2_INPUT_INVALID`: a measurement without the run's excludes would describe a different graph.
 */
export function specExcludesOf(repoRoot: string, specPath: string): string[] {
  try {
    return readSpecExcludePaths(resolve(repoRoot, specPath));
  } catch (e) {
    throw new Error(`${SO2_INPUT_INVALID}: spec ${specPath}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Runs of one harness output directory (records with their stored reports). */
export function loadSo2Runs(dir: string): So2Run[] {
  const { records, reports } = loadRunDirOf(dir, SO2_INPUT_INVALID);
  return records.map((record) => ({ record, report: reports.get(record.runId) }));
}

/** `gate.json`: the gate decision per plan id over its runs (ADR-016 e, applied mechanically). */
export function gateSummary(runs: readonly So2Run[]): Record<string, { readonly result: GateResult; readonly runs: readonly { readonly runId: string; readonly result: GateResult; readonly cause: string }[] }> {
  const byPlan = new Map<string, So2Run[]>();
  for (const r of runs) byPlan.set(r.record.planId, [...(byPlan.get(r.record.planId) ?? []), r]);
  const out: Record<string, { result: GateResult; runs: { runId: string; result: GateResult; cause: string }[] }> = {};
  for (const [planId, rs] of [...byPlan].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
    const outcomes = rs.map((r) => ({ runId: r.record.runId, ...latencyGateOf(r.record, r.report) }));
    out[planId] = { result: planGate(outcomes), runs: outcomes.map((o) => ({ runId: o.runId, result: o.result, cause: o.cause })) };
  }
  return out;
}

interface ParsedArgs { readonly sub: string; readonly opts: Map<string, string[]> }

function parseArgs(argv: readonly string[]): ParsedArgs | undefined {
  const [sub, ...rest] = argv;
  if (sub === undefined || sub.startsWith('--')) return undefined;
  const opts = new Map<string, string[]>();
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i] ?? '';
    const v = rest[i + 1];
    if (!a.startsWith('--') || v === undefined) return undefined;
    opts.set(a.slice(2), [...(opts.get(a.slice(2)) ?? []), v]);
    i++;
  }
  return { sub, opts };
}

const one = (opts: Map<string, string[]>, key: string): string | undefined => opts.get(key)?.[0];

export async function main(argv: readonly string[], repoRoot: string, io: So2MainIo, deps: So2Deps = defaultSo2Deps): Promise<number> {
  if (argv[0] === '--self-test') {
    // Known-bad input: a run directory that does not exist.
    const code = await main(['tables', '--run-dir', join(repoRoot, 'does-not-exist'), '--out', join(repoRoot, 'does-not-exist-out')], repoRoot, io, deps);
    io.err(`self-test: exit ${String(code)}\n`);
    return 1;
  }
  const parsed = parseArgs(argv);
  const out = parsed === undefined ? undefined : one(parsed.opts, 'out');
  if (parsed === undefined || out === undefined) {
    io.err(`${SO2_USAGE}\n`);
    return 2;
  }
  const outDir = resolve(repoRoot, out);
  try {
    switch (parsed.sub) {
      case 'tables': {
        const dirs = parsed.opts.get('run-dir') ?? [];
        if (dirs.length === 0) throw new Error(`${SO2_INPUT_INVALID}: tables needs at least one --run-dir`);
        const runs = dirs.flatMap((d) => loadSo2Runs(resolve(repoRoot, d)));
        io.writeFile(join(outDir, 'latency.csv'), csvText(LATENCY_COLUMNS, latencyRows(runs)));
        io.writeFile(join(outDir, 'nfr07_latency.csv'), csvText(NFR07_COLUMNS, nfr07Rows(runs)));
        io.writeFile(join(outDir, 'graph_coverage.csv'), csvText(GRAPH_COVERAGE_COLUMNS, graphCoverageRows(runs, f6)));
        const gate = gateSummary(runs);
        io.writeFile(join(outDir, 'gate.json'), `${JSON.stringify(gate, null, 2)}\n`);
        io.out(`${String(runs.length)} runs: latency.csv, nfr07_latency.csv, graph_coverage.csv, gate.json in ${outDir}\n`);
        for (const [planId, g] of Object.entries(gate)) io.out(`gate ${planId}: ${g.result}\n`);
        return 0;
      }
      case 'ablation': {
        const dir = one(parsed.opts, 'run-dir');
        if (dir === undefined) throw new Error(`${SO2_INPUT_INVALID}: ablation needs --run-dir`);
        const rows = ablationRows(loadSo2Runs(resolve(repoRoot, dir)));
        io.writeFile(join(outDir, 'apg_ablation.csv'), csvText(ABLATION_COLUMNS, ablationCsvRows(rows)));
        io.writeFile(join(outDir, 'apg_ablation_summary.csv'), csvText(ABLATION_SUMMARY_COLUMNS, ablationSummaryRows(rows)));
        io.out(`${String(rows.length)} function rows: apg_ablation.csv, apg_ablation_summary.csv in ${outDir}\n`);
        return 0;
      }
      case 'arms': {
        const planFile = one(parsed.opts, 'plan');
        if (planFile === undefined) throw new Error(`${SO2_INPUT_INVALID}: arms needs --plan`);
        const plan = JSON.parse(readFileSync(resolve(repoRoot, planFile), 'utf8')) as ExperimentPlan;
        const rows: string[][] = [];
        for (const a of plan.projects.filter((x) => x.graphMode === 'ast-only')) {
          const baseId = a.projectId.endsWith(AST_ONLY_SUFFIX) ? a.projectId.slice(0, -AST_ONLY_SUFFIX.length) : a.projectId;
          const f = plan.projects.find((x) => x.projectId === baseId && (x.graphMode ?? 'full') === 'full');
          if (f?.path !== a.path) throw new Error(`${SO2_INPUT_INVALID}: ${a.projectId} has no full arm ${baseId} on the same path`);
          const excludes = specExcludesOf(repoRoot, f.specPath);
          rows.push(armsRow(baseId, await deps.extract(resolve(repoRoot, f.path), 'full', excludes), await deps.extract(resolve(repoRoot, a.path), 'ast-only', specExcludesOf(repoRoot, a.specPath))));
        }
        io.writeFile(join(outDir, 'apg_arms.csv'), csvText(ARMS_COLUMNS, rows));
        const identical = rows.filter((r) => r[r.length - 1] !== 'true').map((r) => r[0] ?? '');
        io.out(`${String(rows.length)} pairs, ${String(rows.length - identical.length)} differ: apg_arms.csv in ${outDir}\n`);
        if (identical.length > 0) {
          io.err(`${SO2_ARMS_IDENTICAL}: identical arms for ${identical.join(', ')}; the ablation cannot show a loss there\n`);
          return 1;
        }
        return 0;
      }
      case 'flows-to': {
        const planFile = one(parsed.opts, 'plan');
        if (planFile === undefined) throw new Error(`${SO2_INPUT_INVALID}: flows-to needs --plan`);
        const plan = JSON.parse(readFileSync(resolve(repoRoot, planFile), 'utf8')) as ExperimentPlan;
        const rows: string[][] = [];
        for (const p of plan.projects.filter((x) => (x.graphMode ?? 'full') === 'full')) {
          const apg = await deps.extract(resolve(repoRoot, p.path), 'full', specExcludesOf(repoRoot, p.specPath));
          if (apg.flowsTo === undefined) throw new Error(`${SO2_INPUT_INVALID}: the extractor returned no FLOWS_TO accounting for ${p.projectId}`);
          rows.push(flowsToStoreRow(p.projectId, apg.flowsTo, apg.importResolution.resolvedInternal, f6));
        }
        io.writeFile(join(outDir, 'flows_to_stores.csv'), csvText(FLOWS_TO_STORE_COLUMNS, rows));
        io.out(`${String(rows.length)} projects: flows_to_stores.csv in ${outDir}\n`);
        return 0;
      }
      case 'profile':
        return await profile(parsed.opts, repoRoot, outDir, io, deps);
      default:
        io.err(`${SO2_USAGE}\n`);
        return 2;
    }
  } catch (e) {
    io.err(`${scrubbedJson(e instanceof Error ? e.message : String(e), knownSecretsOf(process.env))}\n`);
    return 1;
  }
}

async function profile(opts: Map<string, string[]>, repoRoot: string, outDir: string, io: So2MainIo, deps: So2Deps): Promise<number> {
  const project = one(opts, 'project');
  const spec = one(opts, 'spec');
  const projectId = one(opts, 'project-id');
  if (project === undefined || spec === undefined || projectId === undefined) {
    throw new Error(`${SO2_INPUT_INVALID}: profile needs --project, --spec and --project-id`);
  }
  const reps = Number(one(opts, 'reps') ?? '3');
  const timeoutMs = Number(one(opts, 'timeout-ms') ?? '120000');
  if (!Number.isInteger(reps) || reps < 1 || !Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new Error(`${SO2_INPUT_INVALID}: --reps and --timeout-ms must be positive integers`);
  }
  if (deps.profileBackend === undefined) throw new Error(`${SO2_INPUT_INVALID}: no database backend for profile`);
  // One base per --out directory: profile.csv and scc_components.csv have fixed names, so a second base must not overwrite the first.
  const existing = ['profile.csv', 'scc_components.csv'].filter((f) => existsSync(join(outDir, f)));
  if (existing.length > 0) {
    throw new Error(`${SO2_INPUT_INVALID}: ${existing.join(', ')} already in ${outDir}; use one --out per base (results/latency-gate/so2/profile-<projectId>)`);
  }
  const specPath = resolve(repoRoot, spec);
  const apg = await deps.extract(resolve(repoRoot, project), 'full', specExcludesOf(repoRoot, specPath));
  const backend = await deps.profileBackend();
  try {
    await backend.ingest(apg, specPath);
    const template = await backend.cycleTemplate(specPath);
    const runs = async (cypher: string, params: Readonly<Record<string, unknown>>): Promise<ProfileMeasurement[]> => {
      const ms: ProfileMeasurement[] = [];
      for (let i = 0; i <= reps; i++) ms.push(await backend.profile(cypher, params, timeoutMs));
      return ms;
    };
    const rows = [
      ...profileRows(projectId, 'ff-s02', await runs(template.cypher, template.params), MAX_CYCLE_LENGTH, CYCLE_ROW_CAP),
      ...profileRows(projectId, 'universal-cycle-metric', await runs(UNIVERSAL_METRIC_QUERIES.cyclicDependencyCount, {}), MAX_CYCLE_LENGTH, CYCLE_ROW_CAP),
    ];
    io.writeFile(join(outDir, 'profile.csv'), csvText(PROFILE_COLUMNS, rows));
    const components = stronglyConnectedComponents(buildFileGraph(apg));
    io.writeFile(join(outDir, 'scc_components.csv'), csvText(SCC_COLUMNS, sccRows(projectId, components, MAX_CYCLE_LENGTH)));
    io.out(`${projectId}: profile.csv (${String(rows.length)} rows), scc_components.csv (${String(components.length)} components) in ${outDir}\n`);
    return 0;
  } finally {
    await backend.close();
  }
}

// ---------------------------------------------------------------------------------------------
// The lane database backend of `profile` (credentials from the environment only, never argv; NFR-08)

function errorCodeOf(e: unknown): string {
  const code = (e as { code?: unknown }).code;
  return typeof code === 'string' ? code : 'unknown';
}

/**
 * `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` from `env` (the lane preamble). Ingestion goes through the C2
 * repository and `ingestAPG` (stateless mode, a temporary snapshot directory); PROFILE goes through a direct driver
 * session so that `resultAvailableAfter` and `resultConsumedAfter` are read (U1 residual: `executeQuery` hides them).
 */
export function neo4jProfileBackend(env: NodeJS.ProcessEnv): Promise<ProfileBackend> {
  const uri = env.NEO4J_URI;
  const user = env.NEO4J_USER ?? 'neo4j';
  const password = env.NEO4J_PASSWORD;
  if (uri === undefined || password === undefined || password === '') {
    throw new Error(`${SO2_INPUT_INVALID}: profile needs NEO4J_URI and NEO4J_PASSWORD in the environment (lane preamble)`);
  }
  const store = mkdtempSync(join(tmpdir(), 'so2-profile-'));
  const repo = new Neo4jRepository({ neo4jUri: uri, neo4jUser: user, neo4jPassword: password, apgStorePath: store });
  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  const specOf = async (specPath: string): Promise<import('../src/shared/types/spec.js').ParsedSpec> => {
    const parsed = await parseSpec({ specFilePath: specPath });
    if (!parsed.success) throw new Error(`${SO2_INPUT_INVALID}: spec ${specPath}: ${parsed.errors.map((e) => e.message).join('; ')}`);
    return parsed.data;
  };
  return Promise.resolve({
    ingest: async (apg, specPath) => {
      const spec = await specOf(specPath);
      const r = await ingestAPG({ apgResult: apg, layerModel: spec.layerModel, mode: 'stateless' }, repo, new FileSystemSnapshotStore(store));
      if (!r.success) throw new Error(`${SO2_INPUT_INVALID}: ingestion failed: ${r.errors.map((e) => e.message).join('; ')}`);
    },
    cycleTemplate: async (specPath) => {
      const compiled = compileFunctions(compilerInputFromSpec(await specOf(specPath)));
      if (!compiled.success) throw new Error(`${SO2_INPUT_INVALID}: spec ${specPath} does not compile`);
      const q = compiled.data.symbolicQueries.find((x) => x.name === FF_S02_TEMPLATE);
      if (q === undefined) throw new Error(`${SO2_INPUT_INVALID}: spec ${specPath} compiles no ${FF_S02_TEMPLATE} query`);
      return { cypher: q.cypher, params: q.params };
    },
    profile: async (cypher, params, timeoutMs) => {
      const session = driver.session();
      try {
        const res = await session.run(`PROFILE ${cypher}`, params, { timeout: timeoutMs });
        const s = res.summary;
        return {
          availableMs: s.resultAvailableAfter.toNumber(), consumedMs: s.resultConsumedAfter.toNumber(),
          dbHits: totalDbHits(s.profile === false ? undefined : s.profile), rows: res.records.length, timedOut: false,
        };
      } catch (e) {
        const code = errorCodeOf(e);
        return { availableMs: null, consumedMs: null, dbHits: null, rows: null, timedOut: code.includes(TIMEOUT_MARKER), code };
      } finally {
        await session.close();
      }
    },
    close: async () => {
      await driver.close();
      await repo.close();
      rmSync(store, { recursive: true, force: true });
    },
  });
}
