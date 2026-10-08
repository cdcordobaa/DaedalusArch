/**
 * Shared helpers of the catalogue operators (FR-v1.2E-24; BR-U5a-11, 12, 18, 23–29; `business-rules.md` §3).
 *
 * Everything here reads the ts-morph project of one copy and the parsed spec; nothing reads a detector output
 * (BR-U5a-06). Paths are POSIX, relative to the copy root. Edits go through ts-morph and keep the text outside the
 * edited span unchanged; insertions are whole lines.
 */
import { Node, SyntaxKind } from 'ts-morph';
import type { ClassDeclaration, InterfaceDeclaration, SourceFile } from 'ts-morph';
import { bindLayerParams } from '../../../../src/fitness-compiler/layer-binding.js';
import type { LayerKindBinding } from '../../../../src/fitness-compiler/types.js';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import { layerDirsOf } from '../expected.js';
import { IMPORT_GRAPH_EXCLUDE_PATTERNS, layerOf } from '../import-graph.js';
import type { LayerDirs } from '../import-graph.js';
import type { ImportGraph, MutationEdit, ParsedSpec, ProjectHandle } from '../types.js';
import picomatch from 'picomatch';

export function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function fail<T>(code: string, message: string): DomainResult<T> {
  return DomainResult.fail([{ code, message }]);
}

/** Relative POSIX path of a source file in the copy. */
export function relOf(handle: ProjectHandle, sf: SourceFile): string {
  const root = handle.root.endsWith('/') ? handle.root : handle.root + '/';
  const abs = sf.getFilePath();
  return abs.startsWith(root) ? abs.slice(root.length) : abs;
}

const isExcluded = picomatch([...IMPORT_GRAPH_EXCLUDE_PATTERNS], { dot: true });

/** Project source files in the import-graph file set (tests, `.d.ts`, `node_modules` excluded), path order. */
export function projectFiles(handle: ProjectHandle): SourceFile[] {
  return handle.project
    .getSourceFiles()
    .filter((sf) => {
      const rel = relOf(handle, sf);
      return !rel.startsWith('/') && !rel.startsWith('..') && !isExcluded(rel);
    })
    .sort((a, b) => cmp(relOf(handle, a), relOf(handle, b)));
}

export function fileAt(handle: ProjectHandle, rel: string): SourceFile | undefined {
  return handle.project.getSourceFile(`${handle.root.endsWith('/') ? handle.root : handle.root + '/'}${rel}`);
}

export interface SpecView {
  readonly layers: readonly LayerDirs[];
  readonly binding: LayerKindBinding;
}

export function specView(spec: ParsedSpec): SpecView {
  return { layers: layerDirsOf(spec), binding: bindLayerParams(spec.layerModel.layers) };
}

/** Files of a layer (by name), path order; `undefined` layer → none. */
export function layerFiles(handle: ProjectHandle, view: SpecView, layer: string | undefined): SourceFile[] {
  if (layer === undefined) return [];
  return projectFiles(handle).filter((sf) => layerOf(relOf(handle, sf), view.layers) === layer);
}

export function layerOfFile(view: SpecView, rel: string): string | null {
  return layerOf(rel, view.layers);
}

/** Exported value declarations (class, function, const/let/var) by name, sorted. */
export function exportedValueNames(sf: SourceFile): string[] {
  const out = new Set<string>();
  for (const [name, decls] of sf.getExportedDeclarations()) {
    if (name === 'default') continue;
    if (decls.some((d) => d.getSourceFile() === sf && (Node.isClassDeclaration(d) || Node.isFunctionDeclaration(d) || Node.isVariableDeclaration(d)))) {
      out.add(name);
    }
  }
  return [...out].sort(cmp);
}

/** Exported declarations of any kind (incl. interfaces and type aliases) by name, sorted. */
export function exportedNames(sf: SourceFile): string[] {
  const out = new Set<string>();
  for (const [name, decls] of sf.getExportedDeclarations()) {
    if (name === 'default') continue;
    if (decls.some((d) => d.getSourceFile() === sf)) out.add(name);
  }
  return [...out].sort(cmp);
}

/** Does the base graph hold a File→File edge (any type) from `source` to `target`? */
export function hasEdge(g: ImportGraph, source: string, target: string): boolean {
  return g.edges.some((e) => e.source === source && e.target === target);
}

/** Module specifier from `from` to `to` (relative, no extension). */
export function specifierTo(from: SourceFile, to: SourceFile): string {
  return from.getRelativePathAsModuleSpecifierTo(to);
}

/** A top-level name not yet declared in the file (`base`, then `base2`, `base3`, …). */
export function freshName(sf: SourceFile, base: string): string {
  const taken = new Set<string>();
  for (const s of sf.getStatements()) {
    for (const id of s.getDescendantsOfKind(SyntaxKind.Identifier)) taken.add(id.getText());
  }
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}${String(i)}`)) return `${base}${String(i)}`;
}

/** lowerCamel of an identifier. */
export function lowerFirst(name: string): string {
  return name.length === 0 ? name : name.charAt(0).toLowerCase() + name.slice(1);
}

/** Index of the statement after the last leading import declaration. */
function importInsertIndex(sf: SourceFile): number {
  let index = 0;
  sf.getStatements().forEach((s, i) => {
    if (Node.isImportDeclaration(s)) index = i + 1;
  });
  return index;
}

/**
 * Inserts one import declaration after the existing imports (as the first statement when there is none) and
 * returns its 1-based line in the edited file.
 */
export function insertImport(
  sf: SourceFile,
  moduleSpecifier: string,
  form: { readonly named?: readonly string[]; readonly defaultImport?: string },
): number {
  const decl = sf.insertImportDeclaration(importInsertIndex(sf), {
    moduleSpecifier,
    ...(form.named !== undefined ? { namedImports: [...form.named] } : {}),
    ...(form.defaultImport !== undefined ? { defaultImport: form.defaultImport } : {}),
  });
  return decl.getStartLineNumber();
}

/** Appends `export const <name> = <expr>;` (a value reference) at the end of the file. */
export function appendValueRef(sf: SourceFile, expr: string, preferredName: string): string {
  const name = freshName(sf, preferredName);
  sf.addStatements(`export const ${name} = ${expr};`);
  return name;
}

/** Appends `export type <name> = <typeExpr>;` (a type reference) at the end of the file. */
export function appendTypeRef(sf: SourceFile, typeExpr: string, preferredName: string): string {
  const name = freshName(sf, preferredName);
  sf.addStatements(`export type ${name} = ${typeExpr};`);
  return name;
}

/** Named classes of a file, declaration order. */
export function namedClasses(sf: SourceFile): ClassDeclaration[] {
  return sf.getClasses().filter((c) => c.getName() !== undefined);
}

export function namedInterfaces(sf: SourceFile): InterfaceDeclaration[] {
  return sf.getInterfaces();
}

/** Method count as the templates count it: class methods of any visibility (BR-U5a-24). */
export function classMethodCount(c: ClassDeclaration): number {
  return c.getMethods().length;
}

/** Interface method signatures (BR-U2-47). */
export function interfaceMethodCount(i: InterfaceDeclaration): number {
  return i.getMethods().length;
}

/** A controller by the catalogue's definition: class name ends with `Controller` or a `controllers` directory. */
export function isControllerFile(sf: SourceFile, rel: string): boolean {
  return rel.split('/').includes('controllers') || namedClasses(sf).some((c) => (c.getName() ?? '').endsWith('Controller'));
}

/** Default entity-role terms (`fitness-compiler.ts` `entityRoles`). */
export const ENTITY_ROLES: readonly string[] = ['Entity', 'Aggregate', 'ValueObject'];

export function hasEntityRole(name: string): boolean {
  return ENTITY_ROLES.some((r) => name.includes(r));
}

/** Number parameter of the compiled spec for a template (`maxPublicMethods`, …), else the fallback. */
export function specNumber(spec: ParsedSpec, template: string, field: 'maxPublicMethods' | 'maxInterfaceMethods', fallback: number): number {
  const ff = spec.fitnessFunctions.find((f) => f.name === template && f.enabled);
  const v = ff?.[field];
  return typeof v === 'number' ? v : fallback;
}

/** The edit record an operator returns; the pipeline recomputes `editedFiles`, `createdFiles` and `lineShifts`. */
export function editOf(
  edited: readonly string[],
  created: readonly string[],
  newEdges: readonly { readonly source: string; readonly target: string }[],
  keyAnchor?: MutationEdit['keyAnchor'],
): MutationEdit {
  return {
    editedFiles: [...edited],
    createdFiles: [...created],
    lineShifts: [],
    newEdges: [...newEdges],
    ...(keyAnchor !== undefined ? { keyAnchor } : {}),
  };
}
