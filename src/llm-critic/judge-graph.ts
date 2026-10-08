import type { EXCERPT_EDGE_TYPES } from './frozen.js';

/**
 * Pure, in-memory view of the APG that the judge-unit selector and the graph excerpt read
 * (U4 plan Step 15; BR-U4-SEL-01, CTX-04). Neither ever takes a `GraphRepository`; the Cypher
 * reader that fills this view (`loadJudgeGraphView`) is added at Step 21.
 *
 * Node keys: a File or Package is keyed by its path (package name for a Package); a Class or
 * Interface by `${name}@${file}`. Edge endpoints use node keys. An endpoint that is no File,
 * Class or Interface of the view is a Package (external module).
 */

export type JudgeEdgeType = (typeof EXCERPT_EDGE_TYPES)[number];

export interface JudgeGraphFile {
  readonly path: string;            // root-relative POSIX
  readonly layer: string | null;    // null: unlayered (BR-U4-SEL-01 'unlayered')
  readonly isBarrel: boolean;       // U2 `File.isBarrel`
}

export interface JudgeGraphType {
  readonly name: string;
  readonly file: string;            // root-relative POSIX path of the declaring file
}

export interface JudgeGraphEdge {
  readonly type: JudgeEdgeType;
  readonly from: string;            // node key
  readonly to: string;              // node key
}

export interface JudgeGraphView {
  readonly files: readonly JudgeGraphFile[];          // sorted by path
  readonly classes: readonly JudgeGraphType[];        // sorted by file, then name
  readonly interfaces: readonly JudgeGraphType[];     // sorted by file, then name
  readonly edges: readonly JudgeGraphEdge[];          // sorted by type, from, to
}

/** Node key of a Class or Interface (DE §3.2). */
export function typeKey(entry: JudgeGraphType): string {
  return `${entry.name}@${entry.file}`;
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Returns a copy with every list in canonical order and duplicate edges removed. */
export function sortJudgeGraphView(view: JudgeGraphView): JudgeGraphView {
  const byFileName = (a: JudgeGraphType, b: JudgeGraphType): number =>
    compareStrings(a.file, b.file) || compareStrings(a.name, b.name);
  const edgeKey = (e: JudgeGraphEdge): string => `${e.type}\u0000${e.from}\u0000${e.to}`;
  const edges = new Map<string, JudgeGraphEdge>();
  for (const edge of view.edges) edges.set(edgeKey(edge), edge);
  return {
    files: [...view.files].sort((a, b) => compareStrings(a.path, b.path)),
    classes: [...view.classes].sort(byFileName),
    interfaces: [...view.interfaces].sort(byFileName),
    edges: [...edges.entries()].sort((a, b) => compareStrings(a[0], b[0])).map(([, e]) => e),
  };
}
