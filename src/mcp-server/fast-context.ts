/**
 * What every MCP v2 fast check reads about one file: its layer and layer kind, its syntax facts (`source-ast.ts`), and
 * each import as two edges (ADR-V13-01, `Docs/v1.3/edge-views.md`): the LITERAL edge to the module the specifier
 * names (a barrel included) and the RESOLVED edges to the files that declare the imported names (`viaReExport`
 * through barrels, followed in the project view when there is a project root). Pure given the view.
 */
import picomatch from 'picomatch';
import type { LayerKind } from '../shared/types/enums.js';
import type { ParsedSpec } from '../shared/types/spec.js';
import { normalisePath, resolveLayer } from './layer-resolver.js';
import { candidateFiles, ProjectView } from './project-files.js';
import type { ModuleTarget, ResolvedTarget } from './project-files.js';
import { parseSource } from './source-ast.js';
import type { AstFile, AstImport } from './source-ast.js';

export interface ImportEdge {
  readonly imp: AstImport;
  /** Literal view: the module the specifier names. */
  readonly literal: ModuleTarget;
  readonly literalLayer: string | null;
  /** Resolved view: the declaring file or package of each imported name (the literal target when nothing is re-exported). */
  readonly resolved: readonly ResolvedTarget[];
}

export interface Binding {
  readonly edge: ImportEdge;
  /** The exported name the local binding reads. */
  readonly imported: string;
  /** Where the name is declared (resolved view). */
  readonly declaredIn: ModuleTarget;
  readonly viaBarrels: readonly string[];
}

export interface FastContext {
  readonly spec: ParsedSpec;
  readonly file: string;
  readonly layer: string | null;
  readonly layerKind: LayerKind | null;
  readonly ast: AstFile;
  readonly view: ProjectView;
  readonly edges: readonly ImportEdge[];
  /** Local import binding name to what it refers to. */
  readonly bindings: ReadonlyMap<string, Binding>;
}

/** Layer of a module target (a file's layer by the spec's globs; for a path not known to exist, its candidates too). */
export function layerOfTarget(spec: ParsedSpec, target: ModuleTarget): string | null {
  if (target.kind !== 'file') return null;
  const direct = resolveLayer(spec, target.path)?.layer;
  if (direct !== undefined || target.exists) return direct ?? null;
  const bare = target.path.replace(/\.(?:[cm]?[jt]sx?)$/, '');
  for (const c of candidateFiles(bare)) {
    const l = resolveLayer(spec, c)?.layer;
    if (l !== undefined) return l;
  }
  return null;
}

export function layerKindOf(spec: ParsedSpec, layer: string | null): LayerKind | null {
  if (layer === null) return null;
  return spec.layerModel.layers.find((l) => l.name === layer)?.kind ?? null;
}

/** True when a project-relative path matches a glob (picomatch, `dot: true`, as the layer resolver). */
export function globMatch(glob: string, file: string): boolean {
  return picomatch(glob, { dot: true })(file);
}

/** Full-match test of a bound Cypher pattern (`=~`) against a path. */
export function fullMatch(pattern: string, file: string): boolean {
  return new RegExp(`^(?:${pattern})$`).test(file);
}

export function buildFastContext(spec: ParsedSpec, filePath: string, content: string, view: ProjectView): FastContext {
  const file = normalisePath(filePath);
  const layer = resolveLayer(spec, file)?.layer ?? null;
  const ast = parseSource(content, file);
  const isProjectPath = (p: string): boolean => resolveLayer(spec, p) !== undefined;
  const edges: ImportEdge[] = [];
  const bindings = new Map<string, Binding>();
  for (const imp of ast.imports) {
    const literal = view.resolveModule(file, imp.specifier, isProjectPath);
    const named = imp.names.map((n) => n.imported).filter((n) => n !== '*' && n !== 'default');
    const resolved: ResolvedTarget[] =
      literal.kind === 'file' && named.length > 0 && view.hasRoot
        ? view.resolveNames(literal.path, named)
        : [{ target: literal, viaBarrels: [], names: named }];
    // A namespace, default or side-effect import keeps the literal target in the resolved view too.
    if (literal.kind === 'file' && named.length !== imp.names.length && !resolved.some((r) => r.viaBarrels.length === 0 && r.target.kind === 'file' && r.target.path === literal.path)) {
      resolved.push({ target: literal, viaBarrels: [], names: imp.names.filter((n) => n.imported === '*' || n.imported === 'default').map((n) => n.imported) });
    }
    const edge: ImportEdge = { imp, literal, literalLayer: layerOfTarget(spec, literal), resolved };
    edges.push(edge);
    for (const n of imp.names) {
      if (imp.kind === 'reexport') continue;
      const hit = resolved.find((r) => r.names.includes(n.imported)) ?? { target: literal, viaBarrels: [] };
      bindings.set(n.local, { edge, imported: n.imported, declaredIn: hit.target, viaBarrels: hit.viaBarrels });
    }
  }
  return { spec, file, layer, layerKind: layerKindOf(spec, layer), ast, view, edges, bindings };
}
