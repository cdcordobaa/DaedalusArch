/**
 * v1.3 APG v2 fixes-mined: the item model and the disappearance classification shared by
 * `scripts/v1.3/apg2-fixes-mined-run.ts` and `scripts/v1.3/apg2-fixes-mined-report.ts`
 * (Docs/DiagnosticRuns/v1.3-apg2-fixes-mined-2026-10-16.md). The classes extend those of `fixes-mined.ts`
 * (`classifyDisappearance`) to items that rest on a member, a file pair or a component instead of an import edge.
 */

/**
 * One APG v2 template row or cheap proxy flag at a snapshot.
 * - `edge`: rests on one file import edge (deep imports; the baseline edges);
 * - `member`: a member of a file (type leak, I/O, nondeterminism, member-level proxy flags);
 * - `pair`: two files not necessarily joined by an import (async coupling, two-ended proxy flags);
 * - `file`: a file-level proxy flag;
 * - `component`: a component or a component dependency (ADP, SDP, main-sequence distance).
 */
export interface MinedItem {
  readonly family: 'apg2' | 'cheap';
  readonly rule: string;
  readonly tier: 'blocking' | 'advisory';
  readonly shape: 'edge' | 'member' | 'pair' | 'file' | 'component';
  /** Identity across snapshots (rule and the named files, members, components; never a line). */
  readonly key: string;
  readonly files: string[];
  /** The file edge `s|t` the item names (deep import: the import; type leak: member file -> type file). */
  readonly edge?: string;
  /** `file#name` of the member or class the item names. */
  readonly member?: string;
  /** Components (`kind:name`) a component-level item names. */
  readonly components?: string[];
  /** Component dependency `kind:a>b` an ADP / SDP item rests on. */
  readonly componentDep?: string;
  /** Whether a file-level import graph shows the same relation; null when the question does not apply. */
  readonly importGraphSees: boolean | null;
  readonly message: string;
  readonly line?: number;
}

export type ItemCause =
  /** The import edge (or the component dependency) the item rests on is gone, every named file still in place. */
  | 'FIXED-BY-DEV'
  /** A member-, pair- or file-level item gone while every named file (or component) stays: resolved in place. */
  | 'RESOLVED-IN-PLACE'
  | 'RENAMED'
  | 'FILE-DELETED'
  /** A component the item names has no file at the child. */
  | 'COMPONENT-GONE'
  | 'MASS-OR-BOT'
  /** The edge or the component dependency is still there (an API declaration, an entry file or a metric changed). */
  | 'OTHER';

/** Causes credited to the developers (the fix rate's numerator). */
export const CREDITED: ReadonlySet<ItemCause> = new Set<ItemCause>(['FIXED-BY-DEV', 'RESOLVED-IN-PLACE']);

export interface ItemChild {
  readonly childFiles: ReadonlySet<string>;
  readonly childDeps: ReadonlySet<string>;
  readonly childImports: ReadonlySet<string>;
  readonly childComponents: ReadonlySet<string>;
  readonly childComponentDeps: ReadonlySet<string>;
  readonly renamedFrom: ReadonlySet<string>;
  readonly massOrBot: boolean;
}

/** Why an item present at the parent is absent at the child (first matching cause, in the order of `fixes-mined.ts`). */
export function classifyItem(it: MinedItem, c: ItemChild): ItemCause {
  if (it.files.some((f) => c.renamedFrom.has(f))) return 'RENAMED';
  if (it.files.some((f) => !c.childFiles.has(f))) return 'FILE-DELETED';
  if ((it.components ?? []).some((x) => !c.childComponents.has(x))) return 'COMPONENT-GONE';
  if (c.massOrBot) return 'MASS-OR-BOT';
  switch (it.shape) {
    case 'edge':
      return it.edge !== undefined && !c.childDeps.has(it.edge) ? 'FIXED-BY-DEV' : 'OTHER';
    case 'component':
      if (it.componentDep === undefined) return 'RESOLVED-IN-PLACE';
      return c.childComponentDeps.has(it.componentDep) ? 'OTHER' : 'FIXED-BY-DEV';
    default:
      return 'RESOLVED-IN-PLACE';
  }
}

/**
 * Whether dependency-cruiser (path-based rules over the file import graph, its `moreUnstable` metric and its cycle
 * check, its `reachable` rule) can express a rule at all. Expressible: deep imports (a path rule), component cycles and
 * SDP (folder cycles and `moreUnstable` over the same import graph), a vendor SDK imported outside the adapters (a
 * path-to-package rule) and an unreachable module (`reachable: false`). Not expressible: signature type flow, I/O and
 * nondeterminism by API, async channels, abstractness (main-sequence distance), and the other cheap proxies (bodies,
 * literals, names, call paths, communities over calls and injections).
 * The per-item test (`importGraphSees`) refines this for the rules where an import may or may not be present.
 */
export const DEPCRUISE_EXPRESSIBLE: ReadonlySet<string> = new Set([
  'deep-import-declared-api', 'deep-import-inferred-api', 'component-adp-cycle', 'component-sdp-violation',
  'sdk-spread/vendor-sdk-outside-adapters', 'reachability/unreachable-module',
]);

/**
 * An item is invisible to an import graph when its rule is not expressible over imports at all and, where the
 * per-item test applies, the import graph does not show the relation either (`importGraphSees === false`).
 */
export function importGraphInvisible(rule: string, importGraphSees: boolean | null): boolean {
  if (DEPCRUISE_EXPRESSIBLE.has(rule)) return false;
  return importGraphSees !== true;
}
