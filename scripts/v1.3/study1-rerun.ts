/**
 * v1.3 descriptive re-run of the Study 1 (v1.2E) data: E1 grid cells and SO4 held-out seeded copies.
 *
 * DESCRIPTIVE, v1.3 DEVELOPMENT INSTRUMENT, NOT A REGISTERED RESULT. Nothing here replaces or re-tests the frozen
 * v1.2E numbers in results/e1-grid/ and results/so4-heldout/; no pre-registration machinery is used.
 *
 * Every evaluation is the plain CLI (`bin/firewall.ts evaluate --symbolic-only --format json`) with the v1.3 defaults
 * (scoring v1.3 tiers, v1.3 extractor options: barrels `reExportEdges: 'both'`, `dynamicImports`, `moduleWiring`;
 * V13_COMPILE_OPTIONS) and instrument v2, as in Study 1. No judge call is made.
 *
 * Usage (repository root, Neo4j env loaded: `set -a; . ~/.daedalus-bt.env; set +a`):
 *   npx tsx scripts/v1.3/study1-rerun.ts e1  --outcomes <daedalus-e1-outcomes> --work <tmp dir outside the repo> --out <dir>
 *   npx tsx scripts/v1.3/study1-rerun.ts so4 --case results/so4-heldout/v2/case --paths-root <dir the plan's ../ paths resolve from> --out <dir>
 *   npx tsx scripts/v1.3/study1-rerun.ts e1-agg  --run <dir> --outcomes <dir> --out <dir>
 *   npx tsx scripts/v1.3/study1-rerun.ts so4-agg --run <dir> --out <dir>
 *   npx tsx scripts/v1.3/study1-rerun.ts compare --a <dir> --b <dir>      (byte comparison of two runs' reports)
 * Options for e1 / so4: --from <i> --to <j> (plan index range, inclusive), --only <runId,...>.
 *
 * E1: each cell is copied (symlinks kept) to `<work>/<model>/<task>/<level>/run-<i>` before evaluation, and extracted
 * with the pinned per-run tsconfig of Docs/generator-protocol.md §3 (ADR-032), written to `<work>/tsconfigs/`. The spec
 * is the cell's plan spec (specs/clean-arch.yaml for every cell, as in Study 1). The 7 GEN-TYPECHECK cells are
 * evaluated too and flagged; the aggregates use the 65 cells Study 1 accepted.
 * SO4: the 163 entries of experiments/so4-heldout/plan.json (7 bases, 156 seeded copies) are evaluated in place with
 * their own tsconfig and spec, as registered. The CLI does not write into the project: after every run the tree
 * (without node_modules and .git) is checked for files modified after the run started; any hit aborts the run.
 *
 * Reports are written with the volatile fields fixed (runId = the Study 1 run id, durationMs / timings /
 * executionTimeMs = 0, projectPath = the Study 1 relative path), so two runs can be compared byte for byte.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { harnessTsconfigText } from '../lib/generators/harness-tsconfig.js';
import { sourceFilePaths } from '../lib/generators/outcome.js';
import { treeLoc } from '../lib/so5-size.js';

const REPO = process.cwd();
const LABEL = 'descriptive, v1.3 development instrument, not a registered result';
const TSX = resolve(REPO, 'node_modules/.bin/tsx');
const CLI_ENTRY = 'bin/firewall.ts';

// ── small helpers ─────────────────────────────────────────────────────────────

function arg(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}
function need(argv: readonly string[], name: string): string {
  const v = arg(argv, name);
  if (v === undefined) throw new Error(`missing --${name}`);
  return v;
}
function readJson<T>(p: string): T {
  return JSON.parse(readFileSync(p, 'utf8')) as T;
}
function writeText(p: string, t: string): void {
  mkdirSync(resolve(p, '..'), { recursive: true });
  writeFileSync(p, t);
}
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const f3 = (x: number | null | undefined): string => (x === null || x === undefined || Number.isNaN(x) ? '' : x.toFixed(3));
const f4 = (x: number | null | undefined): string => (x === null || x === undefined || Number.isNaN(x) ? '' : x.toFixed(4));
function csv(header: readonly string[], rows: readonly (readonly (string | number)[])[]): string {
  const q = (v: string | number): string => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header.map(q).join(','), ...rows.map((r) => r.map(q).join(','))].join('\n') + '\n';
}
const mean = (xs: readonly number[]): number | null => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length);

function childEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const k of ['PATH', 'HOME', 'NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD']) {
    const v = process.env[k];
    if (v !== undefined) env[k] = v;
  }
  return env;
}
function scrub(t: string): string {
  const pw = process.env.NEO4J_PASSWORD;
  return pw !== undefined && pw !== '' ? t.split(pw).join('<redacted>') : t;
}

interface Report {
  runId: string;
  projectPath: string;
  durationMs: number;
  timings?: { totalMs?: number; stages?: { durationMs?: number }[] };
  functionResults?: { executionTimeMs?: number }[];
  violations: Violation[];
  tiers?: Tiers;
  verdict: string;
  ahsDeterministic: number;
  ahsCombined?: number;
  disabledFunctions?: { functionId: string; reason: string }[];
  graphStats?: { edgeCountByType?: Record<string, number> };
  importResolution?: Record<string, number>;
  [k: string]: unknown;
}
interface Violation {
  functionId: string;
  filePath: string;
  discriminator?: string[];
  deterministic?: boolean;
  route?: string;
  [k: string]: unknown;
}
interface TierRule { functionId: string; tier: string; violationCount: number; violated: boolean }
interface Tiers {
  verdict: string;
  v12eVerdict: string;
  blockingAhs: number;
  style: string;
  blocking: { rules: TierRule[]; violatedRules: number; violationCount: number };
  advisory: { rules: TierRule[]; violatedRules?: number; violationCount?: number };
  [k: string]: unknown;
}

/**
 * Fixes the volatile fields so two runs compare byte for byte. The absolute directory evaluated (the E1 temp copy)
 * can appear inside warning messages; it is replaced by `projectPath` everywhere.
 */
function normalise(raw: Report, runId: string, projectPath: string, absDir: string): Report {
  const r = JSON.parse(JSON.stringify(raw).split(absDir).join(projectPath)) as Report;
  r.runId = runId;
  r.projectPath = projectPath;
  r.durationMs = 0;
  if (r.timings !== undefined) {
    if (r.timings.totalMs !== undefined) r.timings.totalMs = 0;
    for (const s of r.timings.stages ?? []) s.durationMs = 0;
  }
  for (const f of r.functionResults ?? []) if (f.executionTimeMs !== undefined) f.executionTimeMs = 0;
  return r;
}

function evaluate(project: string, spec: string, tsconfig: string | undefined): Report {
  const uri = process.env.NEO4J_URI;
  if (uri === undefined || process.env.NEO4J_PASSWORD === undefined) throw new Error('Neo4j env not loaded (set -a; . ~/.daedalus-bt.env; set +a)');
  const args = [CLI_ENTRY, 'evaluate', '--project', project, '--spec', spec, '--format', 'json', '--symbolic-only', '--neo4j-uri', uri, '--engine', 'neo4j'];
  if (tsconfig !== undefined) args.push('--tsconfig', tsconfig);
  const res = spawnSync(TSX, args, { cwd: REPO, env: childEnv(), encoding: 'utf8', maxBuffer: 1 << 30, timeout: 1_800_000 });
  const start = res.stdout.indexOf('{');
  if (start < 0) throw new Error(`no JSON from evaluate (exit ${String(res.status)}): ${scrub(res.stderr.slice(-800))}`);
  return JSON.parse(res.stdout.slice(start)) as Report;
}

/** Files under `dir` (no node_modules, no .git) modified at or after `sinceMs`. */
function modifiedSince(dir: string, sinceMs: number): string[] {
  const hits: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && statSync(p).mtimeMs >= sinceMs) hits.push(relative(dir, p));
    }
  };
  walk(dir);
  return hits;
}

function inRange(i: number, id: string, argv: readonly string[]): boolean {
  const from = Number(arg(argv, 'from') ?? 0);
  const to = Number(arg(argv, 'to') ?? Number.MAX_SAFE_INTEGER);
  const only = arg(argv, 'only');
  if (only !== undefined) return only.split(',').includes(id);
  return i >= from && i <= to;
}

// ── E1 ───────────────────────────────────────────────────────────────────────

interface E1Plan { e1: { models: string[]; specLevels: string[]; tasks: { taskId: string; specPath: string }[]; runs: number } }
interface E1Cell { index: number; runId: string; model: string; specLevel: string; taskId: string; runIndex: number; specPath: string; rel: string }

function e1Cells(planPath: string): E1Cell[] {
  const plan = readJson<E1Plan>(planPath);
  const out: E1Cell[] = [];
  let index = 0;
  for (const model of plan.e1.models) {
    for (const specLevel of plan.e1.specLevels) {
      for (const task of plan.e1.tasks) {
        for (let i = 0; i < plan.e1.runs; i++) {
          const runId = `e1-grid-${String(index).padStart(3, '0')}-${model}_${task.taskId}_${specLevel}_run-${String(i)}`;
          out.push({ index, runId, model, specLevel, taskId: task.taskId, runIndex: i, specPath: task.specPath, rel: join(model, task.taskId, specLevel, `run-${String(i)}`) });
          index += 1;
        }
      }
    }
  }
  return out;
}

function runE1(argv: readonly string[]): void {
  const outcomes = resolve(need(argv, 'outcomes'));
  const work = resolve(need(argv, 'work'));
  const out = resolve(need(argv, 'out'));
  if (work.startsWith(REPO + '/') || work === REPO) throw new Error('--work must be outside the repository');
  mkdirSync(join(work, 'tsconfigs'), { recursive: true });
  for (const c of e1Cells(resolve(REPO, arg(argv, 'plan') ?? 'experiments/e1-grid/plan.json'))) {
    if (!inRange(c.index, c.runId, argv)) continue;
    const src = join(outcomes, c.rel);
    if (!existsSync(join(src, 'src'))) {
      process.stderr.write(`${c.runId}: no src/, skipped\n`);
      continue;
    }
    const copy = join(work, c.rel);
    rmSync(copy, { recursive: true, force: true });
    mkdirSync(resolve(copy, '..'), { recursive: true });
    cpSync(src, copy, { recursive: true, verbatimSymlinks: true });
    const real = realpathSync(copy);
    const tsconfig = join(work, 'tsconfigs', `${c.runId}.json`);
    writeFileSync(tsconfig, harnessTsconfigText(real));
    const t0 = Date.now();
    const report = normalise(evaluate(real, resolve(REPO, c.specPath), tsconfig), c.runId, `../daedalus-e1-outcomes/${c.rel}`, real);
    writeText(join(out, 'reports', `${c.runId}.json`), JSON.stringify(report, null, 2) + '\n');
    const size = { runId: c.runId, files: sourceFilePaths(real).length, loc: treeLoc(real) };
    writeText(join(out, 'reports', `${c.runId}.size.json`), JSON.stringify(size) + '\n');
    process.stderr.write(`${c.runId}: verdict ${report.tiers?.verdict ?? '?'} blocking ${String(report.tiers?.blocking.violationCount ?? '?')} (${String(Date.now() - t0)} ms)\n`);
  }
}

// ── SO4 ──────────────────────────────────────────────────────────────────────

interface PlanEntry { projectId: string; path: string; specPath: string }

function runSo4(argv: readonly string[]): void {
  const caseDir = resolve(need(argv, 'case'));
  const pathsRoot = resolve(need(argv, 'paths-root'));
  const out = resolve(need(argv, 'out'));
  const plan = readJson<{ projects: PlanEntry[] }>(resolve(REPO, arg(argv, 'plan') ?? 'experiments/so4-heldout/plan.json'));
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).stdout.trim();
  const recDir = join(caseDir, 'reports');
  const records = new Map<string, { file: string; rec: Record<string, unknown> }>();
  for (const f of readdirSync(recDir).filter((x) => x.endsWith('.run.json')).sort(cmp)) {
    const rec = readJson<Record<string, unknown>>(join(recDir, f));
    records.set(String(rec.projectId), { file: f, rec });
  }
  const caseOut = join(out, 'case');
  mkdirSync(join(caseOut, 'reports'), { recursive: true });
  for (const f of ['manifest.json', 'case-rows.json']) writeFileSync(join(caseOut, f), readFileSync(join(caseDir, f)));
  plan.projects.forEach((p, i) => {
    const r = records.get(p.projectId);
    if (r === undefined) throw new Error(`no Study 1 run record for ${p.projectId}`);
    if (!inRange(i, String(r.rec.runId), argv)) return;
    const dir = realpathSync(resolve(pathsRoot, p.path));
    const t0 = Date.now() - 1000;
    const report = normalise(evaluate(dir, resolve(REPO, p.specPath), undefined), String(r.rec.runId), p.path, dir);
    const touched = modifiedSince(dir, t0);
    if (touched.length > 0) throw new Error(`${p.projectId}: the evaluation modified ${touched.slice(0, 5).join(', ')}`);
    const runId = String(r.rec.runId);
    writeText(join(caseOut, 'reports', `${runId}.json`), JSON.stringify(report, null, 2) + '\n');
    const rec = { ...r.rec, cliCommit: head, startedAt: '1970-01-01T00:00:00.000Z', wallMs: 0, note: LABEL };
    writeText(join(caseOut, 'reports', r.file), JSON.stringify(rec, null, 1) + '\n');
    process.stderr.write(`${runId}: ${String(report.violations.length)} violations (${String(Date.now() - t0)} ms)\n`);
  });
}

// ── compare ──────────────────────────────────────────────────────────────────

function compareRuns(argv: readonly string[]): number {
  const a = resolve(need(argv, 'a'));
  const b = resolve(need(argv, 'b'));
  const fa = readdirSync(a).filter((f) => f.endsWith('.json')).sort(cmp);
  const fb = new Set(readdirSync(b).filter((f) => f.endsWith('.json')));
  let same = 0;
  const diff: string[] = [];
  for (const f of fa) {
    if (!fb.has(f)) continue;
    if (readFileSync(join(a, f)).equals(readFileSync(join(b, f)))) same += 1;
    else diff.push(f);
  }
  process.stdout.write(`compared ${String(same + diff.length)} files present in both: ${String(same)} byte-identical, ${String(diff.length)} differ${diff.length > 0 ? `: ${diff.join(', ')}` : ''}\n`);
  return diff.length === 0 ? 0 : 1;
}

// ── E1 aggregation ───────────────────────────────────────────────────────────

const symKey = (v: Violation): string => `${v.functionId}|${v.filePath}|${(v.discriminator ?? []).join(';')}`;
function multiset(vs: readonly Violation[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const v of vs) m.set(symKey(v), (m.get(symKey(v)) ?? 0) + 1);
  return m;
}
function countBy<T>(xs: readonly T[], key: (x: T) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of xs) m.set(key(x), (m.get(key(x)) ?? 0) + 1);
  return m;
}
const fmtCounts = (m: ReadonlyMap<string, number>): string => [...m.entries()].sort(([x], [y]) => cmp(x, y)).map(([k, v]) => `${k}=${String(v)}`).join(';');

interface CellRow {
  cell: E1Cell;
  study1Status: string;
  files: number;
  loc: number;
  v13: Report;
  v12: Report | undefined;
  blockingIds: Set<string>;
  blocking: Violation[];
  advisory: Violation[];
  v12Sym: Violation[];
}

function e1Aggregate(argv: readonly string[]): void {
  const run = resolve(need(argv, 'run'));
  const out = resolve(need(argv, 'out'));
  const cells = e1Cells(resolve(REPO, arg(argv, 'plan') ?? 'experiments/e1-grid/plan.json'));
  const status = new Map<string, string>();
  for (const line of readFileSync(resolve(REPO, 'results/e1-grid/agg/runs.csv'), 'utf8').split('\n').slice(1)) {
    const m = /^([^,]+),[^,]+,[^,]+,([^,]+),([^,]*),/.exec(line);
    if (m !== null) status.set(m[1]!, m[2] === 'accepted' ? 'accepted' : `${m[2]!}:${m[3]!}`);
  }
  const rows: CellRow[] = [];
  for (const c of cells) {
    const p = join(run, 'reports', `${c.runId}.json`);
    if (!existsSync(p)) continue;
    const v13 = readJson<Report>(p);
    const size = readJson<{ files: number; loc: number }>(join(run, 'reports', `${c.runId}.size.json`));
    const v12p = resolve(REPO, 'results/e1-grid/reports', `${c.runId}.json`);
    const v12 = existsSync(v12p) ? readJson<Report>(v12p) : undefined;
    const tiers = v13.tiers;
    if (tiers === undefined) throw new Error(`${c.runId}: no tiers block (not a v1.3 report)`);
    const blockingIds = new Set(tiers.blocking.rules.map((r) => r.functionId));
    const sym = v13.violations.filter((v) => v.route !== 'neural');
    rows.push({
      cell: c, study1Status: status.get(c.runId) ?? 'no-record', files: size.files, loc: size.loc, v13, v12, blockingIds,
      blocking: sym.filter((v) => blockingIds.has(v.functionId)), advisory: sym.filter((v) => !blockingIds.has(v.functionId)),
      v12Sym: (v12?.violations ?? []).filter((v) => v.deterministic === true),
    });
  }

  // Per cell.
  const cellRows = rows.map((r) => {
    const t = r.v13.tiers!;
    const cv05 = r.v13.violations.filter((v) => v.functionId === 'FF-CV05').length;
    const v12cv05 = r.v12Sym.filter((v) => v.functionId === 'FF-CV05').length;
    return [
      r.cell.runId, r.cell.model, r.cell.specLevel, r.cell.taskId, r.cell.runIndex, r.study1Status, r.files, r.loc,
      t.verdict, t.v12eVerdict, f3(t.blockingAhs), f3(r.v13.ahsDeterministic), r.blocking.length, t.blocking.violatedRules,
      fmtCounts(countBy(r.blocking, (v) => v.functionId)), r.advisory.length, fmtCounts(countBy(r.advisory, (v) => v.functionId)), cv05,
      f4(r.blocking.length / r.files),
      r.v12?.verdict ?? '', f3(r.v12?.ahsCombined), f3(r.v12?.ahsDeterministic), r.v12Sym.length, v12cv05,
    ];
  });
  const cellHeader = [
    'run_id', 'model', 'spec_level', 'task_id', 'run_index', 'study1_status', 'files', 'loc',
    'v13_verdict', 'v13_v12e_verdict', 'v13_blocking_ahs', 'v13_ahs_deterministic', 'v13_blocking_findings', 'v13_blocking_rules_violated',
    'v13_blocking_by_rule', 'v13_advisory_findings', 'v13_advisory_by_rule', 'v13_cv05_findings', 'v13_blocking_per_file',
    'v12e_verdict', 'v12e_ahs_combined', 'v12e_ahs_deterministic', 'v12e_symbolic_findings', 'v12e_cv05_findings',
  ];
  writeText(join(out, 'cells.csv'), csv(cellHeader, cellRows));

  // Aggregates over the cells Study 1 accepted, by spec level × model, plus per arm and spec level.
  const valid = rows.filter((r) => r.study1Status === 'accepted');
  const arm = (m: string): string => (m.startsWith('gpt') ? 'codex' : 'claude');
  const groups = new Map<string, CellRow[]>();
  const add = (k: string, r: CellRow): void => {
    const l = groups.get(k);
    if (l === undefined) groups.set(k, [r]); else l.push(r);
  };
  for (const r of valid) {
    add(`${r.cell.specLevel}|${r.cell.model}`, r);
    add(`${r.cell.specLevel}|all-${arm(r.cell.model)}`, r);
    add(`all|${r.cell.model}`, r);
    add(`all|all-${arm(r.cell.model)}`, r);
  }
  const levelOrder = ['none', 'minimal-prose', 'full-aac', 'all'];
  const modelOrder = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-4-5', 'all-claude', 'gpt-5.6-terra', 'all-codex'];
  const keys = [...groups.keys()].sort((x, y) => {
    const [lx, mx] = x.split('|');
    const [ly, my] = y.split('|');
    return modelOrder.indexOf(mx!) - modelOrder.indexOf(my!) || levelOrder.indexOf(lx!) - levelOrder.indexOf(ly!);
  });
  const aggHeader = [
    'spec_level', 'model', 'n_cells', 'mean_files', 'mean_loc',
    'v13_mean_blocking_per_file', 'v13_pooled_blocking_per_file', 'v13_mean_blocking_findings', 'v13_share_cells_any_blocking', 'v13_share_cells_fail',
    'v13_mean_blocking_ahs', 'v13_advisory_share', 'v13_cv05_share', 'v13_mean_symbolic_per_file',
    'v12e_mean_ahs_combined', 'v12e_share_cells_pass', 'v12e_mean_symbolic_per_file', 'v12e_cv05_share', 'v12e_share_cells_any_v13_blocking_rule',
  ];
  const aggRows = keys.map((k) => {
    const g = groups.get(k)!;
    const [level, model] = k.split('|');
    const files = g.reduce((a, r) => a + r.files, 0);
    const blocking = g.reduce((a, r) => a + r.blocking.length, 0);
    const advisory = g.reduce((a, r) => a + r.advisory.length, 0);
    const cv05 = g.reduce((a, r) => a + r.v13.violations.filter((v) => v.functionId === 'FF-CV05').length, 0);
    const v12all = g.reduce((a, r) => a + r.v12Sym.length, 0);
    const v12cv05 = g.reduce((a, r) => a + r.v12Sym.filter((v) => v.functionId === 'FF-CV05').length, 0);
    return [
      level!, model!, g.length, f3(mean(g.map((r) => r.files))), f3(mean(g.map((r) => r.loc))),
      f4(mean(g.map((r) => r.blocking.length / r.files))), f4(blocking / files), f3(mean(g.map((r) => r.blocking.length))),
      f3(g.filter((r) => r.blocking.length > 0).length / g.length), f3(g.filter((r) => r.v13.tiers!.verdict !== 'pass').length / g.length),
      f3(mean(g.map((r) => r.v13.tiers!.blockingAhs))), f3(advisory / (advisory + blocking)), f3(cv05 / (advisory + blocking)),
      f4(mean(g.map((r) => (r.blocking.length + r.advisory.length) / r.files))),
      f3(mean(g.map((r) => r.v12?.ahsCombined ?? Number.NaN).filter((x) => !Number.isNaN(x)))),
      f3(g.filter((r) => r.v12?.verdict === 'pass').length / g.length),
      f4(mean(g.map((r) => r.v12Sym.length / r.files))), f3(v12all === 0 ? null : v12cv05 / v12all),
      f3(g.filter((r) => r.v12Sym.some((v) => r.blockingIds.has(v.functionId))).length / g.length),
    ];
  });
  writeText(join(out, 'by_level_model.csv'), csv(aggHeader, aggRows));

  // What changed: per rule, findings added / removed against the Study 1 symbolic findings of the same cell.
  const ruleChange = new Map<string, { v12: number; v13: number; added: number; removed: number; cellsChanged: number; tier: string }>();
  const changeRows: (string | number)[][] = [];
  const disabledDiff = new Map<string, number>();
  const edgeRows: (string | number)[][] = [];
  for (const r of valid) {
    const a = multiset(r.v12Sym);
    const b = multiset(r.v13.violations.filter((v) => v.route !== 'neural'));
    const perRule = new Map<string, { added: number; removed: number }>();
    for (const k of new Set([...a.keys(), ...b.keys()])) {
      const d = (b.get(k) ?? 0) - (a.get(k) ?? 0);
      if (d === 0) continue;
      const fid = k.split('|')[0]!;
      const e = perRule.get(fid) ?? { added: 0, removed: 0 };
      if (d > 0) e.added += d; else e.removed -= d;
      perRule.set(fid, e);
      changeRows.push([r.cell.runId, fid, r.blockingIds.has(fid) ? 'blocking' : 'advisory', d > 0 ? 'added' : 'removed', Math.abs(d), k.split('|')[1]!, k.split('|')[2]!]);
    }
    const fids = new Set([...r.v12Sym.map((v) => v.functionId), ...r.v13.violations.map((v) => v.functionId), ...r.v13.tiers!.blocking.rules.map((x) => x.functionId), ...r.v13.tiers!.advisory.rules.map((x) => x.functionId)]);
    for (const fid of fids) {
      const e = ruleChange.get(fid) ?? { v12: 0, v13: 0, added: 0, removed: 0, cellsChanged: 0, tier: r.blockingIds.has(fid) ? 'blocking' : 'advisory' };
      e.v12 += r.v12Sym.filter((v) => v.functionId === fid).length;
      e.v13 += r.v13.violations.filter((v) => v.functionId === fid).length;
      const pr = perRule.get(fid);
      if (pr !== undefined) {
        e.added += pr.added;
        e.removed += pr.removed;
        e.cellsChanged += 1;
      }
      ruleChange.set(fid, e);
    }
    const d12 = new Set((r.v12?.disabledFunctions ?? []).map((d) => d.functionId));
    const d13 = new Set((r.v13.disabledFunctions ?? []).map((d) => d.functionId));
    for (const f of d13) if (!d12.has(f)) disabledDiff.set(`+${f}`, (disabledDiff.get(`+${f}`) ?? 0) + 1);
    for (const f of d12) if (!d13.has(f)) disabledDiff.set(`-${f}`, (disabledDiff.get(`-${f}`) ?? 0) + 1);
    const e12 = r.v12?.graphStats?.edgeCountByType ?? {};
    const e13 = r.v13.graphStats?.edgeCountByType ?? {};
    edgeRows.push([r.cell.runId, e12.IMPORTS ?? '', e13.IMPORTS ?? '', e12.RE_EXPORTS ?? '', e13.RE_EXPORTS ?? '', r.v12?.importResolution?.unsupportedDynamic ?? '', r.v13.importResolution?.unsupportedDynamic ?? '']);
  }
  writeText(join(out, 'finding_changes.csv'), csv(['run_id', 'function_id', 'v13_tier', 'change', 'count', 'file_path', 'discriminator'], changeRows));
  writeText(join(out, 'rule_changes.csv'), csv(['function_id', 'v13_tier', 'v12e_findings', 'v13_findings', 'added', 'removed', 'cells_changed'],
    [...ruleChange.entries()].sort(([x], [y]) => cmp(x, y)).map(([fid, e]) => [fid, e.tier, e.v12, e.v13, e.added, e.removed, e.cellsChanged])));
  writeText(join(out, 'graph_changes.csv'), csv(['run_id', 'v12e_imports', 'v13_imports', 'v12e_re_exports', 'v13_re_exports', 'v12e_unsupported_dynamic', 'v13_unsupported_dynamic'], edgeRows));
  writeText(join(out, 'disabled_changes.json'), JSON.stringify(Object.fromEntries([...disabledDiff.entries()].sort(([x], [y]) => cmp(x, y))), null, 1) + '\n');
  writeText(join(out, 'README.md'), `# v1.3 descriptive re-run of the E1 cells\n\n**${LABEL}.** The registered v1.2E E1 numbers are in \`results/e1-grid/\` and stay frozen. See \`Docs/DiagnosticRuns/v1.3-study1-rerun-2026-10-15.md\`.\n\n- \`reports/\`: one v1.3 symbolic-only report per cell (volatile fields fixed), plus \`<run>.size.json\` (files, LOC).\n- \`cells.csv\`: per cell; \`by_level_model.csv\`: aggregates over the ${String(valid.length)} cells Study 1 accepted.\n- \`rule_changes.csv\`, \`finding_changes.csv\`, \`graph_changes.csv\`, \`disabled_changes.json\`: v1.3 against the Study 1 symbolic findings of the same cell.\n`);
}

// ── SO4 aggregation ──────────────────────────────────────────────────────────

interface Instance { seedId: string; operatorId: string; status: string; detectedBy: string[]; undeclaredNew: unknown[]; split: string }

function so4Aggregate(argv: readonly string[]): void {
  const run = resolve(need(argv, 'run'));
  const out = resolve(need(argv, 'out'));
  const s13 = readJson<{ perInstance: Instance[]; twinSpecificity: { clean: number; scored: number } }>(join(run, 'score.json'));
  const s12 = readJson<{ perInstance: Instance[]; twinSpecificity: { clean: number; scored: number } }>(resolve(REPO, 'results/so4-heldout/v2/score.json'));
  const tally = (xs: readonly Instance[]): Map<string, Record<string, number>> => {
    const m = new Map<string, Record<string, number>>();
    for (const i of xs) {
      const op = i.operatorId.replace(/n$/, '');
      const e = m.get(op) ?? {};
      e[i.status] = (e[i.status] ?? 0) + 1;
      m.set(op, e);
    }
    return m;
  };
  const t12 = tally(s12.perInstance);
  const t13 = tally(s13.perInstance);
  const ops = [...new Set([...t12.keys(), ...t13.keys()])].sort(cmp);
  const rec = (e: Record<string, number> | undefined): string => {
    const m = e?.matched ?? 0;
    const n = m + (e?.missed ?? 0);
    return n === 0 ? '' : `${String(m)}/${String(n)}`;
  };
  const spec = (e: Record<string, number> | undefined): string => {
    const c = e?.['twin-clean'] ?? 0;
    const n = c + (e?.['twin-fired'] ?? 0);
    return n === 0 ? '' : `${String(c)}/${String(n)}`;
  };
  const other = (e: Record<string, number> | undefined): string => fmtCounts(new Map(Object.entries(e ?? {}).filter(([k]) => !['matched', 'missed', 'twin-clean', 'twin-fired'].includes(k))));
  writeText(join(out, 'by_operator.csv'), csv(
    ['operator_id', 'v12e_recall', 'v13_recall', 'v12e_twin_specificity', 'v13_twin_specificity', 'v12e_other', 'v13_other'],
    ops.map((op) => [op, rec(t12.get(op)), rec(t13.get(op)), spec(t12.get(op)), spec(t13.get(op)), other(t12.get(op)), other(t13.get(op))]),
  ));
  const by12 = new Map(s12.perInstance.map((i) => [i.seedId, i]));
  const changed = s13.perInstance.filter((i) => {
    const o = by12.get(i.seedId);
    return o === undefined || o.status !== i.status || o.detectedBy.join(';') !== i.detectedBy.join(';');
  }).map((i) => {
    const o = by12.get(i.seedId);
    return [i.seedId, i.operatorId, o?.status ?? '', i.status, o?.detectedBy.join(';') ?? '', i.detectedBy.join(';'), JSON.stringify(i.undeclaredNew)];
  });
  writeText(join(out, 'seed_changes.csv'), csv(['seed_id', 'operator_id', 'v12e_status', 'v13_status', 'v12e_detected_by', 'v13_detected_by', 'v13_undeclared_new'], changed));
  const all = (xs: readonly Instance[]): { m: number; n: number } => {
    const pos = xs.filter((i) => i.status === 'matched' || i.status === 'missed');
    return { m: pos.filter((i) => i.status === 'matched').length, n: pos.length };
  };
  const a12 = all(s12.perInstance);
  const a13 = all(s13.perInstance);
  writeText(join(out, 'summary.json'), JSON.stringify({
    label: LABEL,
    recall: { v12e: `${String(a12.m)}/${String(a12.n)}`, v13: `${String(a13.m)}/${String(a13.n)}` },
    twinSpecificity: { v12e: `${String(s12.twinSpecificity.clean)}/${String(s12.twinSpecificity.scored)}`, v13: `${String(s13.twinSpecificity.clean)}/${String(s13.twinSpecificity.scored)}` },
    seedsChanged: changed.length,
  }, null, 1) + '\n');
}

// ── main ─────────────────────────────────────────────────────────────────────

function main(): number {
  const [mode, ...argv] = process.argv.slice(2);
  switch (mode) {
    case 'e1': runE1(argv); return 0;
    case 'so4': runSo4(argv); return 0;
    case 'e1-agg': e1Aggregate(argv); return 0;
    case 'so4-agg': so4Aggregate(argv); return 0;
    case 'compare': return compareRuns(argv);
    default: throw new Error('mode must be e1, so4, e1-agg, so4-agg or compare');
  }
}

try {
  process.exitCode = main();
} catch (err) {
  process.stderr.write(`${scrub(err instanceof Error ? err.message : String(err))}\n`);
  process.exitCode = 2;
}
