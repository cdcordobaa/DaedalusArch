/**
 * Seeded recall on agent snapshots (REV-05 §5 item 1; v1.4 U10). Entry file: no exports. DEVELOPMENT DATA ONLY: no
 * pre-registration, not a registered SO4 estimate. Helpers and rules: `scripts/v1.4/lib/seeded-recall-agent.ts`.
 *
 * For the final snapshot of every trajectory (generator × task × arm × run; `snapshot-store.ts` `finalSnapshots`) of
 * each store: the snapshot is materialised into a work copy with the harness tsconfig (`harness-tsconfig.ts`) and a
 * copy-local `node_modules` linking each package of the pinned skeleton install (so stubs are written into the copy,
 * never into the install); missing packages are stubbed for both the unmutated copy and every mutant from the same
 * import uses (`stubs.ts`, BR-U5a-10). The unmutated copy is type-checked (the skeleton's tsc) and evaluated once. Then,
 * per operator of the snapshot's style (`operatorsFor`): `findSites`, the precondition pass, a seeded sample of at
 * most `--k` positive sites and `--k-twin` twin sites; each sampled site is applied to a fresh copy, type-checked (a
 * mutant with more tsc errors than its unmutated copy is a `typecheck` row and is not evaluated, BR-U5a-07 restated
 * for agent code that may already carry errors), and evaluated. `classifyRow` decides the status.
 *
 * Engine: `cypher-interp`, in process (the pipeline `evaluate --symbolic-only --engine cypher-interp` runs, CLI
 * defaults: scoring v1.3, instrument v2, post-seal rules on). No Neo4j, no model call, no network.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.4/seeded-recall-agent.ts --out <dir> [--work <dir>] [--skeleton <dir>] [--k 2] [--k-twin 1]
 *     [--seed 20261019] <store>[=<generator label>] ...
 *   npx tsx scripts/v1.4/seeded-recall-agent.ts --merge <run dir>,<run dir>,… --out <dir>   (one report from per-store runs)
 * `--skeleton <dir>`: where the pinned generator skeleton (`scripts/generator/skeleton`, the type-check environment of
 * record) is installed; `npm ci --ignore-scripts` from its lockfile runs there when it is absent (default
 * `<work>/skeleton`). This is the only network access (the npm registry).
 * Writes `<out>/run.json` (bases, feasibility cells, rows with diffs, summary) and `<out>/summary.md`.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { createPipeline } from '../../src/pipeline/pipeline-factory.js';
import { parseInstrumentVersion } from '../../src/fitness-compiler/role-exemptions.js';
import { parseNeuralAggregation } from '../../src/scoring-engine/neural-aggregation.js';
import { parseScoringMode } from '../../src/scoring-engine/tiered-scoring.js';
import { harnessTsconfigText } from '../lib/generators/harness-tsconfig.js';
import { CYCLE_ROW_CAP, MAX_CYCLE_LENGTH } from '../lib/mutation/cycles.js';
import { compiledParams, compiledThresholds, loadCompiledSpec } from '../lib/mutation/expected.js';
import type { CompiledSpec } from '../lib/mutation/expected.js';
import { buildImportGraph, openImportGraphProject } from '../lib/mutation/import-graph.js';
import { makePreparedBase } from '../lib/mutation/prepare.js';
import { mulberry32 } from '../lib/mutation/rng.js';
import { baseCycleCount, evaluatePreconditions, sortSites } from '../lib/mutation/sites.js';
import { collectImportUses, provisionStubs } from '../lib/mutation/stubs.js';
import type { ImportUse } from '../lib/mutation/stubs.js';
import type { MutationOperator, MutationSite, PreconditionContext, ProjectHandle } from '../lib/mutation/types.js';
import { expectedKeys, seedOf } from '../v1.3/lib/operators-hexddd.js';
import type { TemplateIds, Violation } from '../v1.3/lib/operators-hexddd.js';
import { classifyRow, operatorsFor, positiveOf, renderRecall, summariseRecall } from './lib/seeded-recall-agent.js';
import type { FeasibilityCell, RecallRow } from './lib/seeded-recall-agent.js';
import { discoverSnapshots, finalSnapshots } from './lib/snapshot-store.js';
import type { SnapshotRef } from './lib/snapshot-store.js';
import { spawnSync } from 'node:child_process';

const REPO = process.cwd();
export const SEED = 20261019;
const SKELETON = 'scripts/generator/skeleton';

/** The pinned generator skeleton install (express, @types/express, @types/node, typescript; BR-U5a-45). */
interface Skeleton {
  readonly nodeModules: string;
  readonly tsc: string;
}

/** `<dir>/node_modules` of the skeleton, installed there with `npm ci --ignore-scripts` from its lockfile when absent. */
function ensureSkeleton(dir: string): Skeleton {
  const nm = path.join(dir, 'node_modules');
  if (!fs.existsSync(path.join(nm, 'typescript/lib/tsc.js'))) {
    fs.mkdirSync(dir, { recursive: true });
    for (const f of ['package.json', 'package-lock.json']) fs.copyFileSync(path.join(REPO, SKELETON, f), path.join(dir, f));
    const r = spawnSync('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: dir, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`skeleton install failed: ${r.stderr.slice(-800)}`);
  }
  return { nodeModules: nm, tsc: path.join(nm, 'typescript/lib/tsc.js') };
}

let SKEL: Skeleton = { nodeModules: '', tsc: '' };

function arg(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

/** A work copy of a tree: files copied, the harness tsconfig, a copy-local node_modules with the repository @types. */
function copyTree(src: string, dest: string): void {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true, filter: (s) => !/[\\/](node_modules|\.git)$/.test(s) });
  fs.writeFileSync(path.join(dest, 'tsconfig.json'), harnessTsconfigText(dest));
  // Copy-local node_modules: one link per skeleton package, so a stub (`stubs.ts`) lands in the copy, never in the install.
  const nm = path.join(dest, 'node_modules');
  fs.mkdirSync(nm, { recursive: true });
  for (const e of fs.readdirSync(SKEL.nodeModules)) {
    if (e.startsWith('.')) continue;
    fs.symlinkSync(path.join(SKEL.nodeModules, e), path.join(nm, e), 'dir');
  }
}

function tscErrors(dir: string): number {
  const r = spawnSync(process.execPath, [SKEL.tsc, '--noEmit', '-p', path.join(dir, 'tsconfig.json')], { encoding: 'utf8', cwd: dir, timeout: 600_000 });
  if (r.status === 0) return 0;
  const n = `${r.stdout}${r.stderr}`.split('\n').filter((l) => /error TS\d+/.test(l)).length;
  return n > 0 ? n : 1;
}

function rel(p: string, root: string): string {
  return p
    .split(',')
    .map((x) => {
      const s = x.replace(/\\/g, '/');
      return s.startsWith(`${root}/`) ? s.slice(root.length + 1) : s.replace(/^\.\//, '');
    })
    .join(',');
}

async function evaluate(projectDir: string, specPath: string, apgStore: string): Promise<Violation[]> {
  const { executor, cleanup } = createPipeline({
    projectPath: projectDir, specFilePath: specPath, neo4jUri: '', neo4jUser: 'neo4j', neo4jPassword: '',
    evaluationMode: 'symbolic-only', pipelineMode: 'stateless', persist: false, diff: false, verbose: false,
    apgStorePath: apgStore, tsconfigPath: path.join(projectDir, 'tsconfig.json'),
    instrumentVersion: parseInstrumentVersion('v2'), neuralAggregation: parseNeuralAggregation('registered'),
    scoringMode: parseScoringMode('v1.3'), graphEngine: 'cypher-interp',
    postSealRules: true, // v1.4 U2 (ADR-V14-02): the declared post-seal overlay is part of the blocking tier (drift record §2)
  });
  try {
    const result = await executor.execute();
    if (!result.success) throw new Error(result.errors.map((e) => e.message).join('; '));
    const root = projectDir.replace(/\\/g, '/').replace(/\/+$/, '');
    return result.data.violations
      .filter((v) => typeof v.functionId === 'string' && typeof v.filePath === 'string')
      .map((v) => {
        const o = v as unknown as { functionId: string; filePath: string; target?: unknown; discriminator?: unknown };
        const disc = Array.isArray(o.discriminator) ? (o.discriminator as unknown[]).filter((d): d is string => typeof d === 'string') : [];
        return { functionId: o.functionId, filePath: rel(o.filePath, root), target: typeof o.target === 'string' ? rel(o.target, root) : '', discriminator: disc };
      });
  } finally {
    await cleanup();
  }
}

function specStyle(specPath: string): string {
  const doc = parseYaml(fs.readFileSync(specPath, 'utf8')) as { architecture?: { style?: unknown } } | null;
  return typeof doc?.architecture?.style === 'string' ? doc.architecture.style : 'unknown';
}

function contextOf(compiled: CompiledSpec, handle: ProjectHandle, id: string, specPath: string): PreconditionContext {
  const prepared = makePreparedBase({
    projectId: id.replace(/[^A-Za-z0-9._-]/g, '_'), baseKind: 'generated', dir: handle.root, baseGenerationTreeSha: '0'.repeat(40),
    tsconfigPath: 'tsconfig.json', tscPath: SKEL.tsc, tscVersion: 'skeleton tsc', overlays: [], specPath,
  });
  if (!prepared.success) throw new Error(prepared.errors.map((e) => e.message).join('; '));
  const g = buildImportGraph(handle, compiled.layers);
  return {
    base: prepared.data, baseGraph: g, baseCycleCount: baseCycleCount(g, MAX_CYCLE_LENGTH, CYCLE_ROW_CAP), maxCycleLength: MAX_CYCLE_LENGTH,
    cycleRowCap: CYCLE_ROW_CAP, thresholds: compiledThresholds(compiled), templateParams: compiledParams(compiled), enabledTemplates: [...compiled.enabled.keys()],
  };
}

function diffOf(before: string, after: string, label: string): string {
  const r = spawnSync('diff', ['-u', '--label', `a/${label}`, '--label', `b/${label}`, fs.existsSync(before) ? before : '/dev/null', after], { encoding: 'utf8' });
  return r.stdout;
}

interface BaseInfo {
  readonly snapshotId: string;
  readonly generator: string;
  readonly task: string;
  readonly arm: string;
  readonly step: number;
  readonly style: string;
  readonly spec: string | null;
  readonly files?: number;
  readonly tscErrors?: number;
  readonly baselineViolations?: number;
  readonly excluded?: string;
}

async function runSnapshot(
  ref: SnapshotRef, work: string, k: number, kTwin: number, seed: number,
  rows: RecallRow[], cells: FeasibilityCell[],
): Promise<BaseInfo> {
  const info = { snapshotId: `${ref.generator}:${ref.id}`, generator: ref.generator, task: ref.task, arm: ref.arm, step: ref.step, spec: ref.specRecorded };
  if (ref.specPath === null || !fs.existsSync(ref.specPath)) return { ...info, style: 'unknown', excluded: 'no spec' };
  const style = specStyle(ref.specPath);
  const raw = path.join(work, 'raw');
  fs.rmSync(raw, { recursive: true, force: true });
  ref.materialise(raw);
  const baseCopy = path.join(work, 'base');
  copyTree(raw, baseCopy);
  const usesR = collectImportUses(baseCopy, 'tsconfig.json');
  const baseUses: readonly ImportUse[] = usesR.success ? usesR.data : [];
  provisionStubs(baseCopy, 'tsconfig.json', baseUses);
  const baseErrors = tscErrors(baseCopy);
  const compiled = await loadCompiledSpec(REPO, ref.specPath);
  if (!compiled.success) return { ...info, style, excluded: `spec: ${compiled.errors.map((e) => e.message).join('; ')}` };
  const ids: TemplateIds = new Map([...compiled.data.enabled.entries()].map(([t, f]) => [t, f.map((x) => x.functionId)]));
  const apgStore = path.join(work, 'apg-store');
  const baseline = await evaluate(baseCopy, ref.specPath, apgStore);
  const handle = openImportGraphProject(baseCopy, 'tsconfig.json');
  const ctx = contextOf(compiled.data, handle, info.snapshotId, ref.specPath);
  let n = 0;
  for (const op of operatorsFor(style)) {
    const candidates = sortSites(op.findSites(handle, compiled.data.spec));
    const tally = evaluatePreconditions(op, handle, compiled.data.spec, candidates, ctx);
    const want = op.role === 'twin' ? kTwin : k;
    const sample = mulberry32(seedOf(`${info.snapshotId}|${op.id}`, seed)).pickDistinct(tally.eligible, Math.min(want, tally.eligible.length));
    cells.push({ snapshotId: info.snapshotId, style, operatorId: op.id, candidates: candidates.length, eligible: tally.eligible.length, sampled: sample.length, rejected: { ...tally.rejectedByReason } });
    for (const { site } of sample) {
      const rowId = `${info.snapshotId}__${op.id}__${String(n++)}`;
      rows.push(await applyRow(op, site, rowId, info, style, raw, baseCopy, path.join(work, 'mutant'), ids, baseUses, baseErrors, baseline, ref.specPath, apgStore));
      process.stderr.write(`${rowId}: ${rows[rows.length - 1]?.status ?? ''}\n`);
    }
  }
  return { ...info, style, files: ctx.baseGraph.files.size, tscErrors: baseErrors, baselineViolations: baseline.length };
}

async function applyRow(
  op: MutationOperator, site: MutationSite, rowId: string, info: { snapshotId: string; generator: string; task: string; arm: string }, style: string,
  raw: string, baseCopy: string, dest: string, ids: TemplateIds, baseUses: readonly ImportUse[], baseErrors: number,
  baseline: readonly Violation[], specPath: string, apgStore: string,
): Promise<RecallRow> {
  const role = op.role === 'twin' ? 'twin' : 'positive';
  const common = { rowId, snapshotId: info.snapshotId, generator: info.generator, task: info.task, arm: info.arm, style, operatorId: op.id, positiveId: positiveOf(op), role, site } as const;
  const empty = { expected: [], absentTemplates: [], hits: [], newBlocking: [], diff: '' };
  copyTree(raw, dest);
  try {
    const handle = openImportGraphProject(dest, 'tsconfig.json');
    const r = op.apply(handle, site, mulberry32(SEED));
    if (!r.success) return { ...common, ...empty, status: 'apply-error', typecheck: { base: baseErrors, mutant: null }, detail: r.errors.map((e) => e.message).join('; ') };
    await handle.project.save();
    const edit = r.data;
    provisionStubs(dest, 'tsconfig.json', [...baseUses, ...(op.plannedImportUses?.(site) ?? [])]);
    const diff = [...edit.editedFiles, ...edit.createdFiles].map((f) => diffOf(path.join(baseCopy, f), path.join(dest, f), f)).join('');
    const { keys, absent } = role === 'positive' ? expectedKeys(op, site, edit, ids) : { keys: [], absent: [] };
    const files = { expected: keys, absentTemplates: absent, diff };
    const errors = tscErrors(dest);
    if (errors > baseErrors) return { ...common, ...empty, ...files, status: 'typecheck', typecheck: { base: baseErrors, mutant: errors } };
    let mutant: Violation[];
    try {
      mutant = await evaluate(dest, specPath, apgStore);
    } catch (e) {
      return { ...common, ...empty, ...files, status: 'evaluate-error', typecheck: { base: baseErrors, mutant: errors }, detail: e instanceof Error ? e.message : String(e) };
    }
    const c = classifyRow(role, keys, baseline, mutant, style);
    return { ...common, ...files, status: c.status, hits: c.hits, newBlocking: c.newBlocking, typecheck: { base: baseErrors, mutant: errors } };
  } finally {
    fs.rmSync(dest, { recursive: true, force: true });
  }
}

async function main(argv: readonly string[]): Promise<number> {
  const out = arg(argv, '--out');
  const mergeDirs = arg(argv, '--merge');
  if (mergeDirs !== undefined && out !== undefined) return merge(mergeDirs.split(',').map((d) => path.resolve(d)), out);
  const k = Number(arg(argv, '--k') ?? '2');
  const kTwin = Number(arg(argv, '--k-twin') ?? '1');
  const seed = Number(arg(argv, '--seed') ?? String(SEED));
  const flags = new Set(['--out', '--work', '--k', '--k-twin', '--seed', '--skeleton']);
  const stores: { dir: string; generator: string }[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? '';
    if (flags.has(a)) {
      i++;
      continue;
    }
    const [dir = '', generator = 'unknown'] = a.split('=');
    stores.push({ dir: path.resolve(dir), generator });
  }
  if (out === undefined || stores.length === 0 || !Number.isInteger(k) || !Number.isInteger(kTwin)) {
    process.stderr.write('usage: seeded-recall-agent.ts --out <dir> [--work <dir>] [--k 2] [--k-twin 1] [--seed n] <store>[=<generator>] ...\n');
    return 2;
  }
  const workArg = arg(argv, '--work');
  const work = workArg !== undefined ? path.resolve(workArg) : fs.mkdtempSync(path.join(os.tmpdir(), 'seeded-recall-'));
  fs.mkdirSync(work, { recursive: true });
  SKEL = ensureSkeleton(path.resolve(arg(argv, '--skeleton') ?? path.join(work, 'skeleton')));
  const rows: RecallRow[] = [];
  const cells: FeasibilityCell[] = [];
  const bases: BaseInfo[] = [];
  const t0 = Date.now();
  try {
    for (const s of stores) {
      for (const ref of finalSnapshots(discoverSnapshots(s.dir, REPO, { generator: s.generator }))) {
        try {
          bases.push(await runSnapshot(ref, work, k, kTwin, seed, rows, cells));
        } catch (e) {
          bases.push({ snapshotId: `${ref.generator}:${ref.id}`, generator: ref.generator, task: ref.task, arm: ref.arm, step: ref.step, style: 'unknown', spec: ref.specRecorded, excluded: `error: ${e instanceof Error ? e.message : String(e)}` });
        }
        process.stderr.write(`${ref.generator}:${ref.id} done\n`);
      }
    }
  } finally {
    if (workArg === undefined) fs.rmSync(work, { recursive: true, force: true });
  }
  const params: RunParams = { k, kTwin, seed, typecheck: `skeleton install of ${SKELETON} (package-lock.json; express, @types/express, @types/node, typescript), harness tsconfig`, engine: 'cypher-interp (in process; scoring v1.3, instrument v2, post-seal rules on)', stores: stores.map((s) => ({ store: path.relative(REPO, s.dir), generator: s.generator })), elapsedMs: Date.now() - t0 };
  writeReport(out, params, bases, cells, rows);
  return 0;
}

interface RunParams {
  readonly k: number;
  readonly kTwin: number;
  readonly seed: number;
  readonly typecheck: string;
  readonly engine: string;
  readonly stores: readonly { readonly store: string; readonly generator: string }[];
  readonly elapsedMs: number;
}

interface RunFile {
  readonly params: RunParams;
  readonly bases: readonly BaseInfo[];
  readonly cells: readonly FeasibilityCell[];
  readonly rows: readonly RecallRow[];
}

function writeReport(out: string, params: RunParams, rawBases: readonly BaseInfo[], cells: readonly FeasibilityCell[], rows: readonly RecallRow[]): void {
  // Paths in messages are written repository-relative (no machine path in a committed file).
  const bases = rawBases.map((b) => (b.excluded === undefined ? b : { ...b, excluded: b.excluded.split(`${REPO}/`).join('').replace(/\/\S*\.claude\/worktrees\/[^/]+\//g, '') }));
  const summary = summariseRecall(rows, cells);
  fs.mkdirSync(path.resolve(out), { recursive: true });
  fs.writeFileSync(path.join(out, 'run.json'), `${JSON.stringify({ schema: 'seeded-recall-agent/v1', params, bases, cells, rows, summary }, null, 1)}\n`);
  const md = [
    '# Seeded recall on agent snapshots (development data; not a registered SO4 estimate)',
    '',
    `k = ${String(params.k)} positive and ${String(params.kTwin)} twin site(s) per operator per snapshot, seed ${String(params.seed)}; final snapshot of each trajectory; ${params.engine}. Type-check: ${params.typecheck}.`,
    '',
    renderRecall(summary),
    '',
    '## Snapshots',
    '',
    '| Snapshot | Style | Step | Files | tsc errors (unmutated) | Baseline violations | Excluded |',
    '|---|---|---|---|---|---|---|',
    ...bases.map((b) => `| ${b.snapshotId} | ${b.style} | ${String(b.step)} | ${String(b.files ?? '')} | ${String(b.tscErrors ?? '')} | ${String(b.baselineViolations ?? '')} | ${b.excluded ?? ''} |`),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(out, 'summary.md'), md);
  process.stdout.write(md);
}

/** `--merge <run dir>,… --out <dir>`: one report from per-store runs (each store may run in its own process). */
function merge(dirs: readonly string[], out: string): number {
  const parts = dirs.map((d) => JSON.parse(fs.readFileSync(path.join(d, 'run.json'), 'utf8')) as RunFile);
  const first = parts[0];
  if (first === undefined) return 2;
  const params: RunParams = { ...first.params, stores: parts.flatMap((p) => p.params.stores), elapsedMs: parts.reduce((a, p) => a + p.params.elapsedMs, 0) };
  writeReport(out, params, parts.flatMap((p) => p.bases), parts.flatMap((p) => p.cells), parts.flatMap((p) => p.rows));
  return 0;
}

main(process.argv.slice(2)).then(
  (c) => {
    process.exitCode = c;
  },
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`);
    process.exitCode = 2;
  },
);
