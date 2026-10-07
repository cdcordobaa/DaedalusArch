/**
 * Golden snapshot normalisation (FR-30, D-U0-12).
 *
 * Only genuinely nondeterministic data is normalised:
 * - run-specific fields (runId, durationMs, executionTimeMs, violation id,
 *   timings, audit log, startedAt) are not picked;
 * - the repository root is replaced by `<root>` in every string;
 * - violations keep their per-function grouping in emitted order and are
 *   stable-sorted only inside each function group (Neo4j row order, no
 *   ORDER BY until FR-35);
 * - `no-cyclic-deps` cycles are rotated to a canonical start;
 * - warnings and unexecuted function ids are sorted.
 * `perDimensionScores` and `functionResults` keep emitted order (no sort).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { GoldenRun } from './golden-runner.js';
import { REPO_ROOT } from './golden-cases.js';

export const CYCLE_TEMPLATE = 'no-cyclic-deps';
/** `LIMIT 100` in the no-cyclic-deps template (cypher-templates.ts). */
export const CYCLE_ROW_CAP = 100;

export interface PerDimensionScoreRow {
  readonly dimension: string;
  readonly avr: number;
  readonly weight: number;
  readonly violationCount: number;
  readonly functionCount: number;
}

export interface FunctionResultRow {
  readonly functionId: string;
  readonly dimension: string;
  readonly passed: boolean;
  readonly violationCount: number;
}

export interface ViolationRow {
  readonly functionId: string;
  readonly type: string;
  readonly dimension: string;
  readonly severity: string;
  readonly route: string;
  readonly filePath: string;
  readonly message: string;
}

export interface TruncatedFunctionRow {
  readonly functionId: string;
  readonly count: number;
  readonly truncated: true;
}

export interface WarningRow {
  readonly stage: string;
  readonly code: string;
  readonly message: string;
}

export interface UniversalMetricsRow {
  readonly cyclicDependencyCount: number;
  readonly maxFanOut: number;
  readonly maxFanIn: number;
  readonly abstractionRatio: number;
  readonly averageInstability: number;
  readonly orphanFileCount: number;
}

export interface GoldenSnapshot {
  readonly caseId: string;
  readonly projectPath: string;
  readonly specVersion: string;
  readonly evaluationMode: string;
  readonly verdict: string;
  readonly ahsDeterministic: number;
  readonly perDimensionScores: readonly PerDimensionScoreRow[];
  readonly universalMetrics: UniversalMetricsRow;
  readonly functionResults: readonly FunctionResultRow[];
  readonly unexecutedFunctionIds: readonly string[];
  readonly violations: readonly ViolationRow[];
  readonly truncatedFunctions?: readonly TruncatedFunctionRow[];
  readonly warnings: readonly WarningRow[];
}

export interface NormaliseOptions {
  /** Repository root to replace with `<root>`; defaults to this repo. */
  readonly repoRoot?: string;
  /**
   * Other spellings of the root (e.g. the shell's `PWD` when the repo is
   * reached through `/Users/arkatechie/dev-link/...`). Each is used only when
   * it resolves to the same real path as `repoRoot`. Defaults to
   * `process.env.PWD` and `process.env.INIT_CWD`.
   */
  readonly rootAliases?: readonly (string | undefined)[];
}

function realpathOrUndefined(p: string): string | undefined {
  try {
    return fs.realpathSync(p);
  } catch {
    return undefined;
  }
}

/**
 * The resolved and the real path of the root, plus every alias that resolves
 * to the same real path (symlinked spellings such as dev-link), longest first.
 */
export function rootVariants(
  repoRoot: string,
  aliases: readonly (string | undefined)[] = [process.env['PWD'], process.env['INIT_CWD']],
): string[] {
  const variants = new Set<string>([path.resolve(repoRoot)]);
  const real = realpathOrUndefined(repoRoot);
  if (real !== undefined) {
    variants.add(real);
    for (const alias of aliases) {
      if (alias === undefined || alias === '') continue;
      if (realpathOrUndefined(alias) === real) variants.add(path.resolve(alias));
    }
  }
  return [...variants].filter((v) => v.length > 1).sort((a, b) => b.length - a.length);
}

export function replaceRoots(value: string, roots: readonly string[]): string {
  let out = value;
  for (const root of roots) {
    out = out.split(root).join('<root>');
  }
  return out;
}

/** Comma-joined `[a,…,a]` cycle → rotated to the smallest member, re-closed. */
export function canonicaliseCycle(cycle: string): string {
  const parts = cycle.split(',');
  if (parts.length < 2) return cycle;
  const members = parts[0] === parts[parts.length - 1] ? parts.slice(0, -1) : parts;
  let minIdx = 0;
  for (let i = 1; i < members.length; i++) {
    if ((members[i] as string) < (members[minIdx] as string)) minIdx = i;
  }
  const rotated = [...members.slice(minIdx), ...members.slice(0, minIdx)];
  return [...rotated, rotated[0] as string].join(',');
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareViolations(a: ViolationRow, b: ViolationRow): number {
  return compareStrings(a.filePath, b.filePath)
    || compareStrings(a.message, b.message)
    || compareStrings(a.type, b.type);
}

export function normaliseForSnapshot(
  caseId: string,
  run: GoldenRun,
  options: NormaliseOptions = {},
): GoldenSnapshot {
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  const roots = rootVariants(repoRoot, options.rootAliases);
  const r = (s: string): string => replaceRoots(s, roots);
  const { report, evaluationResults, compiledSymbolic } = run;

  const cycleFunctionIds = new Set(
    compiledSymbolic.filter((f) => f.templateName === CYCLE_TEMPLATE).map((f) => f.functionId),
  );

  // Function results in emitted order (sequential evaluator loop).
  const functionResults: FunctionResultRow[] = evaluationResults.symbolicResults.map((fr) => ({
    functionId: String(fr.functionId),
    dimension: fr.dimension,
    passed: fr.passed,
    violationCount: fr.violations.length,
  }));

  // Cap fallback (R2): a cycle function that hit LIMIT 100 is truncated.
  const truncatedIds = new Set(
    functionResults
      .filter((fr) => cycleFunctionIds.has(fr.functionId) && fr.violationCount === CYCLE_ROW_CAP)
      .map((fr) => fr.functionId),
  );
  const truncatedFunctions: TruncatedFunctionRow[] = [...truncatedIds].map((functionId) => ({
    functionId,
    count: CYCLE_ROW_CAP,
    truncated: true as const,
  }));

  const executed = new Set(functionResults.map((fr) => fr.functionId));
  const unexecutedFunctionIds = compiledSymbolic
    .map((f) => f.functionId)
    .filter((id) => !executed.has(id))
    .sort(compareStrings);

  // Violations: per-function groups in emitted order; sort only inside a group.
  const groups = new Map<string, ViolationRow[]>();
  for (const v of report.violations) {
    const functionId = String(v.functionId);
    if (truncatedIds.has(functionId)) continue;
    let filePath = r(v.filePath);
    let message = r(v.message);
    if (cycleFunctionIds.has(functionId)) {
      const canonical = canonicaliseCycle(filePath);
      message = message.split(filePath).join(canonical);
      filePath = canonical;
    }
    const row: ViolationRow = {
      functionId,
      type: v.type,
      dimension: v.dimension,
      severity: v.severity,
      route: v.route,
      filePath,
      message,
    };
    const group = groups.get(functionId);
    if (group) group.push(row);
    else groups.set(functionId, [row]);
  }
  const violations = [...groups.values()].flatMap((g) => [...g].sort(compareViolations));

  const warnings: WarningRow[] = run.warnings
    .map((w) => ({ stage: r(w.stage), code: r(w.code), message: r(w.message) }))
    .sort((a, b) => compareStrings(a.stage, b.stage)
      || compareStrings(a.code, b.code)
      || compareStrings(a.message, b.message));

  const relProject = path.relative(path.resolve(repoRoot), path.resolve(report.projectPath));
  const projectPath = relProject.startsWith('..') || path.isAbsolute(relProject)
    ? r(report.projectPath)
    : relProject.split(path.sep).join('/');

  const um = report.universalMetrics;
  const snapshot: GoldenSnapshot = {
    caseId,
    projectPath,
    specVersion: report.specVersion,
    evaluationMode: report.evaluationMode,
    verdict: report.verdict,
    ahsDeterministic: Number(report.ahsDeterministic),
    perDimensionScores: report.perDimensionScores.map((s) => ({
      dimension: s.dimension,
      avr: Number(s.avr),
      weight: s.weight,
      violationCount: s.violationCount,
      functionCount: s.functionCount,
    })),
    universalMetrics: {
      cyclicDependencyCount: um.cyclicDependencyCount,
      maxFanOut: um.maxFanOut,
      maxFanIn: um.maxFanIn,
      abstractionRatio: um.abstractionRatio,
      averageInstability: um.averageInstability,
      orphanFileCount: um.orphanFileCount,
    },
    functionResults,
    unexecutedFunctionIds,
    violations,
    ...(truncatedFunctions.length > 0 && { truncatedFunctions }),
    warnings,
  };
  // Root replacement in every string, not only the path-bearing fields above.
  return mapStrings(snapshot, r) as GoldenSnapshot;
}

function mapStrings(value: unknown, f: (s: string) => string): unknown {
  if (typeof value === 'string') return f(value);
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, f));
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = mapStrings(v, f);
    }
    return out;
  }
  return value;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/** Sorted object keys (array order preserved), 2-space indent, trailing newline. */
export function serialiseSnapshot(s: GoldenSnapshot): string {
  return `${JSON.stringify(sortKeys(s), null, 2)}\n`;
}
