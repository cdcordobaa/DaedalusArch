/**
 * v1.3 hexagonal/DDD operator run (DRAFT catalogue `Docs/v1.3/operator-catalogue-hexddd.md`). DEVELOPMENT DATA ONLY:
 * no pre-registration, the real-project specs were written by the operator author, and nothing here is a registered
 * SO4 estimate.
 *
 * Bases: the clean hexagonal and DDD reference projects (`tests/fixtures/v1.3-reference`) and the real projects of
 * `experiments/v1.3-operators-hexddd/projects.json`, cloned at their pinned SHA into `--ext` and installed with
 * `--ignore-scripts` (`--prepare` does both). Per base and spec: the unmodified copy must type-check with the base's tsc
 * and is evaluated once (the baseline). Per operator run under the spec's style: `findSites`, the precondition pass,
 * a seeded sample of at most `--k` (positives) or `--k-twin` (twins) eligible sites; each sampled site is applied to a
 * fresh copy, the copy is type-checked (any error is a `typecheck` row, BR-U5a-07) and evaluated through
 * `bin/firewall.ts evaluate --symbolic-only` against Neo4j. A positive is detected when every expected key is matched
 * by a violation that the baseline does not have; a twin is a false fire when it adds any blocking violation
 * (v1.3 tiers, `src/scoring-engine/rule-tiers.ts`).
 *
 * Usage (repository root; Neo4j 5.26 + APOC at NEO4J_URI):
 *   npx tsx scripts/v1.3/operators-hexddd-run.ts --prepare --ext <dir>
 *   NEO4J_URI=… NEO4J_USER=… NEO4J_PASSWORD=… npx tsx scripts/v1.3/operators-hexddd-run.ts --ext <dir> --work <dir> --out <dir> [--k 10] [--k-twin 6] [--only MO-H01,…] [--bases …]
 * Writes `<out>/run.json` (feasibility table, every row with its diff, summary) and prints the summary table.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { NodeProcessRunner } from '../../src/shared/process/node-process-runner.js';
import { ruleTier } from '../../src/scoring-engine/rule-tiers.js';
import { cliEvaluate } from '../lib/freeze-gate-main.js';
import { CYCLE_ROW_CAP, MAX_CYCLE_LENGTH } from '../lib/mutation/cycles.js';
import { compiledParams, compiledThresholds, loadCompiledSpec } from '../lib/mutation/expected.js';
import type { CompiledSpec } from '../lib/mutation/expected.js';
import { HEXDDD_CATALOGUE_PATH, HEXDDD_OPERATORS, positiveIdOf, stylesOf } from '../lib/mutation/hexddd/index.js';
import { buildImportGraph, openImportGraphProject } from '../lib/mutation/import-graph.js';
import { makePreparedBase } from '../lib/mutation/prepare.js';
import { catalogueVersionOf } from '../lib/mutation/registry.js';
import { mulberry32 } from '../lib/mutation/rng.js';
import { baseCycleCount, evaluatePreconditions, sortSites } from '../lib/mutation/sites.js';
import { provisionStubs } from '../lib/mutation/stubs.js';
import type { MutationOperator, MutationSite, PreconditionContext, ProjectHandle } from '../lib/mutation/types.js';
import { materialiseVariant } from './lib/materialise.js';
import { expectedKeys, fmtRate, matchesKey, newViolations, seedOf, summarise } from './lib/operators-hexddd.js';
import type { FeasibilityCell, RunRow, TemplateIds, Violation } from './lib/operators-hexddd.js';
import { loadReference } from './lib/reference-model.js';

export const MASTER_SEED = 20261016;
const APPLY_SEED = 20261016;
const PROJECTS = 'experiments/v1.3-operators-hexddd/projects.json';

interface Project {
  readonly id: string;
  readonly url: string;
  readonly sha: string;
  readonly root: string;
  readonly install: readonly string[];
  readonly styles: readonly ('hexagonal' | 'ddd')[];
}

interface Base {
  readonly baseId: string;
  readonly kind: 'reference' | 'real';
  readonly style: 'hexagonal' | 'ddd';
  /** Source directory (copied, never written). */
  readonly dir: string;
  readonly specPath: string;
  readonly tsc: string;
}

function arg(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

function run(cmd: string, args: readonly string[], cwd: string): void {
  const r = spawnSync(cmd, [...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed in ${cwd}: ${(r.stderr || r.stdout).slice(-2000)}`);
}

function prepare(repoRoot: string, ext: string): void {
  const { projects } = JSON.parse(fs.readFileSync(path.join(repoRoot, PROJECTS), 'utf8')) as { projects: Project[] };
  fs.mkdirSync(ext, { recursive: true });
  for (const p of projects) {
    const dir = path.join(ext, p.id);
    if (!fs.existsSync(path.join(dir, '.git'))) {
      fs.mkdirSync(dir, { recursive: true });
      run('git', ['init', '-q'], dir);
      run('git', ['remote', 'add', 'origin', p.url], dir);
      run('git', ['fetch', '-q', '--depth', '1', 'origin', p.sha], dir);
      run('git', ['checkout', '-q', 'FETCH_HEAD'], dir);
    }
    const root = path.join(dir, p.root);
    if (!fs.existsSync(path.join(root, 'node_modules'))) run(p.install[0] ?? 'npm', p.install.slice(1), root);
    process.stderr.write(`${p.id}: ready at ${root}\n`);
  }
}

/** Copies a project without `node_modules` and `.git`; links the source's `node_modules` when it has one. */
export function copyProject(src: string, dest: string): void {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src)) {
    if (e === 'node_modules' || e === '.git' || e === 'dist' || e.endsWith('.tsbuildinfo')) continue;
    fs.cpSync(path.join(src, e), path.join(dest, e), { recursive: true });
  }
  const nm = path.join(src, 'node_modules');
  if (fs.existsSync(nm)) fs.symlinkSync(fs.realpathSync(nm), path.join(dest, 'node_modules'), 'dir');
}

export function typecheck(tsc: string, dir: string): string[] {
  const r = spawnSync(process.execPath, [tsc, '--noEmit', '--incremental', 'false', '-p', path.join(dir, 'tsconfig.json')], { encoding: 'utf8', timeout: 600_000, cwd: dir });
  const out = `${r.stdout}${r.stderr}`;
  if (r.status === 0) return [];
  const errs = out.split('\n').filter((l) => /error TS\d+/.test(l));
  return errs.length > 0 ? errs : [`tsc exited ${String(r.status)}: ${out.slice(-500)}`];
}

function bases(repoRoot: string, ext: string, work: string): Base[] {
  const repoTsc = path.resolve(repoRoot, 'node_modules/typescript/lib/tsc.js');
  const out: Base[] = [];
  for (const style of ['hexagonal', 'ddd'] as const) {
    const ref = loadReference(repoRoot, style);
    const clean = ref.variants.find((v) => v.manifest.kind === 'clean');
    if (clean === undefined) throw new Error(`no clean variant for ${style}`);
    const m = materialiseVariant(ref, clean, path.join(work, 'materialised'));
    out.push({ baseId: `ref-${style}`, kind: 'reference', style, dir: m.projectDir, specPath: path.relative(repoRoot, ref.specPath), tsc: repoTsc });
  }
  const { projects } = JSON.parse(fs.readFileSync(path.join(repoRoot, PROJECTS), 'utf8')) as { projects: Project[] };
  for (const p of projects) {
    const dir = path.join(ext, p.id, p.root);
    const own = path.join(dir, 'node_modules/typescript/lib/tsc.js');
    for (const style of p.styles) {
      out.push({ baseId: `${p.id}-${style}`, kind: 'real', style, dir, specPath: `experiments/v1.3-operators-hexddd/specs/${p.id}-${style}.yaml`, tsc: fs.existsSync(own) ? own : repoTsc });
    }
  }
  return out;
}

async function contextOf(compiled: CompiledSpec, base: Base, handle: ProjectHandle): Promise<PreconditionContext> {
  const prepared = makePreparedBase({
    projectId: base.baseId,
    baseKind: 'fixture',
    dir: handle.root,
    baseCommit: '0'.repeat(40),
    tsconfigPath: 'tsconfig.json',
    tscPath: base.tsc,
    tscVersion: 'base tsc',
    overlays: [],
    specPath: base.specPath,
  });
  if (!prepared.success) throw new Error(prepared.errors.map((e) => e.message).join('; '));
  const g = buildImportGraph(handle, compiled.layers);
  return {
    base: prepared.data,
    baseGraph: g,
    baseCycleCount: baseCycleCount(g, MAX_CYCLE_LENGTH, CYCLE_ROW_CAP),
    maxCycleLength: MAX_CYCLE_LENGTH,
    cycleRowCap: CYCLE_ROW_CAP,
    thresholds: compiledThresholds(compiled),
    templateParams: compiledParams(compiled),
    enabledTemplates: [...compiled.enabled.keys()],
  };
}

function templateIds(compiled: CompiledSpec): TemplateIds {
  return new Map([...compiled.enabled.entries()].map(([t, fs_]) => [t, fs_.map((f) => f.functionId)]));
}

function unifiedDiff(before: string, after: string, label: string): string {
  const tmp = fs.mkdtempSync(path.join(path.dirname(after), '.diff-'));
  try {
    const a = path.join(tmp, 'a');
    fs.writeFileSync(a, fs.existsSync(before) ? fs.readFileSync(before) : '');
    const r = spawnSync('diff', ['-u', '--label', `a/${label}`, '--label', `b/${label}`, a, after], { encoding: 'utf8' });
    return r.stdout;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

export async function main(argv: readonly string[], repoRoot: string): Promise<number> {
  const ext = path.resolve(arg(argv, '--ext') ?? '.operators-hexddd-ext');
  if (argv.includes('--prepare')) {
    prepare(repoRoot, ext);
    return 0;
  }
  const work = path.resolve(arg(argv, '--work') ?? path.join(ext, '..', 'operators-hexddd-work'));
  const out = path.resolve(arg(argv, '--out') ?? 'results/v1.3-operators-hexddd');
  const k = Number(arg(argv, '--k') ?? '10');
  const kTwin = Number(arg(argv, '--k-twin') ?? '6');
  const only = arg(argv, '--only')?.split(',');
  const onlyBases = arg(argv, '--bases')?.split(',');
  const countOnly = argv.includes('--count-only');
  if ((process.env.NEO4J_URI ?? '').length === 0 && !countOnly) {
    process.stderr.write('NEO4J_URI is required (or --count-only)\n');
    return 2;
  }
  fs.mkdirSync(out, { recursive: true });
  fs.mkdirSync(work, { recursive: true });
  const evaluate = cliEvaluate(new NodeProcessRunner(), repoRoot, process.env);
  const ops = HEXDDD_OPERATORS.filter((o) => only === undefined || only.includes(o.id) || only.includes(positiveIdOf(o)));
  const cells: FeasibilityCell[] = [];
  const rows: RunRow[] = [];
  const baseInfo: Record<string, unknown>[] = [];

  for (const base of bases(repoRoot, ext, work).filter((b) => onlyBases === undefined || onlyBases.includes(b.baseId))) {
    const baseCopy = path.join(work, 'bases', base.baseId);
    copyProject(base.dir, baseCopy);
    const baseErrors = typecheck(base.tsc, baseCopy);
    const compiled = await loadCompiledSpec(repoRoot, base.specPath);
    if (!compiled.success) throw new Error(`${base.baseId}: ${compiled.errors.map((e) => e.message).join('; ')}`);
    const ids = templateIds(compiled.data);
    if (baseErrors.length > 0) {
      baseInfo.push({ baseId: base.baseId, excluded: 'base type-check', errors: baseErrors.slice(0, 20) });
      process.stderr.write(`${base.baseId}: excluded, base has ${String(baseErrors.length)} type errors\n`);
      continue;
    }
    let baseline: Violation[] = [];
    if (!countOnly) {
      const b = await evaluate(baseCopy, path.resolve(repoRoot, base.specPath));
      if (!b.success) throw new Error(`${base.baseId} baseline: ${b.errors.map((e) => e.message).join('; ')}`);
      baseline = [...b.data.violations];
    }
    const handle = openImportGraphProject(baseCopy, 'tsconfig.json');
    const ctx = await contextOf(compiled.data, base, handle);
    baseInfo.push({ baseId: base.baseId, kind: base.kind, style: base.style, specPath: base.specPath, files: ctx.baseGraph.files.size, tsc: path.relative(repoRoot, base.tsc).startsWith('..') ? 'project tsc' : 'repository tsc', baselineViolations: baseline.length });
    process.stderr.write(`${base.baseId}: ${String(ctx.baseGraph.files.size)} files, ${String(baseline.length)} baseline violations\n`);

    for (const op of ops) {
      if (!stylesOf(op).includes(base.style)) continue;
      const candidates = sortSites(op.findSites(handle, compiled.data.spec));
      const tally = evaluatePreconditions(op, handle, compiled.data.spec, candidates, ctx);
      const kk = op.role === 'twin' ? kTwin : k;
      const sample = mulberry32(seedOf(`${base.baseId}|${op.id}`, MASTER_SEED)).pickDistinct(tally.eligible, Math.min(kk, tally.eligible.length));
      cells.push({ baseId: base.baseId, style: base.style, operatorId: op.id, candidates: candidates.length, eligible: tally.eligible.length, sampled: sample.length, rejected: { ...tally.rejectedByReason } });
      if (countOnly) continue;
      let n = 0;
      for (const { site } of sample) {
        const rowId = `${base.baseId}__${op.id}__${String(n++)}`;
        rows.push(await applyRow(repoRoot, base, op, site, rowId, baseCopy, path.join(work, 'copies', rowId), ids, baseline, evaluate));
        const r = rows[rows.length - 1];
        process.stderr.write(`${rowId}: ${r?.status ?? ''}${r?.typecheckErrors[0] !== undefined ? ` (${r.typecheckErrors[0]})` : ''}\n`);
      }
    }
  }

  const byStyle = summarise(rows, cells, ops);
  const kindOf = (baseId: string): string => (baseId.startsWith('ref-') ? 'reference' : 'real');
  const byKind = summarise(
    rows.map((r) => ({ ...r, style: `${r.style}/${r.baseKind}` })),
    cells.map((c) => ({ ...c, style: `${c.style}/${kindOf(c.baseId)}` })),
    ops,
  );
  const catalogueVersion = fs.existsSync(path.join(repoRoot, HEXDDD_CATALOGUE_PATH)) ? catalogueVersionOf(fs.readFileSync(path.join(repoRoot, HEXDDD_CATALOGUE_PATH))) : null;
  const report = { generatedAt: new Date().toISOString(), catalogueVersion, masterSeed: MASTER_SEED, k, kTwin, bases: baseInfo, cells, summary: byStyle, summaryByKind: byKind, rows };
  fs.writeFileSync(path.join(out, countOnly ? 'feasibility.json' : 'run.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write('| Operator | Style | Sites (eligible/candidates) | Applied | Compiled | Evaluated | Hits | Rate [95% Wilson] |\n|---|---|---|---|---|---|---|---|\n');
  for (const s of byStyle) {
    process.stdout.write(`| ${s.operatorId} | ${s.style} | ${String(s.eligible)}/${String(s.candidates)} | ${String(s.applied)} | ${String(s.compiled)} | ${String(s.evaluated)} | ${String(s.hits)} | ${fmtRate(s.rate, s.low, s.high)} |\n`);
  }
  return 0;
}

async function applyRow(
  repoRoot: string,
  base: Base,
  op: MutationOperator,
  site: MutationSite,
  rowId: string,
  baseCopy: string,
  dest: string,
  ids: TemplateIds,
  baseline: readonly Violation[],
  evaluate: ReturnType<typeof cliEvaluate>,
): Promise<RunRow> {
  const role = op.role === 'twin' ? 'twin' : 'positive';
  const common = { rowId, operatorId: op.id, positiveId: positiveIdOf(op), role, baseId: base.baseId, baseKind: base.kind, style: base.style, site } as const;
  const empty = { expected: [], absentTemplates: [], hits: [], newBlocking: [], newAdvisory: [], typecheckErrors: [], editedFiles: [], createdFiles: [], stubs: [], diff: '' };
  copyProject(base.dir, dest);
  const handle = openImportGraphProject(dest, 'tsconfig.json');
  const r = op.apply(handle, site, mulberry32(APPLY_SEED));
  if (!r.success) {
    fs.rmSync(dest, { recursive: true, force: true });
    return { ...common, ...empty, status: 'apply-error', typecheckErrors: r.errors.map((e) => e.message) };
  }
  await handle.project.save();
  const edit = r.data;
  const uses = op.plannedImportUses?.(site) ?? [];
  let stubs: string[] = [];
  if (uses.length > 0) {
    const s = provisionStubs(dest, 'tsconfig.json', uses);
    if (s.success) stubs = s.data.map((x) => x.specifier);
  }
  const diff = [...edit.editedFiles, ...edit.createdFiles]
    .map((f) => unifiedDiff(path.join(baseCopy, f), path.join(dest, f), f))
    .join('');
  const { keys, absent } = role === 'positive' ? expectedKeys(op, site, edit, ids) : { keys: [], absent: [] };
  const files = { editedFiles: edit.editedFiles, createdFiles: edit.createdFiles, stubs, diff, expected: keys, absentTemplates: absent };
  const errors = typecheck(base.tsc, dest);
  if (errors.length > 0) {
    fs.rmSync(dest, { recursive: true, force: true });
    return { ...common, ...empty, ...files, status: 'typecheck', typecheckErrors: errors.slice(0, 10) };
  }
  const m = await evaluate(dest, path.resolve(repoRoot, base.specPath));
  fs.rmSync(dest, { recursive: true, force: true });
  if (!m.success) return { ...common, ...empty, ...files, status: 'evaluate-error', typecheckErrors: m.errors.map((e) => e.message) };
  const fresh = newViolations(baseline, m.data.violations);
  const blocking = fresh.filter((v) => ruleTier(v.functionId, base.style).tier === 'blocking');
  const advisory = fresh.filter((v) => ruleTier(v.functionId, base.style).tier !== 'blocking');
  const hits = keys.map((key) => fresh.some((v) => matchesKey(v, key)));
  const status = role === 'positive' ? (keys.length > 0 && hits.every((h) => h) ? 'detected' : 'missed') : blocking.length > 0 ? 'false-fire' : 'silent';
  return { ...common, ...empty, ...files, status, hits, newBlocking: blocking, newAdvisory: advisory };
}

if (process.argv[1]?.endsWith('operators-hexddd-run.ts') === true) {
  void main(process.argv.slice(2), process.cwd()).then(
    (c) => {
      process.exitCode = c;
    },
    (e: unknown) => {
      process.stderr.write(`${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`);
      process.exitCode = 2;
    },
  );
}
