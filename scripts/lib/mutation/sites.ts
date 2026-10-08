/**
 * Site order, preconditions and sampling (FR-v1.2E-24; BR-U5a-11, 12, 13, 16, 27, 55).
 *
 * - **Stable order** (BR-U5a-11): sites sorted by `filePath` (code-unit order), then `line`, then the JSON of
 *   `detail` with sorted keys; `kind` breaks any remaining tie.
 * - **Preconditions** (BR-U5a-12), evaluated per candidate in this order, the first failure counted under its
 *   reason: the operator's own `checkPreconditions` (edge pre-exists, metric already violating, threshold
 *   arithmetic, site restrictions), the judge-probe placement (BR-U5a-27, the label-free exception of
 *   BR-U5a-06), then the cycle cap (BR-U5a-13: the operator's planned edges are added to the base graph `G` and
 *   the new simple cycles counted). The whole-operator style rule (BR-U5a-12 a) is decided by the pipeline before
 *   this pass.
 * - **Sampling** (BR-U5a-16): `mulberry32(selectSeed).pickDistinct(eligible, min(k, n))`, draw order kept.
 * - **Forced site** (BR-U5a-55): an override matches an eligible site when `filePath`, `detail` (sorted JSON) and,
 *   when given, `line` are equal.
 */
import { countSimpleCycles, cycleCapReached, newSimpleCycles } from './cycles.js';
import { mulberry32 } from './rng.js';
import type {
  ApplyOptions,
  ImportGraph,
  MutationOperator,
  MutationSite,
  ParsedSpec,
  PreconditionContext,
  PreconditionReason,
  PreconditionResult,
  PreparedBase,
  ProjectHandle,
} from './types.js';

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** JSON of a detail map with sorted keys. */
export function detailJson(detail: Readonly<Record<string, string>>): string {
  const sorted: Record<string, string> = {};
  for (const k of Object.keys(detail).sort(cmp)) sorted[k] = detail[k] ?? '';
  return JSON.stringify(sorted);
}

/** BR-U5a-11 order. */
export function compareSites(a: MutationSite, b: MutationSite): number {
  return cmp(a.filePath, b.filePath) || a.line - b.line || cmp(detailJson(a.detail), detailJson(b.detail)) || cmp(a.kind, b.kind);
}

/** Sorted copy, duplicates (same file, line, kind, detail) removed. */
export function sortSites(sites: readonly MutationSite[]): MutationSite[] {
  const sorted = [...sites].sort(compareSites);
  return sorted.filter((s, i) => {
    const prev = sorted[i - 1];
    return prev === undefined || compareSites(prev, s) !== 0;
  });
}

/** BR-U5a-55: does the override name this site? */
export function siteMatchesOverride(site: MutationSite, override: NonNullable<ApplyOptions['siteOverride']>): boolean {
  if (site.filePath !== override.filePath) return false;
  if (override.line !== undefined && site.line !== override.line) return false;
  return detailJson(site.detail) === detailJson(override.detail);
}

/** Template the judge probe of an operator reads its selection from (U4P Q12). */
export function probedTemplate(op: MutationOperator): 'intent-alignment' | 'architectural-integrity' | undefined {
  if (op.judgeProbe === 'semantic') return 'intent-alignment';
  if (op.judgeProbe === 'integrity') return 'architectural-integrity';
  return undefined;
}

/**
 * BR-U5a-27: a judge-probe site is eligible when the probed function's entry is uncapped, or every edited file
 * lies in a selected unit; a capped base without an entry for the probed function rejects every site.
 */
export function judgePlacement(op: MutationOperator, site: MutationSite, base: PreparedBase): PreconditionResult {
  const template = probedTemplate(op);
  if (template === undefined) return { ok: true };
  const entry = base.judgeSelection?.find((s) => s.template === template);
  if (entry === undefined) return base.capped ? { ok: false, reason: 'judge-unit-not-selected' } : { ok: true };
  if (!entry.capped) return { ok: true };
  const files = op.plannedFiles?.(site) ?? [site.filePath];
  return files.every((f) => entry.selectedFiles.includes(f)) ? { ok: true } : { ok: false, reason: 'judge-unit-not-selected' };
}

/** `g` plus planned File→File edges (as `IMPORTS`, line 1), for the cycle-cap simulation. */
export function withPlannedEdges(g: ImportGraph, planned: readonly { readonly source: string; readonly target: string }[]): ImportGraph {
  const extra = planned
    .filter((p) => !g.edges.some((e) => e.source === p.source && e.target === p.target))
    .map((p) => ({ source: p.source, target: p.target, type: 'IMPORTS' as const, isTypeOnly: false, line: 1 }));
  return { files: g.files, edges: [...g.edges, ...extra] };
}

/** BR-U5a-13 cap precondition on the planned edges. */
export function cycleCap(op: MutationOperator, site: MutationSite, ctx: PreconditionContext): PreconditionResult {
  if (ctx.baseCycleCount >= ctx.cycleRowCap) return { ok: false, reason: 'cycle-cap' };
  const planned = op.plannedEdges(site);
  if (planned.length === 0) return { ok: true };
  const created = newSimpleCycles(ctx.baseGraph, withPlannedEdges(ctx.baseGraph, planned), ctx.maxCycleLength, ctx.cycleRowCap);
  return cycleCapReached(ctx.baseCycleCount, created.length, ctx.cycleRowCap) ? { ok: false, reason: 'cycle-cap' } : { ok: true };
}

/** Base simple-cycle count, counted up to `cap + 1`. */
export function baseCycleCount(g: ImportGraph, maxLength: number, cap: number): number {
  return countSimpleCycles(g, maxLength, cap + 1);
}

export interface EligibleSite {
  readonly site: MutationSite;
  /** Position in the stable candidate list. */
  readonly siteIndex: number;
}

export interface PreconditionTally {
  readonly candidates: readonly MutationSite[];
  readonly eligible: readonly EligibleSite[];
  readonly rejectedByReason: Readonly<Partial<Record<PreconditionReason, number>>>;
}

/** BR-U5a-12: filters the sorted candidates; rejected candidates are counted per reason. */
export function evaluatePreconditions(
  op: MutationOperator,
  handle: ProjectHandle,
  spec: ParsedSpec,
  candidates: readonly MutationSite[],
  ctx: PreconditionContext,
): PreconditionTally {
  const eligible: EligibleSite[] = [];
  const rejected: Partial<Record<PreconditionReason, number>> = {};
  candidates.forEach((site, siteIndex) => {
    const checks: (() => PreconditionResult)[] = [
      () => op.checkPreconditions(handle, spec, site, ctx),
      () => judgePlacement(op, site, ctx.base),
      () => cycleCap(op, site, ctx),
    ];
    for (const check of checks) {
      const r = check();
      if (!r.ok) {
        rejected[r.reason] = (rejected[r.reason] ?? 0) + 1;
        return;
      }
    }
    eligible.push({ site, siteIndex });
  });
  return { candidates, eligible, rejectedByReason: rejected };
}

/** BR-U5a-16: the ordered sample of `min(k, n)` eligible sites. */
export function sampleSites(eligible: readonly EligibleSite[], sitesPerOperator: number, selectSeed: number): readonly EligibleSite[] {
  return mulberry32(selectSeed).pickDistinct(eligible, Math.min(sitesPerOperator, eligible.length));
}
