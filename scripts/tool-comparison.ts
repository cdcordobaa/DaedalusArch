/**
 * Tool comparison (Experiment A) and real fix-commit pairs (Experiment B), ADR-030.
 *
 * Commands (run from the repository root):
 *   translate <plan.json>       write the dependency-cruiser config of every spec of the plan, and the translation table
 *   run <plan.json>             run the pinned dependency-cruiser on every plan entry (no LLM call, no Neo4j)
 *   score-comparison            score Experiment A from results/tool-comparison/ (DaedalusArch reports + depcruise runs)
 *   score-pairs                 score Experiment B from results/real-pairs/
 *
 * DaedalusArch itself is run by the registered harness (`run-experiment-cli.ts <plan>`, symbolic-only, instrument v2).
 * The scoring is a pure function of the stored reports, the stored depcruise runs, the SO4 manifest, the registered
 * SO4 v2 seed statuses and `corpus/real-violation-pairs.json` (analysis plan §13).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { functionIdOfRule, globRegex, normaliseTarget, TRANSLATED_FUNCTIONS, translateSpec } from './depcruise-translate.js';
import type { Translation } from './depcruise-translate.js';
import { expandPlan, loadPlan, runIdOf } from './run-experiment.js';
import type { ExperimentPlan, PlanEntry } from './run-experiment.js';

export const DEPCRUISE_DIR = 'experiments/tool-comparison/depcruise';
export const DEPCRUISE_BIN = `${DEPCRUISE_DIR}/node_modules/.bin/depcruise`;

/** Comparable functions (ADR-030 item 2). */
export const COMPARABLE = Object.keys(TRANSLATED_FUNCTIONS).sort();

/**
 * POST-HOC sensitivity variant `dts` (declared in ADR-030 results, never primary): translation 1.0.0 excludes every
 * `.d.ts` module from the cruise (T8, the extractor's own exclude), which also removes package targets that resolve to
 * a declaration file (`node_modules/<stub>/index.d.ts`, `node_modules/@types/...`), so FF-P01 edges to them vanish. The
 * variant keeps `.d.ts` modules in the graph and excludes them as rule sources instead. Its outputs carry the suffix
 * `-dts` (`configs-dts/`, `runs-dts/`, `*-dts.csv`).
 */
export type Variant = '' | 'dts';
let VARIANT: Variant = '';
const sfx = (): string => (VARIANT === '' ? '' : `-${VARIANT}`);
const DTS = globRegex('**/*.d.ts');

/** The `dts` variant of a translated config (see Variant). */
export function dtsVariant(config: { forbidden: readonly Record<string, unknown>[]; options: Record<string, unknown> }): typeof config {
  const options = { ...config.options };
  const ex = (options['exclude'] as { path: string[] } | undefined)?.path ?? [];
  options['exclude'] = { path: ex.filter((r) => r !== DTS) };
  const forbidden = config.forbidden.map((r) => {
    const from = { ...(r['from'] as Record<string, unknown>) };
    from['pathNot'] = [...((from['pathNot'] as string[] | undefined) ?? []), DTS];
    return { ...r, from };
  });
  return { forbidden, options };
}

/** One finding in the shared comparison shape. */
export interface Finding {
  readonly functionId: string;
  readonly filePath: string;
  /** Edge target file or package; '' for orphans; the canonical cycle (joined by ' > ') for FF-S02. */
  readonly target: string;
  /** Cycle members (FF-S02 only). */
  readonly cycle?: readonly string[];
}

export interface DepcruiseRun {
  readonly runId: string;
  readonly projectId: string;
  readonly path: string;
  readonly specPath: string;
  readonly depcruiseVersion: string;
  readonly translationVersion: string;
  readonly wallMs: number;
  readonly exitCode: number | null;
  readonly totalCruised: number;
  readonly findings: readonly Finding[];
  readonly error?: string;
}

/** Rotate a simple cycle (first node not repeated) to start at its smallest path; direction kept. */
export function canonicalCycle(nodes: readonly string[]): string[] {
  const ring = nodes.length > 1 && nodes[0] === nodes[nodes.length - 1] ? nodes.slice(0, -1) : [...nodes];
  if (ring.length === 0) return [];
  let k = 0;
  ring.forEach((n, i) => { if (n < (ring[k] ?? '')) k = i; });
  return [...ring.slice(k), ...ring.slice(0, k)];
}

/** The comparison key of a finding (functionId, filePath, target); cycles key on the canonical cycle only. */
export function findingKey(f: Finding): string {
  if (f.functionId === 'FF-S02') return JSON.stringify([f.functionId, f.target]);
  return JSON.stringify([f.functionId, f.filePath, f.target]);
}

interface DaViolation {
  readonly functionId: string;
  readonly filePath: string;
  readonly target?: string;
  readonly discriminator?: readonly string[];
  readonly route?: string;
}

/** DaedalusArch report violations in the shared shape (symbolic only; `functions` limits the set). */
export function daFindings(report: { readonly violations?: readonly DaViolation[] }, functions?: readonly string[]): Finding[] {
  const out: Finding[] = [];
  for (const v of report.violations ?? []) {
    if (v.route !== undefined && v.route !== 'symbolic') continue;
    if (functions !== undefined && !functions.includes(v.functionId)) continue;
    if (v.functionId === 'FF-S02') {
      const raw = v.discriminator?.[0];
      const nodes = raw !== undefined ? (JSON.parse(raw) as string[]) : v.filePath.split(',');
      const c = canonicalCycle(nodes);
      out.push({ functionId: v.functionId, filePath: c[0] ?? '', target: c.join(' > '), cycle: c });
    } else {
      out.push({ functionId: v.functionId, filePath: v.filePath, target: v.functionId === 'FF-C04' ? '' : (v.target ?? '') });
    }
  }
  return out;
}

interface DcViolation {
  readonly type?: string;
  readonly from: string;
  readonly to: string;
  readonly rule: { readonly name: string };
  readonly cycle?: readonly { readonly name: string }[] | readonly string[];
}

/** dependency-cruiser violations in the shared shape (ADR-030 item 4). */
export function depcruiseFindings(violations: readonly DcViolation[]): Finding[] {
  const out: Finding[] = [];
  for (const v of violations) {
    const functionId = functionIdOfRule(v.rule.name);
    if (functionId === 'FF-S02') {
      const tail = (v.cycle ?? []).map((c) => (typeof c === 'string' ? c : c.name));
      const c = canonicalCycle([v.from, ...tail]);
      out.push({ functionId, filePath: c[0] ?? '', target: c.join(' > '), cycle: c });
    } else if (functionId === 'FF-C04') {
      out.push({ functionId, filePath: v.from, target: '' });
    } else {
      out.push({ functionId, filePath: v.from, target: normaliseTarget(v.to) });
    }
  }
  return out;
}

/** Multiset difference of keys, seeded minus baseline (MAT-03 applied to the shared key). */
export function newFindings(seeded: readonly Finding[], baseline: readonly Finding[]): Finding[] {
  const left = new Map<string, number>();
  for (const f of baseline) left.set(findingKey(f), (left.get(findingKey(f)) ?? 0) + 1);
  const out: Finding[] = [];
  for (const f of seeded) {
    const k = findingKey(f);
    const n = left.get(k) ?? 0;
    if (n > 0) left.set(k, n - 1);
    else out.push(f);
  }
  return out;
}

export function uniqueKeys(fs: readonly Finding[]): Set<string> {
  return new Set(fs.map(findingKey));
}

// ---------------------------------------------------------------------------------------------
// Experiment A scoring

export interface ExpectedKey { readonly functionId: string; readonly filePath: string; readonly target?: string }
export interface ManifestRow {
  readonly seedId: string; readonly projectId: string; readonly operatorId: string;
  readonly editedFiles: readonly string[]; readonly createdFiles: readonly string[];
  readonly expected: { readonly functionIds: readonly string[]; readonly keys: readonly ExpectedKey[] };
}

/** TP when a new finding of a comparable function has an expected key (function, file, target). */
export function detects(news: readonly Finding[], keys: readonly ExpectedKey[]): boolean {
  const want = new Set(keys.filter((k) => COMPARABLE.includes(k.functionId))
    .map((k) => findingKey({ functionId: k.functionId, filePath: k.filePath, target: k.functionId === 'FF-C04' ? '' : (k.target ?? '') })));
  return news.some((f) => want.has(findingKey(f)));
}

/** A twin fires when a new comparable finding lies on a file the operator edited or created. */
export function twinFires(news: readonly Finding[], row: ManifestRow): boolean {
  const site = new Set([...row.editedFiles, ...row.createdFiles]);
  return news.some((f) => site.has(f.filePath));
}

function csvCell(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: readonly Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const cols = Object.keys(rows[0] ?? {});
  return [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n';
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n');
  const head = (lines.shift() ?? '').split(',');
  return lines.map((l) => {
    const cells = l.split(',');
    return Object.fromEntries(head.map((h, i) => [h, cells[i] ?? '']));
  });
}

function median(xs: readonly number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[m] ?? NaN) : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2;
}

/** Wilson 95% interval of k / n. */
export function wilson(k: number, n: number): [number, number] {
  if (n === 0) return [NaN, NaN];
  const z = 1.959963984540054;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

const r3 = (x: number): number => Math.round(x * 1000) / 1000;

// ---------------------------------------------------------------------------------------------
// I/O helpers

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

function writeOut(file: string, text: string): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

function plannedEntries(repoRoot: string, planFile: string): { plan: ExperimentPlan; entries: PlanEntry[] } {
  const loaded = loadPlan(resolve(repoRoot, planFile), repoRoot);
  if (!loaded.ok) throw new Error(`${loaded.code}: ${loaded.detail}`);
  const ex = expandPlan(loaded.plan, repoRoot);
  if (!ex.ok) throw new Error(`${ex.code}: ${ex.detail}`);
  return { plan: loaded.plan, entries: ex.entries };
}

function configPath(outDir: string, specPath: string): string {
  return join(outDir, 'depcruise', `configs${sfx()}`, `${basename(specPath, '.yaml')}.json`);
}

async function cmdTranslate(repoRoot: string, planFile: string): Promise<void> {
  const { plan, entries } = plannedEntries(repoRoot, planFile);
  const outDir = resolve(repoRoot, plan.outDir);
  const table: Record<string, Omit<Translation, 'config'> & { readonly ruleCount: number }> = {};
  for (const specPath of [...new Set(entries.map((e) => e.specPath))].sort()) {
    const t = await translateSpec(resolve(repoRoot, specPath));
    const cfg = VARIANT === 'dts' ? dtsVariant(t.config as unknown as Parameters<typeof dtsVariant>[0]) : t.config;
    writeOut(configPath(outDir, specPath), JSON.stringify(cfg, null, 2) + '\n');
    const { config, ...rest } = t;
    table[specPath] = { ...rest, ruleCount: config.forbidden.length };
  }
  if (VARIANT === '') writeOut(join(outDir, 'depcruise', 'translation.json'), JSON.stringify(table, null, 2) + '\n');
  process.stdout.write(`translated ${String(Object.keys(table).length)} specs into ${plan.outDir}/depcruise/configs\n`);
}

function depcruiseVersion(repoRoot: string): string {
  return readJson<{ version: string }>(resolve(repoRoot, DEPCRUISE_DIR, 'node_modules/dependency-cruiser/package.json')).version;
}

function cmdRun(repoRoot: string, planFile: string): void {
  const { plan, entries } = plannedEntries(repoRoot, planFile);
  const outDir = resolve(repoRoot, plan.outDir);
  const bin = resolve(repoRoot, DEPCRUISE_BIN);
  const version = depcruiseVersion(repoRoot);
  const translationVersion = readJson<Record<string, { translationVersion: string }>>(join(outDir, 'depcruise', 'translation.json'));
  for (const e of entries) {
    const runId = runIdOf(plan.id, e);
    const cwd = resolve(repoRoot, e.path);
    const cfg = configPath(outDir, e.specPath);
    const t0 = process.hrtime.bigint();
    const res = spawnSync(bin, ['--config', cfg, '--output-type', 'json', '--no-progress', '.'], { cwd, encoding: 'utf8', maxBuffer: 1 << 30 });
    const wallMs = Number((process.hrtime.bigint() - t0) / 1000000n);
    let findings: Finding[] = [];
    let totalCruised = 0;
    let error: string | undefined;
    try {
      const out = JSON.parse(res.stdout) as { summary: { violations: DcViolation[]; totalCruised: number } };
      findings = depcruiseFindings(out.summary.violations);
      totalCruised = out.summary.totalCruised;
    } catch (err) {
      error = `${err instanceof Error ? err.message : String(err)}: ${res.stderr.slice(0, 500)}`;
    }
    const run: DepcruiseRun = {
      runId, projectId: e.projectId, path: e.path, specPath: e.specPath, depcruiseVersion: version,
      translationVersion: translationVersion[e.specPath]?.translationVersion ?? '', wallMs, exitCode: res.status, totalCruised,
      findings, ...(error !== undefined ? { error } : {}),
    };
    writeOut(join(outDir, 'depcruise', `runs${sfx()}`, `${runId}.json`), JSON.stringify(run, null, 1) + '\n');
    process.stdout.write(`${runId}\t${String(wallMs)} ms\t${String(findings.length)} findings${error !== undefined ? '\tERROR' : ''}\n`);
  }
}

interface RunRecordLite { readonly runId: string; readonly status: string; readonly wallMs: number; readonly reportPath?: string }

function loadDa(outDir: string, runId: string): { record: RunRecordLite; report: { violations?: DaViolation[]; durationMs?: number } } {
  const record = readJson<RunRecordLite>(join(outDir, 'runs', `${runId}.run.json`));
  const report = readJson<{ violations?: DaViolation[]; durationMs?: number }>(join(outDir, record.reportPath ?? `reports/${runId}.json`));
  return { record, report };
}

function activeFunctions(outDir: string, specPath: string): string[] {
  const table = readJson<Record<string, { translated: { functionId: string }[] }>>(join(outDir, 'depcruise', 'translation.json'));
  return (table[specPath]?.translated ?? []).map((t) => t.functionId).sort();
}

function cmdScoreComparison(repoRoot: string): void {
  const { plan, entries } = plannedEntries(repoRoot, 'experiments/tool-comparison/plan.json');
  const outDir = resolve(repoRoot, plan.outDir);
  const manifest = readJson<{ rows: ManifestRow[] }>(resolve(repoRoot, '../daedalus-so4/manifest.json'));
  const rowById = new Map(manifest.rows.map((r) => [r.seedId, r]));
  const so4Status = new Map(parseCsv(readFileSync(resolve(repoRoot, 'results/so4-heldout/v2/agg/seed_coverage.csv'), 'utf8')).map((r) => [r['seed_id'] ?? '', r['status'] ?? '']));
  const byId = new Map(entries.map((e) => [e.projectId, e]));
  const findingsOf = (e: PlanEntry): { da: Finding[]; dc: Finding[]; daWall: number; daDuration: number; dcWall: number } => {
    const runId = runIdOf(plan.id, e);
    const fns = activeFunctions(outDir, e.specPath);
    const da = loadDa(outDir, runId);
    const dc = readJson<DepcruiseRun>(join(outDir, 'depcruise', `runs${sfx()}`, `${runId}.json`));
    if (dc.error !== undefined) throw new Error(`${runId}: depcruise error ${dc.error}`);
    return { da: daFindings(da.report, fns), dc: dc.findings.filter((f) => fns.includes(f.functionId)), daWall: da.record.wallMs, daDuration: da.report.durationMs ?? NaN, dcWall: dc.wallMs };
  };

  // Seeds and twins
  const seedRows: Record<string, unknown>[] = [];
  const runtimeRows: Record<string, unknown>[] = [];
  for (const e of entries) {
    const f = findingsOf(e);
    runtimeRows.push({ run_id: runIdOf(plan.id, e), project_id: e.projectId, da_wall_ms: f.daWall, da_duration_ms: f.daDuration, depcruise_wall_ms: f.dcWall });
    if (e.seed === undefined) continue;
    const row = rowById.get(e.seed.seedId);
    if (row === undefined) throw new Error(`seed ${e.seed.seedId} not in the manifest`);
    const base = byId.get(e.seed.baseProjectId);
    if (base === undefined) throw new Error(`base ${e.seed.baseProjectId} not in the plan`);
    const b = findingsOf(base);
    const daNew = newFindings(f.da, b.da);
    const dcNew = newFindings(f.dc, b.dc);
    const status = so4Status.get(row.seedId) ?? '';
    const positive = row.expected.functionIds.length > 0;
    const scored = positive ? (status === 'matched' || status === 'missed') : (status === 'twin-clean' || status === 'twin-fired');
    const daHit = positive ? detects(daNew, row.expected.keys) : twinFires(daNew, row);
    const dcHit = positive ? detects(dcNew, row.expected.keys) : twinFires(dcNew, row);
    const expectedKeys = new Set(row.expected.keys.map((k) => findingKey({ functionId: k.functionId, filePath: k.filePath, target: k.functionId === 'FF-C04' ? '' : (k.target ?? '') })));
    seedRows.push({
      seed_id: row.seedId, project_id: row.projectId, operator_id: row.operatorId, kind: positive ? 'seed' : 'twin',
      so4_v2_status: status, scored, da: daHit ? 1 : 0, depcruise: dcHit ? 1 : 0,
      da_new: daNew.length, depcruise_new: dcNew.length,
      da_other_new: daNew.filter((x) => !expectedKeys.has(findingKey(x))).length,
      depcruise_other_new: dcNew.filter((x) => !expectedKeys.has(findingKey(x))).length,
    });
  }
  writeOut(join(outDir, `seeds${sfx()}.csv`), toCsv(seedRows));
  writeOut(join(outDir, `runtime${sfx()}.csv`), toCsv(runtimeRows));

  // Per comparable rule (expected function of the operator), seeds: recall; twins: fire rate.
  const opRule: Record<string, string> = { 'MO-S01': 'FF-S01', 'MO-X01': 'FF-S01', 'MO-S03': 'FF-S03', 'MO-P01': 'FF-P01', 'MO-C04': 'FF-C04' };
  const recallRows: Record<string, unknown>[] = [];
  const group = (pred: (r: Record<string, unknown>) => boolean, label: string, rule: string, kind: string): void => {
    const rs = seedRows.filter((r) => r['scored'] === true && pred(r));
    const n = rs.length;
    const da = rs.filter((r) => r['da'] === 1).length;
    const dc = rs.filter((r) => r['depcruise'] === 1).length;
    const both = rs.filter((r) => r['da'] === 1 && r['depcruise'] === 1).length;
    const [dl, dh] = wilson(da, n);
    const [cl, ch] = wilson(dc, n);
    recallRows.push({
      group: label, rule, kind, n, da_hits: da, da_rate: n ? r3(da / n) : '', da_ci95: n ? `${r3(dl)}-${r3(dh)}` : '',
      depcruise_hits: dc, depcruise_rate: n ? r3(dc / n) : '', depcruise_ci95: n ? `${r3(cl)}-${r3(ch)}` : '',
      both: both, da_only: da - both, depcruise_only: dc - both,
    });
  };
  for (const op of ['MO-S01', 'MO-X01', 'MO-S03', 'MO-P01', 'MO-C04']) {
    group((r) => r['operator_id'] === op, op, opRule[op] ?? '', 'seed');
    group((r) => r['operator_id'] === `${op}n`, `${op}n`, opRule[op] ?? '', 'twin');
  }
  group((r) => r['kind'] === 'seed' && r['operator_id'] !== 'MO-X01', 'in-coverage seeds', 'all', 'seed');
  group((r) => r['kind'] === 'seed', 'all seeds', 'all', 'seed');
  group((r) => r['kind'] === 'twin', 'all twins', 'all', 'twin');
  writeOut(join(outDir, `recall${sfx()}.csv`), toCsv(recallRows));

  // Unseeded baselines: volume per comparable rule.
  const volRows: Record<string, unknown>[] = [];
  const total: Record<string, { da: number; dc: number; both: number }> = {};
  for (const e of entries.filter((x) => x.seed === undefined)) {
    const f = findingsOf(e);
    for (const fn of COMPARABLE) {
      const da = uniqueKeys(f.da.filter((x) => x.functionId === fn));
      const dc = uniqueKeys(f.dc.filter((x) => x.functionId === fn));
      const both = [...da].filter((k) => dc.has(k)).length;
      const active = activeFunctions(outDir, e.specPath).includes(fn);
      volRows.push({ project_id: e.projectId, rule: fn, active, da: da.size, depcruise: dc.size, overlap: both, da_only: da.size - both, depcruise_only: dc.size - both });
      if (active) {
        const t = total[fn] ?? { da: 0, dc: 0, both: 0 };
        total[fn] = { da: t.da + da.size, dc: t.dc + dc.size, both: t.both + both };
      }
    }
  }
  for (const fn of COMPARABLE) {
    const t = total[fn] ?? { da: 0, dc: 0, both: 0 };
    volRows.push({ project_id: 'ALL', rule: fn, active: '', da: t.da, depcruise: t.dc, overlap: t.both, da_only: t.da - t.both, depcruise_only: t.dc - t.both });
  }
  writeOut(join(outDir, `baseline-volume${sfx()}.csv`), toCsv(volRows));

  // Unique findings on the baselines, listed (for inspection of the disagreements).
  const diffRows: Record<string, unknown>[] = [];
  for (const e of entries.filter((x) => x.seed === undefined)) {
    const f = findingsOf(e);
    const da = uniqueKeys(f.da);
    const dc = uniqueKeys(f.dc);
    for (const k of [...da].filter((x) => !dc.has(x)).sort()) diffRows.push({ project_id: e.projectId, only: 'da', key: k });
    for (const k of [...dc].filter((x) => !da.has(x)).sort()) diffRows.push({ project_id: e.projectId, only: 'depcruise', key: k });
  }
  writeOut(join(outDir, `baseline-unique-findings${sfx()}.csv`), toCsv(diffRows));

  const daW = runtimeRows.map((r) => Number(r['da_wall_ms']));
  const dcW = runtimeRows.map((r) => Number(r['depcruise_wall_ms']));
  const summary = {
    plan: plan.id, depcruiseVersion: depcruiseVersion(repoRoot), runs: runtimeRows.length,
    runtime: {
      daWallMsMedian: median(daW), daWallMsTotal: daW.reduce((a, b) => a + b, 0),
      depcruiseWallMsMedian: median(dcW), depcruiseWallMsTotal: dcW.reduce((a, b) => a + b, 0),
      daDurationMsMedian: median(runtimeRows.map((r) => Number(r['da_duration_ms']))),
    },
    recall: recallRows, baselineTotals: total,
  };
  writeOut(join(outDir, `summary${sfx()}.json`), JSON.stringify(summary, null, 2) + '\n');
  process.stdout.write(`${JSON.stringify(summary.runtime)}\n`);
  for (const r of recallRows) process.stdout.write(`${JSON.stringify(r)}\n`);
  for (const [k, v] of Object.entries(total)) process.stdout.write(`${k} ${JSON.stringify(v)}\n`);
}

// ---------------------------------------------------------------------------------------------
// Experiment B scoring

export interface TouchedFile { readonly status: string; readonly path: string; readonly from?: string }

/** Files a finding involves: its file, an edge target that is a path, and cycle members. */
export function involved(f: Finding): string[] {
  if (f.cycle !== undefined) return [...f.cycle];
  return f.target.includes('/') ? [f.filePath, f.target] : [f.filePath];
}

/** A before-side finding with renamed paths mapped to their after-side names (R entries). */
export function renameFinding(f: Finding, renames: ReadonlyMap<string, string>): Finding {
  const m = (p: string): string => renames.get(p) ?? p;
  if (f.cycle !== undefined) {
    const c = canonicalCycle(f.cycle.map(m));
    return { functionId: f.functionId, filePath: c[0] ?? '', target: c.join(' > '), cycle: c };
  }
  return { functionId: f.functionId, filePath: m(f.filePath), target: m(f.target) };
}

export interface PairOutcome {
  readonly beforeOnTouched: number;
  readonly afterOnTouched: number;
  /** Before-side findings on touched files whose (rename-mapped) key is absent after the fix. */
  readonly resolved: readonly Finding[];
  /** Primary: at least one resolved finding (ADR-030 item 6). */
  readonly detects: boolean;
  /** Secondary: findings on touched files before, none after. */
  readonly detectsStrict: boolean;
}

export function scorePair(before: readonly Finding[], after: readonly Finding[], touched: readonly TouchedFile[]): PairOutcome {
  const renames = new Map(touched.filter((t) => t.from !== undefined).map((t) => [t.from ?? '', t.path]));
  const beforeSet = new Set(touched.map((t) => t.from ?? t.path));
  const afterSet = new Set(touched.map((t) => t.path));
  const onBefore = before.filter((f) => involved(f).some((p) => beforeSet.has(p)));
  const onAfter = after.filter((f) => involved(f).some((p) => afterSet.has(p)));
  const afterKeys = uniqueKeys(after);
  const resolved = onBefore.filter((f) => !afterKeys.has(findingKey(renameFinding(f, renames))));
  return {
    beforeOnTouched: onBefore.length, afterOnTouched: onAfter.length, resolved,
    detects: resolved.length > 0, detectsStrict: onBefore.length > 0 && onAfter.length === 0,
  };
}

function cmdScorePairs(repoRoot: string): void {
  const { plan, entries } = plannedEntries(repoRoot, 'experiments/real-pairs/plan.json');
  const outDir = resolve(repoRoot, plan.outDir);
  const pairs = readJson<{ pairs: { projectId: string; beforeSha: string; afterSha: string; researchNote: string; touchedFiles: TouchedFile[] }[] }>(resolve(repoRoot, 'corpus/real-violation-pairs.json')).pairs;
  const rows: Record<string, unknown>[] = [];
  const detail: Record<string, unknown>[] = [];
  const runtimeRows: Record<string, unknown>[] = [];
  pairs.forEach((p, i) => {
    const be = entries.find((e) => e.projectId.startsWith(`p${String(i + 1)}-before:`));
    const af = entries.find((e) => e.projectId.startsWith(`p${String(i + 1)}-after:`));
    if (be === undefined || af === undefined) throw new Error(`pair ${String(i + 1)} not in the plan`);
    const fns = activeFunctions(outDir, be.specPath);
    const side = (e: PlanEntry): { daAll: Finding[]; daCmp: Finding[]; dc: Finding[] } => {
      const runId = runIdOf(plan.id, e);
      const da = loadDa(outDir, runId);
      const dc = readJson<DepcruiseRun>(join(outDir, 'depcruise', `runs${sfx()}`, `${runId}.json`));
      if (dc.error !== undefined) throw new Error(`${runId}: depcruise error ${dc.error}`);
      runtimeRows.push({ run_id: runId, da_wall_ms: da.record.wallMs, da_duration_ms: da.report.durationMs ?? '', depcruise_wall_ms: dc.wallMs });
      return { daAll: daFindings(da.report), daCmp: daFindings(da.report, fns), dc: dc.findings.filter((f) => fns.includes(f.functionId)) };
    };
    const b = side(be);
    const a = side(af);
    const tools: [string, Finding[], Finding[]][] = [['da-symbolic-all', b.daAll, a.daAll], ['da-comparable', b.daCmp, a.daCmp], ['depcruise', b.dc, a.dc]];
    for (const [tool, bf, afs] of tools) {
      const o = scorePair(bf, afs, p.touchedFiles);
      const fnsResolved = [...new Set(o.resolved.map((f) => f.functionId))].sort();
      rows.push({
        pair: `p${String(i + 1)}`, project_id: p.projectId, before: p.beforeSha.slice(0, 8), after: p.afterSha.slice(0, 8), note: p.researchNote,
        tool, before_total: bf.length, after_total: afs.length, before_on_touched: o.beforeOnTouched, after_on_touched: o.afterOnTouched,
        resolved: o.resolved.length, resolved_functions: fnsResolved.join(' '), detects: o.detects ? 1 : 0, detects_strict: o.detectsStrict ? 1 : 0,
      });
      for (const f of o.resolved) detail.push({ pair: `p${String(i + 1)}`, tool, key: findingKey(f) });
    }
  });
  writeOut(join(outDir, `pairs${sfx()}.csv`), toCsv(rows));
  writeOut(join(outDir, `resolved-findings${sfx()}.csv`), toCsv(detail));
  writeOut(join(outDir, `runtime${sfx()}.csv`), toCsv(runtimeRows));
  const count = (tool: string, col: string): number => rows.filter((r) => r['tool'] === tool && r[col] === 1).length;
  const summary = {
    plan: plan.id, depcruiseVersion: depcruiseVersion(repoRoot), pairs: pairs.length,
    detected: Object.fromEntries(['da-symbolic-all', 'da-comparable', 'depcruise'].map((t) => [t, { primary: count(t, 'detects'), strict: count(t, 'detects_strict') }])),
  };
  writeOut(join(outDir, `summary${sfx()}.json`), JSON.stringify(summary, null, 2) + '\n');
  for (const r of rows) process.stdout.write(`${JSON.stringify(r)}\n`);
  process.stdout.write(`${JSON.stringify(summary.detected)}\n`);
}

export async function main(argv: readonly string[], repoRoot: string): Promise<number> {
  const vi = argv.indexOf('--variant');
  if (vi >= 0) { VARIANT = argv[vi + 1] === 'dts' ? 'dts' : ''; }
  const [cmd, arg] = argv.filter((_, i) => vi < 0 || (i !== vi && i !== vi + 1));
  if (!existsSync(resolve(repoRoot, DEPCRUISE_BIN)) && (cmd === 'run')) {
    process.stderr.write(`dependency-cruiser not installed: run npm ci in ${DEPCRUISE_DIR}\n`);
    return 1;
  }
  if (cmd === 'translate' && arg !== undefined) { await cmdTranslate(repoRoot, arg); return 0; }
  if (cmd === 'run' && arg !== undefined) { cmdRun(repoRoot, arg); return 0; }
  if (cmd === 'score-comparison') { cmdScoreComparison(repoRoot); return 0; }
  if (cmd === 'score-pairs') { cmdScorePairs(repoRoot); return 0; }
  process.stderr.write('Usage: npx tsx scripts/tool-comparison-cli.ts translate|run <plan.json> | score-comparison | score-pairs\n');
  return 2;
}
