/**
 * Study 2 evasion check, A3 (s2d-01 §5.3, D13; design §2.5): architectural dependencies the blocking tier cannot see,
 * because one end sits where no rule's scope reaches.
 * - `unmappedFiles`: source files matching no layer, context or `outside_contexts` glob (= `unmatchedShare × files`).
 * - `outOfScopeEdges`: resolved import edges from an unmapped source into a placement on the target side of some
 *   guarded pair, plus edges from a placement on the source side of some guarded pair into an unmapped target.
 * - `declaredOutsideEdges`: such edges from an `outside_contexts` file (declared outside on purpose), counted apart.
 * Margin (a design proposal, author question Q2; not a registered figure): `flag` when the mean per-snapshot excess of
 * the treated arm over the reference arm, in new out-of-scope edges, is above one edge.
 */
import { mapPath } from './identity.js';
import type { RenameMap } from './identity.js';
import { OUTSIDE, UNMAPPED, cmp, isTestFile, placementOf } from './import-graph.js';
import type { GuardIndex, ImportGraph, PlacementModel, Tree } from './import-graph.js';
import { isSourceFile } from '../snapshot-measures.js';

export const OUT_OF_SCOPE_MARGIN = 1;

export interface OutOfScope {
  readonly sourceFiles: number;
  readonly unmappedFiles: number;
  /** null with no source file. */
  readonly unmappedShare: number | null;
  /** `S -> T (kind)`, sorted. */
  readonly outOfScopeEdges: readonly string[];
  readonly declaredOutsideEdges: number;
}

export function edgePairKey(from: string, to: string): string {
  return `${from} -> ${to}`;
}

/** A3 on one snapshot. Test files are left out (they are not architecture). */
export function outOfScope(tree: Tree, graph: ImportGraph, model: PlacementModel, guard: GuardIndex): OutOfScope {
  const sources = [...tree.files.keys()].filter((f) => isSourceFile(f) && !isTestFile(f)).sort(cmp);
  const place = new Map(sources.map((f) => [f, placementOf(model, f)]));
  const placeOf = (f: string): string => place.get(f) ?? placementOf(model, f);
  const unmapped = sources.filter((f) => placeOf(f) === UNMAPPED).length;
  const edges = new Set<string>();
  let declaredOutside = 0;
  for (const e of graph.edges) {
    if (isTestFile(e.from) || isTestFile(e.to)) continue;
    const ps = placeOf(e.from);
    const pt = placeOf(e.to);
    const hit = ((ps === UNMAPPED || ps === OUTSIDE) && guard.targets.has(pt)) || (pt === UNMAPPED && guard.sources.has(ps));
    if (!hit) continue;
    if (ps === OUTSIDE) declaredOutside++;
    else edges.add(`${edgePairKey(e.from, e.to)} (${e.kind})`);
  }
  return {
    sourceFiles: sources.length,
    unmappedFiles: unmapped,
    unmappedShare: sources.length === 0 ? null : Math.round((unmapped / sources.length) * 1e6) / 1e6,
    outOfScopeEdges: [...edges].sort(cmp),
    declaredOutsideEdges: declaredOutside,
  };
}

/** The file pair of an `outOfScopeEdges` entry (the kind suffix dropped). */
export function pairOf(entry: string): string {
  return entry.replace(/ \([a-zA-Z]+\)$/, '');
}

/**
 * Out-of-scope edges new at each snapshot, by file pair, against every earlier snapshot of the run; the earlier pairs
 * are mapped through each transition's ρ, so a rename does not make an edge new.
 */
export function newOutOfScopeEdges(snapshots: readonly { readonly edges: readonly string[]; readonly rho: RenameMap }[]): number[] {
  let seen = new Set<string>();
  const out: number[] = [];
  for (const s of snapshots) {
    if (s.rho.map.size > 0) {
      seen = new Set(
        [...seen].map((p) => {
          const [a, b] = p.split(' -> ') as [string, string];
          return edgePairKey(mapPath(a, s.rho), mapPath(b, s.rho));
        }),
      );
    }
    let fresh = 0;
    for (const e of new Set(s.edges.map(pairOf))) {
      if (!seen.has(e)) fresh++;
      seen.add(e);
    }
    out.push(fresh);
  }
  return out;
}
