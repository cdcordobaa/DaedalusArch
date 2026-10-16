/**
 * ISE (Implicit Specification Extraction, exploratory): the compact view of an APG that the inferrer reads.
 *
 * The inferrer sees a project only through this view, built in memory from `extractAPG` over a source snapshot
 * (`snapshot.ts`): files, file-to-file import edges, external package imports, classes and interfaces with their
 * decorators, IMPLEMENTS / EXTENDS / CONSTRUCTOR_INJECTS between them. No Neo4j, no spec.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { extractAPG } from '../apg-extractor/index.js';
import type { APGEdge, APGNode } from '../shared/types/apg.js';

export interface IseFileEdge {
  readonly from: string;
  readonly to: string;
  /** Every occurrence is `import type`. */
  readonly typeOnly: boolean;
}

export interface IseDeclaration {
  readonly name: string;
  readonly kind: 'class' | 'interface';
  readonly file: string;
  readonly decorators: readonly string[];
}

export interface IseTypeEdge {
  readonly kind: 'implements' | 'extends' | 'injects';
  readonly from: IseDeclaration;
  readonly to: IseDeclaration;
}

export interface IseGraph {
  /** Project-relative paths with forward slashes (`src/domain/Book.ts`), sorted. */
  readonly files: readonly string[];
  /** File-to-file IMPORTS and RE_EXPORTS edges, one per ordered pair (literal and resolved views merged). */
  readonly edges: readonly IseFileEdge[];
  /** External package imports: file -> package name. */
  readonly packageImports: readonly { readonly file: string; readonly pkg: string }[];
  readonly declarations: readonly IseDeclaration[];
  readonly typeEdges: readonly IseTypeEdge[];
}

const TYPE_EDGE: Readonly<Record<string, IseTypeEdge['kind']>> = {
  IMPLEMENTS: 'implements',
  EXTENDS: 'extends',
  CONSTRUCTOR_INJECTS: 'injects',
};

/** Pure: the ISE view of extracted APG nodes and edges. `rel` maps a node's filePath to a project-relative path. */
export function iseGraphFromApg(nodes: readonly APGNode[], edges: readonly APGEdge[], rel: (p: string) => string = (p) => p): IseGraph {
  const fileById = new Map<string, string>();
  const pkgById = new Map<string, string>();
  const declById = new Map<string, IseDeclaration>();
  for (const n of nodes) {
    if (n.type === 'File') fileById.set(n.id, rel(n.filePath));
    else if (n.type === 'Package') pkgById.set(n.id, n.name);
    else if (n.type === 'Class' || n.type === 'Interface') {
      declById.set(n.id, { name: n.name, kind: n.type === 'Class' ? 'class' : 'interface', file: rel(n.filePath), decorators: [...n.decorators] });
    }
  }
  const fileEdges = new Map<string, { from: string; to: string; typeOnly: boolean }>();
  const pkgs = new Map<string, { file: string; pkg: string }>();
  const typeEdges: IseTypeEdge[] = [];
  for (const e of edges) {
    if (e.type === 'IMPORTS' || e.type === 'RE_EXPORTS') {
      const s = fileById.get(e.sourceId);
      if (s === undefined) continue;
      const t = fileById.get(e.targetId);
      if (t === undefined) {
        const pkg = pkgById.get(e.targetId);
        if (pkg !== undefined) pkgs.set(`${s}|${pkg}`, { file: s, pkg });
        continue;
      }
      if (s === t) continue;
      const typeOnly = (e.properties as { isTypeOnly?: unknown }).isTypeOnly === true;
      const k = `${s}|${t}`;
      const prev = fileEdges.get(k);
      fileEdges.set(k, { from: s, to: t, typeOnly: prev === undefined ? typeOnly : prev.typeOnly && typeOnly });
      continue;
    }
    const kind = TYPE_EDGE[e.type];
    if (kind === undefined) continue;
    const from = declById.get(e.sourceId);
    const to = declById.get(e.targetId);
    if (from !== undefined && to !== undefined) typeEdges.push({ kind, from, to });
  }
  const byPair = (a: { from: string; to: string }, b: { from: string; to: string }): number =>
    a.from === b.from ? (a.to < b.to ? -1 : a.to > b.to ? 1 : 0) : a.from < b.from ? -1 : 1;
  return {
    files: [...fileById.values()].sort(),
    edges: [...fileEdges.values()].sort(byPair),
    packageImports: [...pkgs.values()].sort((a, b) => (a.file + a.pkg < b.file + b.pkg ? -1 : 1)),
    declarations: [...declById.values()],
    typeEdges,
  };
}

/**
 * Extracts the ISE view of the project at `projectDir` (a snapshot: `src/` and `tsconfig.json` only). Reads nothing
 * outside `projectDir` but the TypeScript library files the compiler itself loads.
 */
export async function loadIseGraph(projectDir: string): Promise<IseGraph> {
  const root = fs.realpathSync(projectDir);
  const res = await extractAPG(root, {}, path.join(root, 'tsconfig.json'));
  if (!res.success) throw new Error(`ISE: extraction failed: ${res.errors.map((e) => e.message).join('; ')}`);
  const rel = (p: string): string => {
    const f = p.replace(/\\/g, '/');
    const r = root.replace(/\\/g, '/');
    return (f.startsWith(r + '/') ? f.slice(r.length + 1) : f).replace(/^\.\//, '');
  };
  return iseGraphFromApg(res.data.nodes, res.data.edges, rel);
}
