/**
 * SO2 metrics, pure functions (ADR-021 SO2; audit SO2-1..5, X-2, X-4; ADR-016 e; NFR-07; BR-U5b-49).
 *
 * - `ffS02Observation` / `universalCycleObservation`: the two cycle queries of the H13 gate, read from a report
 *   (FF-S02 `no-cyclic-deps` function row or failure; the `UNIVERSAL_CYCLE_STAGE` timing entry with its
 *   `METRIC_001` warning).
 * - `latencyGateOf`: the gate over one `RunRecord` of the latency-gate plan, rejected runs included. A cycle query
 *   that timed out (FF-S02 `EVAL_002`, or the cycle metric failed with a transaction timeout) or that took longer
 *   than `LATENCY_GATE_MS` gives `fallback-required` (ADR-016 e). A run whose cycle times cannot be read (no
 *   report, a non-timeout failure, a missing query) gives `inconclusive`: the gate is not decided by it, and the
 *   operator escalates. Timeouts of other functions are named in the cause but do not decide the gate: the Tarjan
 *   fallback replaces the cycle queries only (ADR-016 e).
 * - Row builders for `latency.csv`, `nfr07_latency.csv` (NFR-07 table), `graph_coverage.csv` (per-project graph
 *   size and the data-flow edge coverage metric, FLOWS_TO edges per resolved import), `flows_to_stores.csv`
 *   (FLOWS_TO store accounting from the extractor) and `apg_ablation.csv` (APG-full vs AST-only, per function).
 *
 * Every row is a string array; floats are written with `toFixed(6)` by the caller's `f6` (BR-U5b-63).
 */
import { EDGE_TYPES, NODE_TYPES } from '../../src/shared/types/enums.js';
import type { FlowsToStats } from '../../src/shared/types/apg.js';
import { LATENCY_GATE_MS, UNIVERSAL_CYCLE_STAGE } from '../run-experiment.js';
import type { RunRecord } from './report-io.js';

/** Template name of FF-S02 (`no-cyclic-deps`, U1 cypher-templates). */
export const FF_S02_TEMPLATE = 'no-cyclic-deps';
export const CYCLE_METRIC = 'cyclicDependencyCount';
/** Neo4j 5 transaction-timeout status codes contain this text (BR-U3-02). */
export const TIMEOUT_MARKER = 'TransactionTimedOut';
export const TIMEOUT_CODE = 'EVAL_002';
/** projectId suffix of the AST-only arm of an `apg-ablation` plan entry (the full arm has the bare projectId). */
export const AST_ONLY_SUFFIX = '@ast-only';
/** NFR-07 states the budget for public projects up to 300 files. */
export const NFR07_MAX_FILES = 300;

// ---------------------------------------------------------------------------------------------
// The report fields read here (a structural view; reports are parsed JSON)

export interface So2Report {
  readonly functionResults?: readonly {
    readonly functionId?: string; readonly name?: string; readonly dimension?: string;
    readonly violationCount?: number; readonly executionTimeMs?: number; readonly passed?: boolean;
  }[];
  readonly functionExecution?: { readonly failed?: readonly { readonly functionId?: string; readonly name?: string; readonly code?: string }[] };
  readonly timings?: { readonly stages?: readonly { readonly name: string; readonly durationMs: number; readonly status?: string }[]; readonly totalMs?: number };
  readonly warnings?: readonly { readonly code?: string; readonly context?: Readonly<Record<string, unknown>> }[];
  readonly parseCoverage?: { readonly total?: number; readonly percentage?: number };
  readonly importResolution?: { readonly resolvedInternal?: number };
  readonly graphStats?: {
    readonly nodeCount?: number; readonly edgeCount?: number; readonly layerCoverage?: number;
    readonly nodeCountByType?: Readonly<Record<string, number>>; readonly edgeCountByType?: Readonly<Record<string, number>>;
  };
  readonly violations?: readonly { readonly id?: string; readonly functionId?: string }[];
  readonly durationMs?: number;
}

// ---------------------------------------------------------------------------------------------
// Cycle query observations (ADR-016 e: both cycle queries)

export type CycleStatus = 'ok' | 'timeout' | 'failed' | 'absent';
export interface CycleObservation {
  readonly ms: number | null;
  readonly status: CycleStatus;
  readonly code?: string;
}

/** FF-S02: the `no-cyclic-deps` function row, or its failure (`EVAL_002` = timeout). */
export function ffS02Observation(report: So2Report): CycleObservation {
  const row = (report.functionResults ?? []).find((r) => r.name === FF_S02_TEMPLATE);
  if (row !== undefined && typeof row.executionTimeMs === 'number') return { ms: row.executionTimeMs, status: 'ok' };
  const failure = (report.functionExecution?.failed ?? []).find((f) => f.name === FF_S02_TEMPLATE);
  if (failure !== undefined) {
    const code = failure.code ?? 'unknown';
    return { ms: null, status: code === TIMEOUT_CODE ? 'timeout' : 'failed', code };
  }
  return { ms: null, status: 'absent' };
}

function cycleMetricFailureCode(report: So2Report): string | undefined {
  const w = (report.warnings ?? []).find((x) => x.code === 'METRIC_001' && x.context?.metric === CYCLE_METRIC);
  if (w === undefined) return undefined;
  const code = w.context?.code;
  return typeof code === 'string' ? code : 'unknown';
}

/**
 * The universal cycle metric: its `UNIVERSAL_CYCLE_STAGE` timing entry and, when it failed, the `METRIC_001`
 * code (a transaction timeout is `timeout`). A report written before the metric was timed has no entry: `absent`
 * (or `timeout` / `failed` from the warning alone, with no time).
 */
export function universalCycleObservation(report: So2Report): CycleObservation {
  const stage = (report.timings?.stages ?? []).find((s) => s.name === UNIVERSAL_CYCLE_STAGE);
  const code = cycleMetricFailureCode(report);
  const ms = stage === undefined ? null : stage.durationMs;
  if (code !== undefined || stage?.status === 'error') {
    const c = code ?? 'unknown';
    return { ms, status: c.includes(TIMEOUT_MARKER) ? 'timeout' : 'failed', code: c };
  }
  return stage === undefined ? { ms: null, status: 'absent' } : { ms, status: 'ok' };
}

// ---------------------------------------------------------------------------------------------
// The H13 gate over RunRecords (BR-U5b-49; ADR-016 e; audit SO2-1)

export type GateResult = 'pass' | 'fallback-required' | 'inconclusive';
export interface GateOutcome {
  readonly result: GateResult;
  readonly cause: string;
  readonly ffS02: CycleObservation;
  readonly universal: CycleObservation;
}

const ABSENT: CycleObservation = { ms: null, status: 'absent' };
const QUERY_LABEL = { ffS02: 'FF-S02', universal: 'universal cycle metric' } as const;

/** Function ids of timed-out functions other than FF-S02 (named in the cause, not deciding the gate). */
function otherTimeouts(report: So2Report): string[] {
  return (report.functionExecution?.failed ?? [])
    .filter((f) => f.code === TIMEOUT_CODE && f.name !== FF_S02_TEMPLATE)
    .map((f) => f.functionId ?? f.name ?? '?');
}

/**
 * The gate for one run (accepted or rejected). `report` is the stored report of the run, or `undefined` when the
 * run wrote none (transport error, CLI timeout, pre-registration refusal, not-run).
 */
export function latencyGateOf(record: Pick<RunRecord, 'status' | 'reasonCode' | 'reasonDetail'>, report: So2Report | undefined, budgetMs = LATENCY_GATE_MS): GateOutcome {
  if (report === undefined) {
    const why = record.reasonCode ?? record.status;
    return { result: 'inconclusive', cause: `no report (${record.status}${record.reasonCode !== undefined ? `, ${why}` : ''}): cycle query times unknown`, ffS02: ABSENT, universal: ABSENT };
  }
  const obs = { ffS02: ffS02Observation(report), universal: universalCycleObservation(report) };
  const others = otherTimeouts(report);
  const note = others.length > 0 ? `; other timeouts (not cycle queries): ${others.join(', ')}` : '';
  const keys = ['ffS02', 'universal'] as const;
  const fallback: string[] = [];
  for (const k of keys) {
    const o = obs[k];
    if (o.status === 'timeout') fallback.push(`${QUERY_LABEL[k]} timed out (${o.code ?? TIMEOUT_CODE})`);
    else if (o.ms !== null && o.ms > budgetMs) fallback.push(`${QUERY_LABEL[k]} ${String(o.ms)} ms > ${String(budgetMs)}`);
  }
  if (fallback.length > 0) return { result: 'fallback-required', cause: fallback.join('; ') + note, ...obs };
  const unknown = keys.filter((k) => obs[k].status === 'failed' || obs[k].status === 'absent')
    .map((k) => `${QUERY_LABEL[k]} ${obs[k].status}${obs[k].code !== undefined ? ` (${obs[k].code ?? ''})` : ''}`);
  if (unknown.length > 0) return { result: 'inconclusive', cause: unknown.join('; ') + note, ...obs };
  return { result: 'pass', cause: `both cycle queries within ${String(budgetMs)} ms${note}`, ...obs };
}

/**
 * The plan-level decision (ADR-016 e, applied mechanically): `fallback-required` when any run requires it, else
 * `inconclusive` when any run is inconclusive or there is no run, else `pass`.
 */
export function planGate(outcomes: readonly GateOutcome[]): GateResult {
  if (outcomes.some((o) => o.result === 'fallback-required')) return 'fallback-required';
  if (outcomes.length === 0 || outcomes.some((o) => o.result === 'inconclusive')) return 'inconclusive';
  return 'pass';
}

// ---------------------------------------------------------------------------------------------
// Rows

/** One run of a harness output directory: the record and its stored report (if any). */
export interface So2Run { readonly record: RunRecord; readonly report: So2Report | undefined }

/** The runs that wrote a report. */
function withReport(runs: readonly So2Run[]): { readonly record: RunRecord; readonly report: So2Report }[] {
  return runs.flatMap((r) => (r.report === undefined ? [] : [{ record: r.record, report: r.report }]));
}

const int = (x: number | null | undefined): string => (x === null || x === undefined ? '' : String(x));
const bool = (x: boolean | null | undefined): string => (x === null || x === undefined ? '' : String(x));

/** `name:ms` pairs of the report stages, `;`-joined, in report order. */
export function stageList(report: So2Report | undefined): string {
  return (report?.timings?.stages ?? []).map((s) => `${s.name}:${String(s.durationMs)}`).join(';');
}

export const LATENCY_COLUMNS = [
  'run_id', 'plan_id', 'project_id', 'status', 'reason_code', 'file_count', 'total_ms', 'stages', 'ff_s02_ms', 'ff_s02_status',
  'universal_cycle_ms', 'universal_cycle_status', 'budget_ms', 'gate_result', 'gate_cause',
] as const;

/** `latency.csv`: one row per RunRecord, rejected and not-run included (audit SO2-1, SO2-3). */
export function latencyRows(runs: readonly So2Run[], budgetMs = LATENCY_GATE_MS): string[][] {
  return runs.map(({ record, report }) => {
    const g = latencyGateOf(record, report, budgetMs);
    return [
      record.runId, record.planId, record.projectId, record.status, record.reasonCode ?? '', int(report?.parseCoverage?.total),
      int(report?.timings?.totalMs ?? report?.durationMs), stageList(report), int(g.ffS02.ms), g.ffS02.status,
      int(g.universal.ms), g.universal.status, int(budgetMs), g.result, g.cause,
    ];
  });
}

export const NFR07_COLUMNS = [
  'project_id', 'plan_id', 'run_id', 'status', 'file_count', 'in_nfr07_scope', 'node_count', 'edge_count', 'total_ms',
  'ff_s02_ms', 'universal_cycle_ms', 'max_cycle_query_ms', 'budget_ms', 'within_budget',
] as const;

/**
 * `nfr07_latency.csv`, the NFR-07 latency table: one row per run that wrote a report, sorted by project then
 * plan then run. `within_budget` is true only when both cycle queries were timed and neither exceeded the budget.
 * The AST-only arm of an `apg-ablation` run (`projectId` ending in `AST_ONLY_SUFFIX`) is not the product's graph
 * and is left out, so `--run-dir results/apg-ablation` contributes only its full-APG runs (B&T plan Step 25).
 */
export function nfr07Rows(runs: readonly So2Run[], budgetMs = LATENCY_GATE_MS): string[][] {
  const rows = withReport(runs).filter(({ record }) => !record.projectId.endsWith(AST_ONLY_SUFFIX)).map(({ record, report: rep }) => {
    const g = latencyGateOf(record, rep, budgetMs);
    const times = [g.ffS02.ms, g.universal.ms].filter((x): x is number => x !== null);
    const max = times.length === 0 ? null : Math.max(...times);
    const files = rep.parseCoverage?.total;
    const within = g.ffS02.status === 'ok' && g.universal.status === 'ok' && max !== null && max <= budgetMs;
    return [
      record.projectId, record.planId, record.runId, record.status, int(files), bool(files === undefined ? null : files <= NFR07_MAX_FILES),
      int(rep.graphStats?.nodeCount), int(rep.graphStats?.edgeCount), int(rep.timings?.totalMs ?? rep.durationMs),
      int(g.ffS02.ms), int(g.universal.ms), int(max), int(budgetMs), bool(within),
    ];
  });
  return rows.sort((a, b) => cmp(a[0] ?? '', b[0] ?? '') || cmp(a[1] ?? '', b[1] ?? '') || cmp(a[2] ?? '', b[2] ?? ''));
}

export const GRAPH_COVERAGE_COLUMNS = [
  'run_id', 'project_id', 'file_count', 'parse_coverage', 'node_count', 'edge_count', 'layer_coverage',
  ...NODE_TYPES.map((t) => `nodes_${t.toLowerCase()}`),
  ...EDGE_TYPES.map((t) => `edges_${t.toLowerCase()}`),
  'resolved_internal', 'flows_to_per_resolved_import',
] as const;

/** FLOWS_TO edges per resolved internal import statement; `null` when no import resolved (metric undefined). */
export function flowsToPerResolvedImport(flowsTo: number, resolvedInternal: number): number | null {
  return resolvedInternal === 0 ? null : flowsTo / resolvedInternal;
}

/**
 * `graph_coverage.csv` (audit SO2-4, X-4): per run with a report, the graph size by node and edge type and the
 * data-flow edge coverage metric. `f6` formats the two ratios.
 */
export function graphCoverageRows(runs: readonly So2Run[], f6: (x: number | null | undefined) => string): string[][] {
  return withReport(runs).map(({ record, report: rep }) => {
    const gs = rep.graphStats ?? {};
    const byNode = gs.nodeCountByType ?? {};
    const byEdge = gs.edgeCountByType ?? {};
    const resolved = rep.importResolution?.resolvedInternal;
    const flows = byEdge.FLOWS_TO ?? 0;
    const pc = rep.parseCoverage?.percentage;
    return [
      record.runId, record.projectId, int(rep.parseCoverage?.total), f6(pc === undefined ? null : pc / 100), int(gs.nodeCount), int(gs.edgeCount),
      f6(gs.layerCoverage), ...NODE_TYPES.map((t) => int(byNode[t] ?? 0)), ...EDGE_TYPES.map((t) => int(byEdge[t] ?? 0)),
      int(resolved), f6(resolved === undefined ? null : flowsToPerResolvedImport(flows, resolved)),
    ];
  });
}

export const FLOWS_TO_STORE_COLUMNS = [
  'project_id', 'stores', 'candidates', 'skipped_union_or_intersection', 'skipped_unextracted_target', 'skipped_self_loop',
  'flows_to_edges', 'flows_to_yield', 'resolved_internal', 'flows_to_per_resolved_import',
] as const;

/** `flows_to_stores.csv`: the extractor's FLOWS_TO store accounting per project (audit SO2-4). */
export function flowsToStoreRow(projectId: string, s: FlowsToStats, resolvedInternal: number, f6: (x: number | null | undefined) => string): string[] {
  return [
    projectId, int(s.stores), int(s.candidates), int(s.skippedUnionOrIntersection), int(s.skippedUnextractedTarget), int(s.skippedSelfLoop),
    int(s.edges), f6(s.candidates === 0 ? null : s.edges / s.candidates), int(resolvedInternal), f6(flowsToPerResolvedImport(s.edges, resolvedInternal)),
  ];
}

// ---------------------------------------------------------------------------------------------
// APG-full vs AST-only ablation (audit SO2-5, X-2)

export type AblationChange = 'same' | 'lost' | 'gained' | 'fewer' | 'more' | 'not-run';
export interface AblationRow {
  readonly projectId: string; readonly functionId: string; readonly name: string; readonly dimension: string;
  readonly violationsFull: number | null; readonly violationsAstOnly: number | null;
  readonly change: AblationChange; readonly lostIds: number; readonly gainedIds: number;
}

/** Detection change of one function from the full arm to the AST-only arm. */
export function ablationChange(full: number | null, ast: number | null): AblationChange {
  if (full === null || ast === null) return 'not-run';
  if (full > 0 && ast === 0) return 'lost';
  if (full === 0 && ast > 0) return 'gained';
  if (ast < full) return 'fewer';
  if (ast > full) return 'more';
  return 'same';
}

/** Pairs runs by base project: the full arm is `projectId`, the AST-only arm `projectId + AST_ONLY_SUFFIX`. */
export function ablationPairs(runs: readonly So2Run[]): { projectId: string; full?: So2Run; astOnly?: So2Run }[] {
  const pairs = new Map<string, { projectId: string; full?: So2Run; astOnly?: So2Run }>();
  for (const run of runs) {
    const id = run.record.projectId;
    const ast = id.endsWith(AST_ONLY_SUFFIX);
    const base = ast ? id.slice(0, -AST_ONLY_SUFFIX.length) : id;
    const slot = pairs.get(base) ?? { projectId: base };
    if (ast) slot.astOnly = run; else slot.full = run;
    pairs.set(base, slot);
  }
  return [...pairs.values()].sort((a, b) => cmp(a.projectId, b.projectId));
}

/**
 * Per function of each pair: violation counts in both arms, the detection change, and how many violation ids
 * the AST-only arm lost or gained. A function executed in one arm only (or a pair with a missing report) is
 * `not-run` with the missing count empty. Rows are sorted by project then function id.
 */
export function ablationRows(runs: readonly So2Run[]): AblationRow[] {
  const out: AblationRow[] = [];
  for (const pair of ablationPairs(runs)) {
    const f = pair.full?.report;
    const a = pair.astOnly?.report;
    const fnRows = new Map<string, { name: string; dimension: string; full: number | null; ast: number | null }>();
    const take = (rep: So2Report | undefined, arm: 'full' | 'ast'): void => {
      for (const r of rep?.functionResults ?? []) {
        const id = r.functionId ?? r.name ?? '?';
        const slot = fnRows.get(id) ?? { name: r.name ?? '', dimension: r.dimension ?? '', full: null, ast: null };
        slot[arm] = r.violationCount ?? 0;
        fnRows.set(id, slot);
      }
    };
    take(f, 'full');
    take(a, 'ast');
    const idsBy = (rep: So2Report | undefined, fn: string): Set<string> =>
      new Set((rep?.violations ?? []).filter((v) => v.functionId === fn).map((v) => v.id ?? ''));
    for (const [functionId, r] of [...fnRows].sort((x, y) => cmp(x[0], y[0]))) {
      const fullIds = idsBy(f, functionId);
      const astIds = idsBy(a, functionId);
      const both = r.full !== null && r.ast !== null;
      out.push({
        projectId: pair.projectId, functionId, name: r.name, dimension: r.dimension, violationsFull: r.full, violationsAstOnly: r.ast,
        change: ablationChange(r.full, r.ast),
        lostIds: both ? [...fullIds].filter((x) => !astIds.has(x)).length : 0,
        gainedIds: both ? [...astIds].filter((x) => !fullIds.has(x)).length : 0,
      });
    }
  }
  return out;
}

/** The parts of an extraction the arm check reads (an `APGResult` satisfies it). */
export interface ArmGraph {
  readonly edges: readonly { readonly type: string }[];
  readonly importResolution: { readonly resolvedInternal: number };
}

export const ARMS_COLUMNS = [
  'project_id', 'edges_full', 'edges_ast_only', 'edges_removed', ...EDGE_TYPES.map((t) => `removed_${t.toLowerCase()}`),
  'resolved_internal_full', 'resolved_internal_ast_only', 'arms_differ',
] as const;

/**
 * `apg_arms.csv` (ADR-021 item 8; audit SO2-5, X-2): the pre-run check that the two arms of one base differ, by
 * extraction only. Removed edges are counted per edge type; `arms_differ` is true when at least one edge is
 * removed. The resolved-internal counts must be equal (the allow-list does not ablate import resolution).
 */
export function armsRow(projectId: string, full: ArmGraph, ast: ArmGraph): string[] {
  const countBy = (g: ArmGraph): Map<string, number> => {
    const m = new Map<string, number>();
    for (const e of g.edges) m.set(e.type, (m.get(e.type) ?? 0) + 1);
    return m;
  };
  const f = countBy(full);
  const a = countBy(ast);
  const removed = full.edges.length - ast.edges.length;
  return [
    projectId, int(full.edges.length), int(ast.edges.length), int(removed), ...EDGE_TYPES.map((t) => int((f.get(t) ?? 0) - (a.get(t) ?? 0))),
    int(full.importResolution.resolvedInternal), int(ast.importResolution.resolvedInternal), bool(removed > 0),
  ];
}

export const ABLATION_COLUMNS = [
  'project_id', 'function_id', 'name', 'dimension', 'violations_full', 'violations_ast_only', 'detected_full', 'detected_ast_only',
  'change', 'lost_violation_ids', 'gained_violation_ids',
] as const;

export function ablationCsvRows(rows: readonly AblationRow[]): string[][] {
  return rows.map((r) => [
    r.projectId, r.functionId, r.name, r.dimension, int(r.violationsFull), int(r.violationsAstOnly),
    bool(r.violationsFull === null ? null : r.violationsFull > 0), bool(r.violationsAstOnly === null ? null : r.violationsAstOnly > 0),
    r.change, int(r.lostIds), int(r.gainedIds),
  ]);
}

export const ABLATION_SUMMARY_COLUMNS = [
  'project_id', 'functions_compared', 'detected_full', 'detected_ast_only', 'lost', 'gained', 'fewer', 'more', 'violations_full',
  'violations_ast_only', 'violation_delta',
] as const;

/** One summary row per project (functions run in both arms only). */
export function ablationSummaryRows(rows: readonly AblationRow[]): string[][] {
  const by = new Map<string, AblationRow[]>();
  for (const r of rows) by.set(r.projectId, [...(by.get(r.projectId) ?? []), r]);
  return [...by].sort((a, b) => cmp(a[0], b[0])).map(([projectId, rs]) => {
    const both = rs.filter((r) => r.change !== 'not-run');
    const sum = (xs: readonly (number | null)[]): number => xs.reduce<number>((a, b) => a + (b ?? 0), 0);
    const vf = sum(both.map((r) => r.violationsFull));
    const va = sum(both.map((r) => r.violationsAstOnly));
    const count = (c: AblationChange): string => String(both.filter((r) => r.change === c).length);
    return [
      projectId, String(both.length), String(both.filter((r) => (r.violationsFull ?? 0) > 0).length),
      String(both.filter((r) => (r.violationsAstOnly ?? 0) > 0).length), count('lost'), count('gained'), count('fewer'), count('more'),
      String(vf), String(va), String(va - vf),
    ];
  });
}

// ---------------------------------------------------------------------------------------------
// PROFILE capture (Step 23, Step 25; audit SO2-2, SO2-3) and SCC component sizes (BR-U1-28, 31)

/** One PROFILE execution of a cycle query through a direct driver session. */
export interface ProfileMeasurement {
  readonly availableMs: number | null;
  readonly consumedMs: number | null;
  readonly dbHits: number | null;
  readonly rows: number | null;
  readonly timedOut: boolean;
  readonly code?: string;
}

/** A Neo4j profiled plan node (the fields read here). */
export interface ProfiledPlanNode {
  readonly dbHits?: number;
  readonly rows?: number;
  readonly children?: readonly ProfiledPlanNode[];
}

/** Total db hits of a profiled plan tree. */
export function totalDbHits(node: ProfiledPlanNode | undefined): number | null {
  if (node === undefined) return null;
  return (node.dbHits ?? 0) + (node.children ?? []).reduce((sum, c) => sum + (totalDbHits(c) ?? 0), 0);
}

export const PROFILE_COLUMNS = [
  'project_id', 'query', 'repetition', 'warm_up', 'available_ms', 'consumed_ms', 'total_ms', 'db_hits', 'rows',
  'max_cycle_length', 'cycle_row_cap', 'truncated', 'timed_out', 'code',
] as const;

/**
 * `profile.csv` rows: repetition 0 is the warm-up (`warm_up` true), 1..n the measured repetitions. `truncated`
 * applies to FF-S02 only (more rows than `cycleRowCap`, the sentinel row of BR-U1-28); the metric returns one row.
 */
export function profileRows(
  projectId: string, query: 'ff-s02' | 'universal-cycle-metric', ms: readonly ProfileMeasurement[], maxCycleLength: number, cycleRowCap: number,
): string[][] {
  return ms.map((m, i) => [
    projectId, query, String(i), bool(i === 0), int(m.availableMs), int(m.consumedMs),
    int(m.availableMs === null || m.consumedMs === null ? null : m.availableMs + m.consumedMs), int(m.dbHits), int(m.rows),
    String(maxCycleLength), String(cycleRowCap), bool(query === 'ff-s02' && m.rows !== null ? m.rows > cycleRowCap : null),
    bool(m.timedOut), m.code ?? '',
  ]);
}

export const SCC_COLUMNS = ['project_id', 'component', 'size', 'exceeds_max_cycle_length', 'smallest_member'] as const;

/**
 * `scc_components.csv`: the file-level strongly connected components of size >= 2 (Tarjan). A component larger
 * than `maxCycleLength` files may contain a cycle the bounded query cannot see (threat 1, BR-U1-31).
 */
export function sccRows(projectId: string, components: readonly (readonly string[])[], maxCycleLength: number): string[][] {
  return components.map((c, i) => [projectId, String(i), String(c.length), bool(c.length > maxCycleLength), c[0] ?? '']);
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
