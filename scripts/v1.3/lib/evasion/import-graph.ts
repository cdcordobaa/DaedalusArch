/**
 * Study 2 evasion check (M6): source trees, their import graph, file placements and the spec-derived guarded pairs
 * (design §2.2, §2.4; `Docs/v1.4/evasion-check.md`).
 *
 * - A tree is the `src/**\/*.ts` files of a snapshot (tree-relative `src/...` paths). Test files are kept and marked.
 * - The graph reuses `scanImports` and `resolveRelative` of `scripts/v1.3/lib/snapshot-measures.ts`: each relative
 *   specifier is resolved (`.js` dropped, then `x`, `x.ts`, `x.d.ts`, `x/index.ts`) or counted as unresolved, never
 *   guessed (EV-08). A non-relative specifier is external (the pinned harness tsconfig has no `paths` alias).
 * - A file's placement is its layer (`resolveLayer`), for DDD prefixed with its context (`<context>/<layer>`), or
 *   `outside` (a DDD `outside_contexts` glob), or `unmapped`.
 * - Guarded pairs come from the spec and the blocking tier only (EV-06a), never from run data. Layer lists (Layered,
 *   Clean): FF-S01 guards an import from a lower-listed layer into a higher one; FF-S03 guards a skip of more than one
 *   step down, and it is blocking for `layered` only. Hexagonal and DDD: FF-S01 guards every layer pair not in
 *   `allowedDependencies`; DDD adds FF-DS02 on every cross-context pair (the public API and ACL exemptions are not
 *   modelled: the heuristic over-approximates there).
 *
 * Reading a commit uses local git only (`git archive <commit> -- src` into a scratch directory). Everything else is
 * pure.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import picomatch from 'picomatch';
import { normalisePath, resolveLayer } from '../../../../src/mcp-server/layer-resolver.js';
import type { ParsedSpec } from '../../../../src/shared/types/spec.js';
import type { BlockingFinding } from '../../../lib/loop/types.js';
import { isSourceFile, resolveRelative, scanImports } from '../snapshot-measures.js';
import type { ImportKind } from '../snapshot-measures.js';

// ── Trees ────────────────────────────────────────────────────────────────────────────────

export interface Tree {
  /** `src/...` path → text; every `.ts` file under `src/` (tests and `.d.ts` included). */
  readonly files: ReadonlyMap<string, string>;
}

/** Test files: `*.test.ts`, `*.spec.ts`, or any `__tests__/` or `test/` segment (REV-03 finding 5). */
export function isTestFile(p: string): boolean {
  if (/\.(test|spec)\.ts$/.test(p)) return true;
  return p.split('/').slice(0, -1).some((s) => s === '__tests__' || s === 'test' || s === 'tests');
}

function walk(root: string, rel: string, out: Map<string, string>): void {
  const abs = path.join(root, ...rel.split('/'));
  let names: string[];
  try {
    names = fs.readdirSync(abs).sort();
  } catch {
    return;
  }
  for (const name of names) {
    const childRel = `${rel}/${name}`;
    const st = fs.lstatSync(path.join(abs, name));
    if (st.isDirectory()) walk(root, childRel, out);
    else if (st.isFile() && name.endsWith('.ts')) out.set(childRel, fs.readFileSync(path.join(abs, name), 'utf8'));
  }
}

/** The `src/**\/*.ts` files of a directory tree. */
export function readTreeDir(dir: string): Tree {
  const files = new Map<string, string>();
  walk(dir, 'src', files);
  return { files };
}

const GIT_ENV = (): NodeJS.ProcessEnv => ({ PATH: process.env.PATH ?? '', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', LC_ALL: 'C' });

/** Only `src/` of a commit of a run's store, extracted into `scratch` (created and removed here). */
export function readTreeCommit(gitDir: string, commit: string, scratch: string): Tree {
  const ls = spawnSync('git', [`--git-dir=${gitDir}`, 'ls-tree', '--name-only', commit, 'src'], { encoding: 'utf8', env: GIT_ENV() });
  if (ls.error !== undefined || ls.status !== 0) throw new Error(`git ls-tree ${commit} failed: ${ls.error?.message ?? ls.stderr.trim()}`);
  if (ls.stdout.trim() === '') return { files: new Map() };
  fs.mkdirSync(scratch, { recursive: true });
  try {
    const archive = spawnSync('git', [`--git-dir=${gitDir}`, 'archive', '--format=tar', commit, '--', 'src'], { env: GIT_ENV(), maxBuffer: 256 * 1024 * 1024 });
    if (archive.status !== 0) throw new Error(`git archive ${commit} failed: ${archive.stderr.toString()}`);
    const tar = spawnSync('tar', ['-x', '-C', scratch], { input: archive.stdout });
    if (tar.status !== 0) throw new Error(`tar failed: ${tar.stderr.toString()}`);
    return readTreeDir(scratch);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

// ── Import graph ─────────────────────────────────────────────────────────────────────────

export interface ImportEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: ImportKind;
}

export interface ImportGraph {
  readonly edges: readonly ImportEdge[];
  /** `from` → its edges. */
  readonly out: ReadonlyMap<string, readonly ImportEdge[]>;
  /** Relative specifiers that resolve to no tree file (counted, never guessed: EV-08). */
  readonly unresolved: number;
  readonly barrels: readonly string[];
}

export function buildGraph(tree: Tree): ImportGraph {
  const names = new Set(tree.files.keys());
  const edges: ImportEdge[] = [];
  const out = new Map<string, ImportEdge[]>();
  const barrels: string[] = [];
  let unresolved = 0;
  for (const [file, text] of [...tree.files].sort((a, b) => cmp(a[0], b[0]))) {
    if (!isSourceFile(file)) continue;
    const scanned = scanImports(file, text);
    if (scanned.barrel) barrels.push(file);
    for (const imp of scanned.imports) {
      if (!imp.specifier.startsWith('.')) continue;
      const to = resolveRelative(file, imp.specifier, names);
      if (to === undefined) {
        unresolved++;
        continue;
      }
      const e: ImportEdge = { from: file, to, kind: imp.kind };
      edges.push(e);
      const list = out.get(file) ?? [];
      list.push(e);
      out.set(file, list);
    }
  }
  return { edges, out, unresolved, barrels };
}

/** Kinds by which `from` imports `to` directly. */
export function edgeKindsBetween(g: ImportGraph, from: string, to: string): ImportKind[] {
  return (g.out.get(from) ?? []).filter((e) => e.to === to).map((e) => e.kind);
}

const STATIC_KINDS: ReadonlySet<ImportKind> = new Set(['static', 'typeOnly', 'reexport']);

/** A static edge (import, type import or re-export) from `from` to `to`. */
export function hasStaticEdge(g: ImportGraph, from: string, to: string): boolean {
  return edgeKindsBetween(g, from, to).some((k) => STATIC_KINDS.has(k));
}

export function hasAnyEdge(g: ImportGraph, from: string, to: string): boolean {
  return edgeKindsBetween(g, from, to).length > 0;
}

// ── Endpoints ────────────────────────────────────────────────────────────────────────────

/** A path as a tree path (`src/...`), or null when the tree has no such file. */
export function treePathOf(p: string, files: ReadonlySet<string> | ReadonlyMap<string, string>): string | null {
  const n = normalisePath(p);
  for (const c of [n, `src/${n}`, `${n}.ts`, `src/${n}.ts`, `${n}/index.ts`]) if (files.has(c)) return c;
  return null;
}

export interface Endpoints {
  /** Null: unresolved. */
  readonly source: string | null;
  /** `edgeless`: the finding has no target (a file-level rule); null: unresolved. */
  readonly target: string | null | 'edgeless';
}

/** A finding's `filePath` and `target` as tree paths of `tree` (a raw import specifier is resolved from `filePath`). */
export function endpoints(f: BlockingFinding, tree: Tree): Endpoints {
  const files = tree.files;
  const first = f.filePath.split(',')[0] ?? f.filePath;
  const source = treePathOf(first, files);
  if (f.target === undefined || f.target === '') return { source, target: 'edgeless' };
  if (f.target.startsWith('.')) {
    const target = source === null ? null : (resolveRelative(source, f.target, new Set(files.keys())) ?? null);
    return { source, target };
  }
  return { source, target: treePathOf(f.target, files) };
}

/** True for a cycle finding (the pilot memo's test: a template or rule name that says `cycl`). */
export function isCycleFinding(f: BlockingFinding): boolean {
  return /cycl/i.test(f.template ?? '') || /cycl/i.test(f.ruleName);
}

/** The member files of a cycle finding that the tree has (file list of `filePath`, plus `target`). */
export function cycleMembers(f: BlockingFinding, tree: Tree): string[] {
  const raw = [...f.filePath.split(','), ...(f.target !== undefined && f.target !== '' ? f.target.split(/\s*>\s*|,/) : [])];
  const out = new Set<string>();
  for (const r of raw) {
    const p = treePathOf(r.trim(), tree.files);
    if (p !== null) out.add(p);
  }
  return [...out].sort(cmp);
}

/** The finding with its endpoints normalised to tree paths (unresolved ones left raw); identities use this form. */
export function normaliseFinding(f: BlockingFinding, tree: Tree): BlockingFinding {
  if (isCycleFinding(f)) {
    const m = cycleMembers(f, tree);
    return m.length >= 2 ? { ...f, filePath: m.join(','), target: '' } : f;
  }
  const e = endpoints(f, tree);
  return {
    ...f,
    filePath: e.source ?? f.filePath,
    ...(e.target !== 'edgeless' && f.target !== undefined ? { target: e.target ?? f.target } : {}),
  };
}

// ── Placements ───────────────────────────────────────────────────────────────────────────

export type SpecStyle = 'layered' | 'clean' | 'hexagonal' | 'ddd';

export interface PlacementModel {
  readonly style: SpecStyle;
  readonly spec: ParsedSpec;
  /** Layer names in spec order. */
  readonly layers: readonly string[];
  readonly allowed: ReadonlyMap<string, ReadonlySet<string>>;
  readonly contexts: readonly { readonly name: string; readonly root: string }[];
  readonly outside: readonly ((p: string) => boolean)[];
}

export const UNMAPPED = 'unmapped';
export const OUTSIDE = 'outside';

export function specStyle(spec: ParsedSpec): SpecStyle {
  const s = spec.style ?? '';
  if (s === 'layered') return 'layered';
  if (s === 'ddd' || spec.layerModel.ddd !== undefined) return 'ddd';
  if (s === 'hexagonal' || spec.layerModel.allowedDependencies !== undefined) return 'hexagonal';
  return 'clean';
}

export function placementModel(spec: ParsedSpec): PlacementModel {
  const allowed = new Map<string, Set<string>>();
  for (const e of spec.layerModel.allowedDependencies ?? []) {
    const s = allowed.get(e.from) ?? new Set<string>();
    s.add(e.to);
    allowed.set(e.from, s);
  }
  const ddd = spec.layerModel.ddd;
  return {
    style: specStyle(spec),
    spec,
    layers: spec.layerModel.layers.map((l) => l.name),
    allowed,
    contexts: (ddd?.contexts ?? []).map((c) => ({ name: c.name, root: c.root })),
    outside: (ddd?.outsideContexts ?? []).map((g) => picomatch(g, { dot: true })),
  };
}

/** `<layer>`, `<context>/<layer>` (DDD; `-` when no layer matches inside a context), `outside` or `unmapped`. */
export function placementOf(m: PlacementModel, file: string): string {
  const layer = resolveLayer(m.spec, file)?.layer;
  const ctx = m.contexts.find((c) => file.startsWith(c.root));
  if (ctx !== undefined) return `${ctx.name}/${layer ?? '-'}`;
  if (layer !== undefined) return layer;
  if (m.outside.some((t) => t(file))) return OUTSIDE;
  return UNMAPPED;
}

function splitPlacement(p: string): { readonly ctx: string | null; readonly layer: string | null } {
  if (p === UNMAPPED || p === OUTSIDE) return { ctx: null, layer: null };
  const i = p.indexOf('/');
  if (i < 0) return { ctx: null, layer: p };
  const layer = p.slice(i + 1);
  return { ctx: p.slice(0, i), layer: layer === '-' ? null : layer };
}

// ── Tiers and guarded pairs ──────────────────────────────────────────────────────────────

export type TierEntry = 'blocking' | 'advisory' | 'blocking-layered-only';

/** The `| FF-… |` rows of the committed tier table (`Docs/v1.3/rule-tiers.md`, or the post-seal v1.4 table). */
export function parseTierTable(md: string): Map<string, TierEntry> {
  const out = new Map<string, TierEntry>();
  for (const line of md.split('\n')) {
    const cols = line.split('|').map((c) => c.trim());
    const id = cols[1] ?? '';
    if (!/^FF-[A-Z]+\d+$/.test(id)) continue;
    const tier = cols[4] ?? '';
    if (/blocking only for `?layered`?/i.test(tier)) out.set(id, 'blocking-layered-only');
    else if (/\*\*blocking/i.test(tier)) out.set(id, 'blocking');
    else out.set(id, 'advisory');
  }
  return out;
}

/** Enabled functions of the spec in the blocking tier: the spec's own `tier` (DDD) first, else the tier table. */
export function blockingFunctions(spec: ParsedSpec, table: ReadonlyMap<string, TierEntry>): Set<string> {
  const style = specStyle(spec);
  const out = new Set<string>();
  for (const fn of spec.fitnessFunctions) {
    if (!fn.enabled) continue;
    const id = String(fn.id);
    const t = fn.tier ?? table.get(id);
    if (t === 'blocking' || (t === 'blocking-layered-only' && style === 'layered')) out.add(id);
  }
  return out;
}

export interface GuardedPair {
  readonly source: string;
  readonly target: string;
  /** The blocking functions that guard it, sorted. */
  readonly functions: readonly string[];
}

export function pairKey(source: string, target: string): string {
  return `${source}\t${target}`;
}

/** The guarded placement pairs of a spec (module header), restricted to the blocking functions. Sorted. */
export function specGuardedPairs(m: PlacementModel, blocking: ReadonlySet<string>): GuardedPair[] {
  const pairs = new Map<string, Set<string>>();
  const add = (s: string, t: string, fn: string): void => {
    if (!blocking.has(fn)) return;
    const k = pairKey(s, t);
    const set = pairs.get(k) ?? new Set<string>();
    set.add(fn);
    pairs.set(k, set);
  };
  if (m.style === 'layered' || m.style === 'clean') {
    m.layers.forEach((s, i) => {
      m.layers.forEach((t, j) => {
        if (j > i) add(s, t, 'FF-S01');
        if (j < i - 1) add(s, t, 'FF-S03');
      });
    });
  } else {
    const layerDenied = (a: string, b: string): boolean => a !== b && !(m.allowed.get(a)?.has(b) ?? false);
    if (m.style === 'hexagonal') {
      for (const s of m.layers) for (const t of m.layers) if (layerDenied(s, t)) add(s, t, 'FF-S01');
    } else {
      const placements = [...m.layers];
      for (const c of m.contexts) {
        placements.push(`${c.name}/-`);
        for (const l of m.layers) placements.push(`${c.name}/${l}`);
      }
      for (const s of placements) {
        for (const t of placements) {
          if (s === t) continue;
          const a = splitPlacement(s);
          const b = splitPlacement(t);
          if (a.ctx !== null && b.ctx !== null && a.ctx !== b.ctx) add(s, t, 'FF-DS02');
          if (a.layer !== null && b.layer !== null && layerDenied(a.layer, b.layer)) add(s, t, 'FF-S01');
        }
      }
    }
  }
  return [...pairs]
    .map(([k, fns]) => {
      const [source, target] = k.split('\t') as [string, string];
      return { source, target, functions: [...fns].sort(cmp) };
    })
    .sort((a, b) => cmp(pairKey(a.source, a.target), pairKey(b.source, b.target)));
}

export interface GuardIndex {
  readonly pairs: readonly GuardedPair[];
  readonly keys: ReadonlySet<string>;
  /** Placements that are the source side of some guarded pair. */
  readonly sources: ReadonlySet<string>;
  /** Placements that are the target side of some guarded pair. */
  readonly targets: ReadonlySet<string>;
}

export function guardIndex(pairs: readonly GuardedPair[]): GuardIndex {
  return {
    pairs,
    keys: new Set(pairs.map((p) => pairKey(p.source, p.target))),
    sources: new Set(pairs.map((p) => p.source)),
    targets: new Set(pairs.map((p) => p.target)),
  };
}

export function isGuarded(g: GuardIndex, source: string, target: string): boolean {
  return g.keys.has(pairKey(source, target));
}

/** Placement pairs of observed identities that are not spec pairs: listed only, never counted (EV-06a). Sorted. */
export function observedPairsNotInSpec(g: GuardIndex, observed: Iterable<readonly [string, string]>): [string, string][] {
  const out = new Map<string, [string, string]>();
  for (const [s, t] of observed) {
    if (s === UNMAPPED || t === UNMAPPED || s === OUTSIDE || t === OUTSIDE) continue;
    if (!isGuarded(g, s, t)) out.set(pairKey(s, t), [s, t]);
  }
  return [...out.values()].sort((a, b) => cmp(pairKey(a[0], a[1]), pairKey(b[0], b[1])));
}

export function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
