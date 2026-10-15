/**
 * ISE: directory units and their dependency structure.
 *
 * A unit is a candidate layer: a top-level directory under the source root (`src/domain/`), a child of a container
 * directory (`src/adapters/inbound/`), or a file directly under the source root (`src/main.ts`). Unit edges aggregate
 * the file import edges. Between two units the majority direction (by edge count) is taken as the observed rule; a
 * unit's level is the longest path to a sink over majority edges (sinks, which import no other unit, are level 0).
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
  /** Majority-direction edges (the minority direction of a pair dropped; ties keep both). */
  readonly majority: readonly UnitEdge[];
  /** Longest-path level to a sink over `majority` (members of a majority cycle share a level). */
  readonly level: ReadonlyMap<string, number>;
  /** Units that import at least one other unit and that no unit imports (composition-root candidates). */
  readonly roots: readonly string[];
}

/** `src/` when every file is under it, else '' (the project root). */
export function detectSourceRoot(files: readonly string[]): string {
  return files.length > 0 && files.every((f) => f.startsWith('src/')) ? 'src/' : '';
}

function dirsUnder(files: readonly string[], prefix: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const f of files) {
    if (!f.startsWith(prefix)) continue;
    const rest = f.slice(prefix.length);
    const i = rest.indexOf('/');
    const key = i < 0 ? rest : rest.slice(0, i + 1);
    const list = out.get(key) ?? [];
    list.push(f);
    out.set(key, list);
  }
  return out;
}

/**
 * Units of `files`. A top-level directory is split into its children when its token is a container token or
 * `split(dirId)` says so; files directly inside a split directory become one unit `<dir>` (kind dir) of their own.
 */
export function detectUnits(files: readonly string[], sourceRoot: string, split: (dirId: string) => boolean = () => false): Unit[] {
  const units: Unit[] = [];
  const add = (id: string, kind: Unit['kind'], fs: string[], directOnly = false): void => {
    const name = id.replace(/\/$/, '').split('/').pop() ?? id;
    units.push({ id, kind, token: normaliseToken(kind === 'file' ? name.replace(/\.[^.]+$/, '') : name), files: fs.sort(), directOnly });
  };
  for (const [key, fs] of [...dirsUnder(files, sourceRoot)].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const id = sourceRoot + key;
    if (!key.endsWith('/')) {
      add(id, 'file', fs);
      continue;
    }
    const children = dirsUnder(fs, id);
    const subdirs = [...children.keys()].filter((k) => k.endsWith('/'));
    const isContainer = CONTAINER_TOKENS.includes(normaliseToken(key.slice(0, -1))) || split(id);
    if (isContainer && subdirs.length >= 1) {
      const direct: string[] = [];
      for (const [ck, cfs] of children) {
        if (ck.endsWith('/')) add(id + ck, 'dir', cfs);
        else direct.push(...cfs);
      }
      if (direct.length > 0) add(id, 'dir', direct, true);
    } else add(id, 'dir', fs);
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

/** The unit structure of `graph` (see the file comment). */
export function unitStructure(graph: IseGraph, split?: (dirId: string) => boolean): UnitStructure {
  const sourceRoot = detectSourceRoot(graph.files);
  const units = detectUnits(graph.files, sourceRoot, split);
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
  const majority = edges.filter((e) => (counts.get(`${e.to}\n${e.from}`) ?? 0) <= e.count);
  const ids = units.map((u) => u.id);
  const level = levels(ids, majority);
  const hasIn = new Set(edges.map((e) => e.to));
  const hasOut = new Set(edges.map((e) => e.from));
  const roots = ids.filter((id) => hasOut.has(id) && !hasIn.has(id));
  return { sourceRoot, units, unitOf, edges, majority, level, roots };
}
