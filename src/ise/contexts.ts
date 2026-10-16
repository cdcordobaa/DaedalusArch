/**
 * ISE: bounded contexts from structure, not from directory names (2026-10-15, after the rename probes).
 *
 * A bounded context shows in the graph as *repeated internal layering*: sibling top-level folders that each branch
 * into the same set of sub-folders (by name repetition across the siblings, whatever the names are) and whose
 * sub-folders depend on one another in the same direction in every sibling, while the siblings import each other far
 * less than they import inside themselves. A top-level folder is a context when it pairs up with at least one other
 * such folder (`pairs`):
 * - both branch (through a chain of single-child folders) into >= 2 sub-folders;
 * - the shared sub-folder names are at least half of the union (Jaccard >= `CONTEXT_MIN_JACCARD`), and >= 2;
 * - the majority directions between shared sub-folders never contradict each other, and at least one is common;
 * - edges between the two folders are a minority (< `CONTEXT_MAX_CROSS_SHARE`) of the edges touching them.
 * The prototype's vocabulary detection (a `domain` sub-folder plus another DDD layer name) is kept and united with it.
 *
 * For each context the layout gives the folder where it branches, its sub-folders with their level inside the
 * context (longest path over the majority edges between sub-folders only), its outer ring (sub-folders above level 0
 * that no other sub-folder imports), and the sub-folders that hold the domain
 * (named `domain`, else the level-0 sub-folder the siblings import most) and the application layer (named
 * `application`, else the level-1 sub-folder that imports the domain and that the other sub-folders import most).
 */
import type { IseGraph } from './graph-view.js';
import { childrenOf, detectSourceRoot, levels, singleChildChain } from './units.js';
import { STYLE_TOKENS, normaliseToken } from './vocabulary.js';

export const CONTEXT_MIN_JACCARD = 0.5;
export const CONTEXT_MAX_CROSS_SHARE = 0.4;

export interface ContextLayout {
  /** The context's top-level folder (`src/ordering/`). */
  readonly root: string;
  /** Where it branches into its sub-folders (`src/ordering/`, or `src/ordering/x/` below a single-child chain). */
  readonly layerRoot: string;
  /** Sub-folder ids (`src/ordering/domain/`), sorted. */
  readonly children: readonly string[];
  /** Level of each sub-folder inside the context (0 = imports no other sub-folder). */
  readonly level: ReadonlyMap<string, number>;
  /** Sub-folders at level >= 1 that no other sub-folder imports: the context's outer ring (adapters, api). */
  readonly outer: readonly string[];
  readonly domain: string | null;
  readonly application: string | null;
  /** How the context was found. */
  readonly via: 'structure' | 'vocabulary' | 'both';
}

export interface ContextDetection {
  readonly sourceRoot: string;
  readonly contexts: readonly ContextLayout[];
}

/** The prototype's vocabulary contexts: top-level directories with >= 2 DDD layer subdirectories including `domain`. */
export function boundedContexts(files: readonly string[], sourceRoot: string): string[] {
  const children = new Map<string, Set<string>>();
  for (const f of files) {
    const segs = f.slice(sourceRoot.length).split('/');
    if (segs.length < 3) continue;
    const [top = '', child = ''] = segs;
    const set = children.get(top) ?? new Set<string>();
    set.add(normaliseToken(child));
    children.set(top, set);
  }
  const layers: readonly string[] = STYLE_TOKENS.dddLayers;
  return [...children]
    .filter(([, c]) => c.has('domain') && [...c].filter((t) => layers.includes(t)).length >= 2)
    .map(([top]) => `${sourceRoot}${top}/`)
    .sort();
}

interface Candidate {
  readonly root: string;
  readonly layerRoot: string;
  readonly children: readonly string[];
  /** Child name (relative to layerRoot, no slash) -> child id. */
  readonly byName: ReadonlyMap<string, string>;
  /** Majority-direction edges between children, by child name (`a\nb`). */
  readonly directed: ReadonlySet<string>;
  readonly level: ReadonlyMap<string, number>;
  readonly internal: number;
  readonly counts: ReadonlyMap<string, number>;
  readonly outer: readonly string[];
}

function candidate(graph: IseGraph, root: string, strictChain: boolean): Candidate | undefined {
  const files = graph.files.filter((f) => f.startsWith(root));
  const chain = singleChildChain(files, root, strictChain);
  const layerRoot = chain[chain.length - 1] ?? root;
  const kids = [...childrenOf(files, layerRoot).dirs.keys()].sort();
  if (kids.length < 2) return undefined;
  const childOf = (f: string): string | undefined => kids.find((k) => f.startsWith(k));
  const counts = new Map<string, number>();
  let internal = 0;
  for (const e of graph.edges) {
    if (!e.from.startsWith(root) || !e.to.startsWith(root)) continue;
    internal += 1;
    const a = childOf(e.from);
    const b = childOf(e.to);
    if (a === undefined || b === undefined || a === b) continue;
    counts.set(`${a}\n${b}`, (counts.get(`${a}\n${b}`) ?? 0) + 1);
  }
  const majority = [...counts]
    .filter(([k, n]) => {
      const [a = '', b = ''] = k.split('\n');
      return (counts.get(`${b}\n${a}`) ?? 0) <= n;
    })
    .map(([k]) => {
      const [from = '', to = ''] = k.split('\n');
      return { from, to };
    });
  const name = (id: string): string => id.slice(layerRoot.length, -1);
  const level = levels(kids, majority);
  return {
    root,
    layerRoot,
    children: kids,
    byName: new Map(kids.map((k) => [name(k), k])),
    directed: new Set(majority.map((e) => `${name(e.from)}\n${name(e.to)}`)),
    level,
    internal,
    counts,
    outer: kids.filter((k) => (level.get(k) ?? 0) >= 1 && !majority.some((e) => e.to === k)),
  };
}

/** Whether two candidates repeat the same internal layering (see the file comment). */
function pairs(graph: IseGraph, a: Candidate, b: Candidate): boolean {
  const shared = [...a.byName.keys()].filter((n) => b.byName.has(n));
  const union = new Set([...a.byName.keys(), ...b.byName.keys()]);
  if (shared.length < 2 || shared.length / union.size < CONTEXT_MIN_JACCARD) return false;
  const sharedSet = new Set(shared);
  const restrict = (d: ReadonlySet<string>): string[] => [...d].filter((k) => k.split('\n').every((n) => sharedSet.has(n)));
  const da = restrict(a.directed);
  const db = restrict(b.directed);
  const flip = (k: string): string => k.split('\n').reverse().join('\n');
  // A contradiction: a -> b is the majority in one context and b -> a (only) in the other.
  if (da.some((k) => db.includes(flip(k)) && !db.includes(k)) || db.some((k) => da.includes(flip(k)) && !da.includes(k))) return false;
  if (!da.some((k) => db.includes(k))) return false;
  let cross = 0;
  for (const e of graph.edges) {
    if ((e.from.startsWith(a.root) && e.to.startsWith(b.root)) || (e.from.startsWith(b.root) && e.to.startsWith(a.root))) cross += 1;
  }
  const touching = cross + a.internal + b.internal;
  return touching > 0 && cross / touching < CONTEXT_MAX_CROSS_SHARE;
}

function roleChildren(c: Candidate): { domain: string | null; application: string | null } {
  const tokenOf = (id: string): string => normaliseToken(id.slice(c.layerRoot.length, -1));
  const fanIn = (to: string, except: readonly string[] = []): number =>
    [...c.counts].filter(([k]) => {
      const [from = '', t = ''] = k.split('\n');
      return t === to && !except.includes(from);
    }).reduce((s, [, n]) => s + n, 0);
  const best = (ids: readonly string[], score: (id: string) => number): string | null =>
    [...ids].sort((x, y) => score(y) - score(x) || (x < y ? -1 : 1)).find((id) => score(id) > 0) ?? null;
  const domain = c.children.find((k) => tokenOf(k) === 'domain') ?? best(c.children.filter((k) => (c.level.get(k) ?? 0) === 0), (k) => fanIn(k));
  const importsDomain = (k: string): boolean => domain !== null && (c.counts.get(`${k}\n${domain}`) ?? 0) > 0;
  const application =
    c.children.find((k) => tokenOf(k) === 'application') ??
    best(c.children.filter((k) => k !== domain && (c.level.get(k) ?? 0) === 1 && importsDomain(k)), (k) => fanIn(k, domain === null ? [] : [domain]) + 1);
  return { domain, application };
}

/** Contexts of `graph` by structure, united with the vocabulary contexts (see the file comment). */
export function detectContexts(graph: IseGraph): ContextDetection {
  const sourceRoot = detectSourceRoot(graph.files);
  const tops = [...childrenOf(graph.files, sourceRoot).dirs.keys()].sort();
  const cands = tops.map((t) => candidate(graph, t, false)).filter((c): c is Candidate => c !== undefined);
  const structural = new Set<string>();
  for (let i = 0; i < cands.length; i += 1) {
    for (let j = i + 1; j < cands.length; j += 1) {
      const a = cands[i];
      const b = cands[j];
      if (a !== undefined && b !== undefined && pairs(graph, a, b)) {
        structural.add(a.root);
        structural.add(b.root);
      }
    }
  }
  const vocabulary = new Set(boundedContexts(graph.files, sourceRoot));
  const contexts: ContextLayout[] = [];
  for (const root of [...new Set([...structural, ...vocabulary])].sort()) {
    const c = cands.find((x) => x.root === root) ?? candidate(graph, root, false);
    if (c === undefined) continue;
    contexts.push({
      root,
      layerRoot: c.layerRoot,
      children: c.children,
      level: c.level,
      outer: c.outer,
      ...roleChildren(c),
      via: structural.has(root) && vocabulary.has(root) ? 'both' : structural.has(root) ? 'structure' : 'vocabulary',
    });
  }
  return { sourceRoot, contexts };
}
