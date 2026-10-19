/**
 * The shared read-only context of the cheap proxies: the APG, the ts-morph project, and per-file layer, layer kind and
 * component. Nothing here edits the APG or the project.
 */
import * as path from 'node:path';
import picomatch from 'picomatch';
import { Node, ts } from 'ts-morph';
import type { ClassDeclaration, Project, SourceFile } from 'ts-morph';
import { annotateNodes } from '../../neo4j-ingestion/layer-annotator.js';
import type { APGResult } from '../../shared/types/apg.js';
import type { LayerKind, NodeType } from '../../shared/types/enums.js';
import type { LayerModel } from '../../shared/types/spec.js';
import type { CheapOptions, Evidence, FileInfo } from './types.js';

export interface CheapInput {
  readonly apg: APGResult;
  /** A ts-morph project over the same tsconfig the APG was extracted with (type checker available). */
  readonly project: Project;
  /** The project root the APG's `filePath`s are relative to (as passed to `extractAPG`). */
  readonly projectRoot: string;
  /** The spec's layer model; without it every file has layer `null` and the layer-dependent proxies say less. */
  readonly layerModel?: LayerModel;
}

export interface CheapContext {
  readonly apg: APGResult;
  readonly project: Project;
  readonly root: string;
  readonly options: CheapOptions;
  readonly layerModel: LayerModel | undefined;
  /** APG File nodes with their ts-morph source file, path order. */
  readonly sources: readonly { readonly file: string; readonly sf: SourceFile }[];
  readonly files: ReadonlyMap<string, FileInfo>;
  /** The APG node id of a File, Class, Interface, Method (`Class.method`) or Function, if the APG has it. */
  nodeId(type: NodeType, file: string, name: string): string | undefined;
  rel(sf: SourceFile): string;
  info(file: string): FileInfo;
  evidence(node: Node): Evidence;
  /** The package a declaration comes from (see `moduleOfDeclaration`), or null for project code. */
  moduleOf(decl: Node): string | null;
}

/** Leading directory names that hold a project's sources; the component is the next segment. */
const SOURCE_ROOTS = ['src', 'lib', 'app', 'apps', 'packages'];

/**
 * The component of a file: the declared DDD bounded context when the spec has one, else the first directory under
 * the source root (`src/order/order.service.ts` → `order`). A file directly under the root is component `(root)`. In a
 * layer-first project (`src/domain`, `src/application`) the components coincide with the layers; the design note
 * names this limit.
 */
export function componentOf(file: string, layerModel?: LayerModel): string {
  const declared = declaredContextOf(file, layerModel);
  if (declared !== null) return declared;
  const parts = file.split('/');
  const start = parts.length > 1 && SOURCE_ROOTS.includes(parts[0] ?? '') ? 1 : 0;
  return parts.length - start > 1 ? parts[start] ?? '(root)' : '(root)';
}

/**
 * The declared DDD bounded context of a file: the first `ddd.contexts[]` entry whose root is a prefix of the file's
 * path, or null when no declared context matches (then `componentOf` falls back to the directory). Pure.
 */
export function declaredContextOf(file: string, layerModel?: LayerModel): string | null {
  const ddd = layerModel?.ddd;
  if (ddd === undefined) return null;
  const hit = ddd.contexts.find((c) => file.startsWith(c.root.endsWith('/') ? c.root : `${c.root}/`));
  return hit?.name ?? null;
}

/** `paths` targets of the compiler options as absolute paths without extension → the path key (without `/*`). */
function pathAliases(project: Project, root: string): { target: string; key: string; wildcard: boolean }[] {
  const opts = project.getCompilerOptions();
  const base = opts.baseUrl ?? root;
  const out: { target: string; key: string; wildcard: boolean }[] = [];
  for (const [key, targets] of Object.entries(opts.paths ?? {})) {
    for (const t of targets) {
      const wildcard = key.endsWith('/*') && t.endsWith('*');
      const abs = path.resolve(base, wildcard ? t.slice(0, -1) : t).replace(/\\/g, '/');
      out.push({ target: stripExt(abs), key: wildcard ? key.slice(0, -2) : key, wildcard });
    }
  }
  return out;
}

function stripExt(p: string): string {
  return p.replace(/(\.d)?\.(ts|tsx|mts|cts|js|mjs|cjs)$/, '').replace(/\/index$/, '');
}

/** `node:fs` → `fs`; `@types/express` → `express`. */
export function normaliseModule(name: string): string {
  const n = name.startsWith('node:') ? name.slice(5) : name;
  if (n.startsWith('@types/')) {
    const rest = n.slice(7);
    return rest.includes('__') ? `@${rest.replace('__', '/')}` : rest;
  }
  return n;
}

/** The package name of a `node_modules` path: `/x/node_modules/@scope/pkg/dist/a.d.ts` → `@scope/pkg`. */
function packageOfPath(file: string): string | null {
  const i = file.lastIndexOf('/node_modules/');
  if (i < 0) return null;
  const segs = file.slice(i + 14).split('/');
  const first = segs[0] ?? '';
  return normaliseModule(first.startsWith('@') ? `${first}/${segs[1] ?? ''}` : first);
}

export function buildContext(input: CheapInput, options: CheapOptions): CheapContext {
  const root = input.projectRoot.replace(/\\/g, '/').replace(/\/$/, '');
  const ids = new Map<string, string>();
  for (const n of input.apg.nodes) ids.set(`${n.type}|${n.filePath}|${n.name}`, n.id);

  const fileNodes = input.apg.nodes.filter((n) => n.type === 'File');
  const layerOf = new Map<string, string | null>();
  if (input.layerModel !== undefined) {
    const { annotations } = annotateNodes(fileNodes, input.layerModel);
    for (const n of fileNodes) layerOf.set(n.filePath, annotations.get(n.id)?.layer ?? null);
  }
  const kindOf = new Map<string, LayerKind | undefined>((input.layerModel?.layers ?? []).map((l) => [l.name, l.kind]));
  const files = new Map<string, FileInfo>();
  const sources: { file: string; sf: SourceFile }[] = [];
  for (const n of [...fileNodes].sort((a, b) => (a.filePath < b.filePath ? -1 : a.filePath > b.filePath ? 1 : 0))) {
    const layer = layerOf.get(n.filePath) ?? null;
    files.set(n.filePath, {
      file: n.filePath,
      fileNodeId: n.id,
      layer,
      layerKind: layer === null ? null : kindOf.get(layer) ?? null,
      component: componentOf(n.filePath, input.layerModel),
    });
    const sf = input.project.getSourceFile(`${root}/${n.filePath}`);
    if (sf !== undefined) sources.push({ file: n.filePath, sf });
  }

  const aliases = pathAliases(input.project, root);
  const moduleCache = new Map<string, string | null>();
  const fileModule = (abs: string): string | null => {
    const cached = moduleCache.get(abs);
    if (cached !== undefined || moduleCache.has(abs)) return cached ?? null;
    let out = packageOfPath(abs);
    if (out === null) {
      const bare = stripExt(abs);
      for (const a of aliases) {
        if (a.wildcard ? bare.startsWith(`${a.target}/`) : bare === a.target) {
          out = normaliseModule(a.wildcard ? `${a.key}/${bare.slice(a.target.length + 1)}` : a.key);
          break;
        }
      }
    }
    moduleCache.set(abs, out);
    return out;
  };

  const rel = (sf: SourceFile): string => {
    const abs = sf.getFilePath().replace(/\\/g, '/');
    return abs.startsWith(`${root}/`) ? abs.slice(root.length + 1) : abs;
  };

  return {
    apg: input.apg,
    project: input.project,
    root,
    options,
    layerModel: input.layerModel,
    sources,
    files,
    nodeId: (type, file, name) => ids.get(`${type}|${file}|${name}`),
    rel,
    info: (file) => files.get(file) ?? { file, fileNodeId: undefined, layer: null, layerKind: null, component: componentOf(file, input.layerModel) },
    evidence: (node) => ({ file: rel(node.getSourceFile()), startLine: node.getStartLineNumber(), endLine: node.getEndLineNumber() }),
    moduleOf: (decl) => {
      for (let p: Node | undefined = decl; p !== undefined; p = p.getParent()) {
        if (Node.isModuleDeclaration(p)) {
          const name = p.compilerNode.name;
          if (ts.isStringLiteral(name)) return normaliseModule(name.text);
        }
      }
      return fileModule(decl.getSourceFile().getFilePath().replace(/\\/g, '/'));
    },
  };
}

/** Named classes of a file (the APG's Class nodes), declaration order. */
export function classesOf(sf: SourceFile): ClassDeclaration[] {
  return sf.getClasses().filter((c) => c.getName() !== undefined);
}

/** True when the file matches any of the globs (picomatch, dot files included). */
export function matchesAny(file: string, globs: readonly string[]): boolean {
  return globs.length > 0 && picomatch(globs as string[], { dot: true })(file);
}
