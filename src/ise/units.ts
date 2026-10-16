/**
 * ISE: directory units and their dependency structure.
 *
 * A unit is a candidate layer: a top-level directory under the source root (`src/domain/`), a child of a container
 * directory (`src/adapters/inbound/`), or a file directly under the source root (`src/main.ts`). Unit edges aggregate
 * the file import edges. Between two units the majority direction (by edge count) is taken as the observed rule; a
 * unit's level is the longest path to a sink over majority edges (sinks, which import no other unit, are level 0).
 *
 * Structure over vocabulary (2026-10-15, after the rename probes of the prototype):
 * - the source root descends through wrapper directories (`src/app/` when everything sits under it);
 * - a chain of single-child directories is looked through (`src/x/only/{a,b}` has the children `a` and `b`);
 * - a top-level directory is split into its children when it is a *structural container*: no files of its own and
 *   children that (almost) never import each other (`STRUCTURAL_CONTAINER_MAX_CROSS`), whatever their names are.
 *   The container vocabulary (`adapters`, `common`, ...) still splits as before.
 */
import type { IseGraph } from './graph-view.js';
import { CONTAINER_TOKENS, normaliseToken } from './vocabulary.js';

export interface Unit {
  /** `src/domain/` (directory) or `src/main.ts` (root file). */
  readonly id: string;
  readonly kind: 'dir' | 'file';
  /** Normalised token of the unit's own name (`domain`, `inbound`, `main`). */
  readonly token: string;
  readonly files: readonly string[];
  /** The directly contained files of a split directory only (glob `<id>*`, not `<id>**`). */
  readonly directOnly: boolean;
  /** For a child of a container directory (vocabulary or structural): the container's id. */
  readonly group?: string;
}

export interface UnitEdge {
  readonly from: string;
  readonly to: string;
  readonly count: number;
}

export interface UnitStructure {
  readonly sourceRoot: string;
  readonly units: readonly Unit[];
  readonly unitOf: ReadonlyMap<string, string>;
  /** All cross-unit edges with counts (both directions kept). */
  readonly edges: readonly UnitEdge[];
  /**
   * Majority-direction edges (the minority direction of a pair dropped; ties keep both), without lateral edges: an
   * edge between two children of the same container (`Unit.group`) is a sideways exception, not a layer order.
   */
  readonly majority: readonly UnitEdge[];
  /** Longest-path level to a sink over `majority` (members of a majority cycle share a level). */
  readonly level: ReadonlyMap<string, number>;
  /** Units that import at least one other unit and that no unit imports (composition-root candidates). */
  readonly roots: readonly string[];
}

/** Direct files and child directories (`<dir><name>/` -> files below it) of `dir` among `files`. */
export function childrenOf(files: readonly string[], dir: string): { direct: string[]; dirs: Map<string, string[]> } {
  const direct: string[] = [];
  const dirs = new Map<string, string[]>();
  for (const f of files) {
    if (!f.startsWith(dir)) continue;
    const rest = f.slice(dir.length);
    const i = rest.indexOf('/');
    if (i < 0) {
      direct.push(f);
      continue;
    }
    const key = dir + rest.slice(0, i + 1);
    dirs.set(key, [...(dirs.get(key) ?? []), f]);
  }
  return { direct, dirs };
}

/**
 * The directory below `dir` where it branches: descends while the directory has exactly one child directory (and, when
 * `strict`, no files of its own). Returns the chain from `dir` to that directory, both included.
 */
export function singleChildChain(files: readonly string[], dir: string, strict: boolean): string[] {
  const chain = [dir];
  for (;;) {
    const cur = chain[chain.length - 1] ?? dir;
    const { direct, dirs } = childrenOf(files, cur);
    if (dirs.size !== 1 || (strict && direct.length > 0)) return chain;
    chain.push([...dirs.keys()][0] ?? cur);
  }
}

/**
 * `src/` when every file is under it, else '' (the project root); then down through wrapper directories: while the
 * root holds no file of its own and exactly one directory, that directory is the root (`src/app/`).
 */
export function detectSourceRoot(files: readonly string[]): string {
  const base = files.length > 0 && files.every((f) => f.startsWith('src/')) ? 'src/' : '';
  if (files.length === 0) return base;
  const chain = singleChildChain(files, base, true);
  return chain[chain.length - 1] ?? base;
}

/** At most this share of a container's edges may run between two of its children (one stray import tolerated). */
export const STRUCTURAL_CONTAINER_MAX_CROSS = 0.1;

/**
 * A structural container: `dirId` (through its single-child chain) holds no file of its own and branches into >= 2
 * child directories that do not import each other: edges between two different children are at most
 * `STRUCTURAL_CONTAINER_MAX_CROSS` of all edges touching the children. Names play no part.
 */
export function isStructuralContainer(files: readonly string[], edges: readonly { from: string; to: string }[], dirId: string): boolean {
  const chain = singleChildChain(files, dirId, true);
  const end = chain[chain.length - 1] ?? dirId;
  const { direct, dirs } = childrenOf(files, end);
  if (direct.length > 0 || dirs.size < 2) return false;
  const childOf = (f: string): string | undefined => (f.startsWith(end) ? [...dirs.keys()].find((d) => f.startsWith(d)) : undefined);
  let cross = 0;
  let touching = 0;
  for (const e of edges) {
    const a = childOf(e.from);
    const b = childOf(e.to);
    if (a === undefined && b === undefined) continue;
    if (a === b) continue;
    touching += 1;
    if (a !== undefined && b !== undefined) cross += 1;
  }
  return cross === 0 || cross <= STRUCTURAL_CONTAINER_MAX_CROSS * touching;
}

/**
 * Units of `files`. A top-level directory is split into its children when its token is a container token, when
 * `split(dirId)` says so, or (given `edges`) when it is a structural container; the children are taken where the
 * directory first branches (`singleChildChain`), and the files directly inside a split directory (or a directory of
 * its chain) become one unit `<dir>` (kind dir, `directOnly`) of their own.
 */
export function detectUnits(
  files: readonly string[],
  sourceRoot: string,
  split: (dirId: string) => boolean = () => false,
  edges?: readonly { from: string; to: string }[],
): Unit[] {
  const units: Unit[] = [];
  const add = (id: string, kind: Unit['kind'], fs: string[], directOnly = false, group?: string): void => {
    const name = id.replace(/\/$/, '').split('/').pop() ?? id;
    units.push({ id, kind, token: normaliseToken(kind === 'file' ? name.replace(/\.[^.]+$/, '') : name), files: fs.sort(), directOnly, ...(group !== undefined ? { group } : {}) });
  };
  const top = childrenOf(files, sourceRoot);
  for (const f of top.direct) add(f, 'file', [f]);
  for (const [id, fs] of top.dirs) {
    const byName = CONTAINER_TOKENS.includes(normaliseToken(id.slice(sourceRoot.length, -1)));
    const structural = !byName && !split(id) && edges !== undefined && isStructuralContainer(fs, edges, id);
    if (!byName && !split(id) && !structural) {
      add(id, 'dir', fs);
      continue;
    }
    const chain = singleChildChain(fs, id, structural);
    const end = chain[chain.length - 1] ?? id;
    const branch = childrenOf(fs, end);
    if (branch.dirs.size < 1) {
      add(id, 'dir', fs);
      continue;
    }
    for (const [cid, cfs] of branch.dirs) add(cid, 'dir', cfs, false, byName || structural ? id : undefined);
    for (const d of chain) {
      const own = childrenOf(fs, d).direct;
      if (own.length > 0) add(d, 'dir', own, true);
    }
  }
  return units.sort((a, b) => (a.id < b.id ? -1 : 1));
}

function tarjan(nodes: readonly string[], succ: ReadonlyMap<string, readonly string[]>): string[][] {
  let index = 0;
  const idx = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const on = new Set<string>();
  const out: string[][] = [];
  const visit = (v: string): void => {
    idx.set(v, index);
    low.set(v, index);
    index += 1;
    stack.push(v);
    on.add(v);
    for (const w of succ.get(v) ?? []) {
      if (!idx.has(w)) {
        visit(w);
        low.set(v, Math.min(low.get(v) ?? 0, low.get(w) ?? 0));
      } else if (on.has(w)) low.set(v, Math.min(low.get(v) ?? 0, idx.get(w) ?? 0));
    }
    if (low.get(v) === idx.get(v)) {
      const comp: string[] = [];
      let w: string | undefined;
      do {
        w = stack.pop();
        if (w === undefined) break;
        on.delete(w);
        comp.push(w);
      } while (w !== v);
      out.push(comp);
    }
  };
  for (const v of nodes) if (!idx.has(v)) visit(v);
  return out;
}

/** Strongly connected components of a directed graph (Tarjan). */
export function stronglyConnected(nodes: readonly string[], edges: readonly { from: string; to: string }[]): string[][] {
  const succ = new Map<string, string[]>();
  for (const e of edges) succ.set(e.from, [...(succ.get(e.from) ?? []), e.to]);
  return tarjan(nodes, succ);
}

/** Longest-path level to a sink of each node, over the condensation of `edges`. */
export function levels(nodes: readonly string[], edges: readonly { from: string; to: string }[]): Map<string, number> {
  const comps = stronglyConnected(nodes, edges);
  const compOf = new Map<string, number>();
  comps.forEach((c, i) => { c.forEach((n) => compOf.set(n, i)); });
  const succ = new Map<number, Set<number>>();
  for (const e of edges) {
    const a = compOf.get(e.from);
    const b = compOf.get(e.to);
    if (a === undefined || b === undefined || a === b) continue;
    const s = succ.get(a) ?? new Set<number>();
    s.add(b);
    succ.set(a, s);
  }
  const memo = new Map<number, number>();
  const depth = (c: number): number => {
    const m = memo.get(c);
    if (m !== undefined) return m;
    let d = 0;
    for (const n of succ.get(c) ?? []) d = Math.max(d, depth(n) + 1);
    memo.set(c, d);
    return d;
  };
  const out = new Map<string, number>();
  for (const n of nodes) out.set(n, depth(compOf.get(n) ?? 0));
  return out;
}

/** An edge between two children of the same container. */
export function isLateral(groupOf: ReadonlyMap<string, string | undefined>, e: { from: string; to: string }): boolean {
  const g = groupOf.get(e.from);
  return g !== undefined && g === groupOf.get(e.to);
}

/** The unit structure of `graph` (see the file comment). */
export function unitStructure(graph: IseGraph, split?: (dirId: string) => boolean): UnitStructure {
  const sourceRoot = detectSourceRoot(graph.files);
  const units = detectUnits(graph.files, sourceRoot, split, graph.edges);
  const unitOf = new Map<string, string>();
  for (const u of units) for (const f of u.files) unitOf.set(f, u.id);
  const counts = new Map<string, number>();
  for (const e of graph.edges) {
    const a = unitOf.get(e.from);
    const b = unitOf.get(e.to);
    if (a === undefined || b === undefined || a === b) continue;
    counts.set(`${a}\n${b}`, (counts.get(`${a}\n${b}`) ?? 0) + 1);
  }
  const edges: UnitEdge[] = [...counts].map(([k, count]) => {
    const [from = '', to = ''] = k.split('\n');
    return { from, to, count };
  }).sort((x, y) => (x.from + x.to < y.from + y.to ? -1 : 1));
  const groupOf = new Map(units.map((u) => [u.id, u.group]));
  const majority = edges.filter((e) => (counts.get(`${e.to}\n${e.from}`) ?? 0) <= e.count && !isLateral(groupOf, e));
  const ids = units.map((u) => u.id);
  const level = levels(ids, majority);
  const hasIn = new Set(edges.map((e) => e.to));
  const hasOut = new Set(edges.map((e) => e.from));
  const roots = ids.filter((id) => hasOut.has(id) && !hasIn.has(id));
  return { sourceRoot, units, unitOf, edges, majority, level, roots };
}
