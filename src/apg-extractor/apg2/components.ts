import picomatch from 'picomatch';
import { Node } from 'ts-morph';
import type { SourceFile } from 'ts-morph';
import type { APGEdge, APGNode } from '../../shared/types/apg.js';
import type { LayerModel } from '../../shared/types/spec.js';
import type { ComponentDeclaration, NodeLookup } from '../types.js';
import { normalizeFilePath } from '../id-generator.js';
import { apg2Edge, apg2Node } from './common.js';

/**
 * Enrichment 2 and 2b: Component nodes, BELONGS_TO (File → Component), DEPENDS_ON (Component → Component, aggregated
 * from the literal IMPORTS view), Martin's component metrics (Martin 2017 ch. 14) as Component properties, and the
 * public API surface (entry files, EXPORTS_SYMBOL, DEEP_IMPORT).
 *
 * Components come in kinds (`layer`, `module`, `folder`). Each kind is a partition of (part of) the files: a file
 * belongs to at most one component of a kind, and DEPENDS_ON and the metrics are computed within a kind.
 */

/** Components from a spec: one per layer (its directories, then its file-name patterns), one per DDD context. */
export function componentsFromLayerModel(layerModel: LayerModel): ComponentDeclaration[] {
  const out: ComponentDeclaration[] = layerModel.layers.map((l) => ({
    name: l.name,
    kind: 'layer' as const,
    include: [...l.directories],
    includeByName: [...(l.filePatterns ?? [])],
  }));
  for (const c of layerModel.ddd?.contexts ?? []) {
    const root = c.root.endsWith('/') ? c.root : `${c.root}/`;
    out.push({ name: c.name, kind: 'module', include: [`${root}**`], ...(c.publicApi.length > 0 ? { publicApi: [...c.publicApi] } : {}) });
  }
  return out;
}

/** The fallback: one `folder` component per top-level folder under `src/` (else under the project root). */
export function folderComponents(filePaths: readonly string[]): ComponentDeclaration[] {
  const underSrc = filePaths.some((p) => p.startsWith('src/'));
  const prefix = underSrc ? 'src/' : '';
  const names = new Set<string>();
  for (const p of filePaths) {
    if (!p.startsWith(prefix)) continue;
    const parts = p.slice(prefix.length).split('/');
    const [head] = parts;
    if (parts.length > 1 && head !== undefined) names.add(head);
  }
  return [...names].sort().map((n) => ({ name: n, kind: 'folder' as const, include: [`${prefix}${n}/**`] }));
}

/** The common directory of a component's include globs (the part before the first wildcard), for index detection. */
function rootDirOf(decl: ComponentDeclaration): string | undefined {
  const dirs = decl.include.map((g) => {
    const i = g.search(/[*?{[]/);
    const head = i < 0 ? g : g.slice(0, i);
    return head.endsWith('/') ? head : head.slice(0, head.lastIndexOf('/') + 1);
  });
  return dirs.length === 1 && dirs[0] !== '' ? dirs[0] : undefined;
}

const INDEX_FILE = /(^|\/)index\.(ts|tsx|mts|cts)$/;

export interface ComponentPassInput {
  readonly sourceFiles: readonly SourceFile[];
  readonly nodes: readonly APGNode[];
  readonly edges: readonly APGEdge[];
  readonly lookup: NodeLookup;
  readonly projectRoot: string;
  readonly declarations: readonly ComponentDeclaration[];
}

export interface ComponentPassResult {
  readonly nodes: APGNode[];
  readonly edges: APGEdge[];
}

interface Comp {
  readonly decl: ComponentDeclaration;
  readonly node: APGNode;
  readonly files: string[];
  readonly entries: Set<string>;
}

function addTo<K, V>(map: Map<K, Set<V>>, key: K, value: V): void {
  const set = map.get(key);
  if (set === undefined) map.set(key, new Set([value]));
  else set.add(value);
}

const round = (x: number): number => Math.round(x * 1000) / 1000;

export function extractComponents(input: ComponentPassInput): ComponentPassResult {
  const { sourceFiles, nodes, edges, lookup, projectRoot } = input;
  const fileNodes = nodes.filter((n) => n.type === 'File');
  const fileById = new Map(fileNodes.map((f) => [f.id, f]));
  const decls = input.declarations.length > 0 ? input.declarations : folderComponents(fileNodes.map((f) => f.filePath));

  const outNodes: APGNode[] = [];
  const outEdges: APGEdge[] = [];
  const comps: Comp[] = [];
  /** kind → filePath → component */
  const membership = new Map<string, Map<string, Comp>>();

  for (const decl of decls) {
    const node = apg2Node('Component', `component:${decl.kind}`, decl.name, {});
    comps.push({ decl, node, files: [], entries: new Set() });
  }
  for (const kind of new Set(decls.map((d) => d.kind))) {
    const ofKind = comps.filter((c) => c.decl.kind === kind);
    const byInclude = ofKind.map((c) => picomatch(c.decl.include as string[], { dot: true }));
    const byName = ofKind.map((c) => (c.decl.includeByName?.length ?? 0) > 0 ? picomatch(c.decl.includeByName as string[], { dot: true }) : null);
    const map = new Map<string, Comp>();
    for (const f of fileNodes) {
      let idx = byInclude.findIndex((m) => m(f.filePath));
      if (idx < 0) idx = byName.findIndex((m) => m?.(f.filePath) === true);
      const comp = ofKind[idx];
      if (comp === undefined) continue;
      map.set(f.filePath, comp);
      comp.files.push(f.filePath);
    }
    membership.set(kind, map);
  }

  // Entry files: declared, else index files at the component root and barrel files anywhere in it.
  for (const c of comps) {
    if (c.decl.publicApi !== undefined && c.decl.publicApi.length > 0) {
      const m = picomatch(c.decl.publicApi as string[], { dot: true });
      for (const f of c.files) if (m(f)) c.entries.add(f);
    } else {
      const root = rootDirOf(c.decl);
      for (const f of c.files) {
        const isRootIndex = root !== undefined && INDEX_FILE.test(f) && f.slice(root.length).split('/').length === 1;
        const fileNode = fileNodes.find((n) => n.filePath === f);
        if (isRootIndex || fileNode?.properties.isBarrel === true) c.entries.add(f);
      }
    }
  }

  // Literal-view IMPORTS between File nodes (Docs/v1.3/edge-views.md): drop the resolved `viaReExport` edges.
  const pathOf = (id: string): string => fileById.get(id)?.filePath ?? '';
  const imports = edges.filter((e) => e.type === 'IMPORTS' && e.properties.viaReExport !== true
    && fileById.has(e.sourceId) && fileById.has(e.targetId));

  // Types per file, for abstractness.
  const typesByFile = new Map<string, { total: number; abstract: number }>();
  for (const n of nodes) {
    if (n.type !== 'Class' && n.type !== 'Interface') continue;
    const t = typesByFile.get(n.filePath) ?? { total: 0, abstract: 0 };
    t.total++;
    if (n.type === 'Interface' || n.properties.isAbstract === true) t.abstract++;
    typesByFile.set(n.filePath, t);
  }

  for (const [kind, map] of membership) {
    const ofKind = comps.filter((c) => c.decl.kind === kind);
    const agg = new Map<string, { from: Comp; to: Comp; imports: number; typeOnly: boolean }>();
    const caFiles = new Map<Comp, Set<string>>();
    const ceFiles = new Map<Comp, Set<string>>();
    for (const e of imports) {
      const s = pathOf(e.sourceId);
      const t = pathOf(e.targetId);
      const cs = map.get(s);
      const ct = map.get(t);
      if (cs === undefined || ct === undefined || cs === ct) continue;
      const key = `${cs.node.id}>${ct.node.id}`;
      const a = agg.get(key) ?? { from: cs, to: ct, imports: 0, typeOnly: true };
      a.imports++;
      if (e.properties.isTypeOnly !== true) a.typeOnly = false;
      agg.set(key, a);
      addTo(ceFiles, cs, s);
      addTo(caFiles, ct, s);
    }
    for (const a of agg.values()) {
      outEdges.push(apg2Edge('DEPENDS_ON', a.from.node.id, a.to.node.id, { kind, imports: a.imports, typeOnly: a.typeOnly }));
    }
    for (const c of ofKind) {
      const outComps = new Set([...agg.values()].filter((a) => a.from === c).map((a) => a.to.node.id));
      const inComps = new Set([...agg.values()].filter((a) => a.to === c).map((a) => a.from.node.id));
      const ca = caFiles.get(c)?.size ?? 0;
      const ce = ceFiles.get(c)?.size ?? 0;
      let total = 0;
      let abstract = 0;
      for (const f of c.files) {
        const t = typesByFile.get(f);
        if (t !== undefined) { total += t.total; abstract += t.abstract; }
      }
      const instability = ca + ce === 0 ? null : round(ce / (ca + ce));
      const abstractness = total === 0 ? null : round(abstract / total);
      const distance = instability === null || abstractness === null ? null : round(Math.abs(abstractness + instability - 1));
      Object.assign(c.node.properties as Record<string, unknown>, {
        kind,
        fileCount: c.files.length,
        ca, ce,
        componentCa: inComps.size,
        componentCe: outComps.size,
        instability,
        typeCount: total,
        abstractTypeCount: abstract,
        abstractness,
        distance,
        entryFiles: [...c.entries].sort(),
        publicApiDeclared: c.decl.publicApi !== undefined && c.decl.publicApi.length > 0,
      });
    }
  }

  for (const c of comps) outNodes.push(c.node);
  for (const c of comps) {
    for (const f of c.files) {
      const fid = lookup.fileNodes.get(f);
      if (fid !== undefined) outEdges.push(apg2Edge('BELONGS_TO', fid, c.node.id, { kind: c.decl.kind, entry: c.entries.has(f) }));
    }
  }

  // EXPORTS_SYMBOL: Component → Class / Interface / Function nodes its entry files export (directly or re-exported).
  const sfByPath = new Map(sourceFiles.map((sf) => [normalizeFilePath(sf.getFilePath(), projectRoot), sf]));
  for (const c of comps) {
    const seen = new Set<string>();
    for (const entry of [...c.entries].sort()) {
      const sf = sfByPath.get(entry);
      if (sf === undefined) continue;
      let exported: ReadonlyMap<string, Node[]>;
      try {
        exported = sf.getExportedDeclarations();
      } catch {
        continue;
      }
      for (const [name, declsOf] of exported) {
        for (const d of declsOf) {
          const dPath = normalizeFilePath(d.getSourceFile().getFilePath(), projectRoot);
          let id: string | undefined;
          if (Node.isClassDeclaration(d) || Node.isInterfaceDeclaration(d)) id = lookup.typeNodes.get(`${(d.getName() ?? '<anonymous>').toLowerCase()}@${dPath}`);
          else if (Node.isFunctionDeclaration(d)) id = lookup.functionNodes.get(`${(d.getName() ?? '').toLowerCase()}@${dPath}`);
          else if (Node.isVariableDeclaration(d)) id = lookup.functionNodes.get(`${d.getName().toLowerCase()}@${dPath}`);
          if (id === undefined || seen.has(id)) continue;
          seen.add(id);
          outEdges.push(apg2Edge('EXPORTS_SYMBOL', c.node.id, id, { exportedName: name, entryFile: entry, kind: c.decl.kind }));
        }
      }
    }
  }

  // DEEP_IMPORT: a file outside a component that has entry files imports one of its non-entry files (literal view).
  for (const e of imports) {
    const s = pathOf(e.sourceId);
    const t = pathOf(e.targetId);
    for (const [kind, map] of membership) {
      const ct = map.get(t);
      if (ct === undefined || ct.entries.size === 0 || ct.entries.has(t) || map.get(s) === ct) continue;
      outEdges.push(apg2Edge('DEEP_IMPORT', e.sourceId, e.targetId, {
        component: ct.decl.name,
        kind,
        publicApiDeclared: ct.decl.publicApi !== undefined && ct.decl.publicApi.length > 0,
        specifier: e.properties.specifier,
        line: e.properties.line,
      }));
      break; // one DEEP_IMPORT per import edge: the first kind (declaration order) that sees it
    }
  }

  return { nodes: outNodes, edges: outEdges };
}
