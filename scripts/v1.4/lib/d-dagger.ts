/**
 * Study 2b D† (pre-registration `Docs/v1.4/study2b-preregistration.md` §1 and §4, Fable review finding 2): the pure
 * part. D† counts new distinct presentation → persistence import edges at steps 2..5, from ANY file, with no
 * composition-root exemption (Q25 = B is not applied), under the same identity rule as D (`driftRun`, `STUDY2_S2D01`:
 * edge grain, ρ from `git diff -M50%`, renames continue). The edges are the FF-S03 opportunity edges of
 * `scripts/v1.4/lib/exposure.ts` (the rule's compiled Cypher with its violation predicate deleted), run with the
 * `excludePatterns` parameter emptied, and kept when the source layer is presentation and the target persistence.
 *
 * Also the evasion bar's inputs (finding 2, item 2): per snapshot, which of those edges leave a Q25-exempt file, and
 * per run, the ρ-mapped renames of a non-exempt file to an exempt name.
 */
import { fromProbeFinding } from '../../lib/drift/identity.js';
import type { IdFinding, RenameMap } from '../../lib/drift/types.js';

/** The two layers whose direct edge FF-S03 forbids in Layered (presentation > business > persistence). */
export const DAGGER_SOURCE_LAYER = 'presentation';
export const DAGGER_TARGET_LAYER = 'persistence';
/** The rule id the D† identities carry, so the edge key is FF-S03's. */
export const DAGGER_RULE = 'FF-S03';

export interface OpportunityRow {
  readonly source: string;
  readonly target: string;
  readonly srcLayer?: unknown;
  readonly tgtLayer?: unknown;
  readonly relType?: unknown;
}

export interface DaggerEdge {
  readonly source: string;
  readonly target: string;
  /** The source file matches a Q25 = B composition-root glob (`CONSTRUCT_COMPOSITION_ROOT_GLOBS`). */
  readonly exemptSource: boolean;
}

/** Distinct presentation → persistence (source, target) pairs of the opportunity rows, sorted. */
export function daggerEdges(rows: readonly OpportunityRow[], isExempt: (file: string) => boolean): DaggerEdge[] {
  const seen = new Map<string, DaggerEdge>();
  for (const r of rows) {
    if (r.srcLayer !== DAGGER_SOURCE_LAYER || r.tgtLayer !== DAGGER_TARGET_LAYER) continue;
    const k = `${r.source}\u0000${r.target}`;
    if (!seen.has(k)) seen.set(k, { source: r.source, target: r.target, exemptSource: isExempt(r.source) });
  }
  return [...seen.values()].sort((a, b) => (a.source === b.source ? (a.target < b.target ? -1 : 1) : a.source < b.source ? -1 : 1));
}

/** The D† identities of a snapshot: one FF-S03 finding per edge (exempt or not). */
export function daggerFindings(edges: readonly DaggerEdge[]): IdFinding[] {
  return edges.map((e) => fromProbeFinding({ rule: DAGGER_RULE, file: e.source, target: e.target }));
}

/** ρ entries that move a non-exempt file to an exempt name (the rename class of the moved-only read, finding 2 item 4). */
export function renamesToExempt(rho: RenameMap | undefined, isExempt: (file: string) => boolean): { readonly from: string; readonly to: string }[] {
  if (rho === undefined) return [];
  return [...rho].filter(([from, to]) => !isExempt(from) && isExempt(to)).map(([from, to]) => ({ from, to })).sort((a, b) => (a.from < b.from ? -1 : 1));
}

/** Per run: the new D† edges of steps 2..k (first appearance, ρ not applied: a descriptive read of where they sit). */
export function newEdgesByStep(steps: readonly { readonly step: number; readonly edges: readonly DaggerEdge[] }[]): { readonly step: number; readonly edge: DaggerEdge }[] {
  const seen = new Set<string>();
  const out: { step: number; edge: DaggerEdge }[] = [];
  for (const s of [...steps].sort((a, b) => a.step - b.step)) {
    for (const e of s.edges) {
      const k = `${e.source}\u0000${e.target}`;
      if (!seen.has(k) && s.step >= 2) out.push({ step: s.step, edge: e });
      seen.add(k);
    }
  }
  return out;
}

export interface RunEvasion {
  /** Presentation → persistence edges at the last step, and how many leave an exempt file. */
  readonly lastStepEdges: number;
  readonly lastStepExempt: number;
  /** Renames of a non-exempt file to an exempt name, over steps 2..k. */
  readonly renamesToExempt: number;
}

export interface CellEvasion {
  readonly cell: string;
  readonly runs: number;
  readonly lastStepEdges: number;
  readonly lastStepExempt: number;
  /** lastStepExempt / lastStepEdges; null when the cell has no such edge (reported as such). */
  readonly exemptShare: number | null;
  /** Runs with ≥ 1 rename of a non-exempt file to an exempt name, and their share. */
  readonly runsWithRenameToExempt: number;
  readonly renameShare: number;
}

export function cellEvasion(cell: string, runs: readonly RunEvasion[]): CellEvasion {
  const edges = runs.reduce((a, r) => a + r.lastStepEdges, 0);
  const exempt = runs.reduce((a, r) => a + r.lastStepExempt, 0);
  const withRename = runs.filter((r) => r.renamesToExempt > 0).length;
  return {
    cell, runs: runs.length, lastStepEdges: edges, lastStepExempt: exempt,
    exemptShare: edges === 0 ? null : exempt / edges,
    runsWithRenameToExempt: withRename, renameShare: runs.length === 0 ? 0 : withRename / runs.length,
  };
}

/** The registered evasion bar (finding 2 item 2): a contrast is flagged when either share differs by more than 0.20. */
export const EVASION_BAR = 0.2;
export function evasionFlag(a: CellEvasion, b: CellEvasion, bar = EVASION_BAR): { readonly exemptShareDiff: number | null; readonly renameShareDiff: number; readonly flagged: boolean } {
  const exemptShareDiff = a.exemptShare === null && b.exemptShare === null ? null : Math.abs((a.exemptShare ?? 0) - (b.exemptShare ?? 0));
  const renameShareDiff = Math.abs(a.renameShare - b.renameShare);
  return { exemptShareDiff, renameShareDiff, flagged: (exemptShareDiff ?? 0) > bar || renameShareDiff > bar };
}
