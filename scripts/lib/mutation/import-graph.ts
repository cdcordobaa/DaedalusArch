/**
 * ts-morph import graph of a prepared copy (FR-v1.2E-24; BR-U5a-56; D-U5a-15).
 *
 * The mutation engine may not import `src/apg-extractor` (BR-U5a-06), so this module re-implements the parts of the
 * extractor's graph that the cycle and metric rules read, and `scripts/lib/import-graph-parity.ts` proves equality
 * with `extractAPG` (any difference is fixed here, never in the test):
 *
 * - **File set**: the tsconfig `include` files (project opened with `skipFileDependencyResolution`, as the extractor
 *   in lenient mode) minus {@link IMPORT_GRAPH_EXCLUDE_PATTERNS}, matched by picomatch with `dot: true` against the
 *   path relative to the project root (`apg-extractor.ts` step 2). `filePath` = POSIX path relative to the root.
 * - **`isBarrel`**: at least one statement and every statement an import or export declaration
 *   (`node-extractor.ts` `detectBarrel`).
 * - **`layer`**: first layer (in the given order) whose `directories` globs match the path, else the first whose
 *   `filePatterns` match, else `null` (`layer-annotator.ts` File rule).
 * - **Edges**: top-level import declarations (type-only and side-effect included), import-equals declarations with
 *   a string module reference (`IMPORTS`), and `export … from` declarations (`RE_EXPORTS`). Module resolution follows
 *   the U2 decision list (BR-U2-01..13): built-in → Package; relative → File, else no edge; alias or bare through
 *   `ts.resolveModuleName` with the project's compiler options (`paths`, `baseUrl`) → File when it lands on a File
 *   node under the root, Package for `node_modules`/external or out-of-root targets, unresolved when it looks like a
 *   project alias. Named and default imports are routed **per name** through barrels with
 *   `getImmediatelyAliasedSymbol()` (BR-U2-15, 20, 24): each hop through `… from 'S'` resolves `S` from the hop's
 *   file — File → continue, Package or no File node → no File edge for that name, unresolved / revisited / deeper
 *   than `maxBarrelDepth` / unresolvable name → the module file. Namespace and side-effect imports go to the module
 *   file; `RE_EXPORTS` is one edge to the module the statement names, not followed (BR-U2-22, 23). Dynamic
 *   `import()` calls and CommonJS require calls give no edge (FR-34). Package targets are not File edges and are
 *   dropped. One edge per (source, target, type); `isTypeOnly` is true only when every contributing occurrence is
 *   type-only; `line` is the smallest contributing statement line.
 */
import * as path from 'node:path';
import picomatch from 'picomatch';
import { Node, Project, SyntaxKind, ts } from 'ts-morph';
import type {
  ExportDeclaration,
  ImportDeclaration,
  ImportEqualsDeclaration,
  SourceFile,
  Symbol as MorphSymbol,
} from 'ts-morph';
import type { ImportGraph, ImportGraphEdge, ImportGraphFile, ProjectHandle } from './types.js';

export type { ImportGraph, ImportGraphEdge, ImportGraphFile } from './types.js';

/** Same six globs, same order, as `DEFAULT_EXCLUDE_PATTERNS` (`src/apg-extractor/types.ts`); equality is tested. */
export const IMPORT_GRAPH_EXCLUDE_PATTERNS: readonly string[] = Object.freeze([
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/*.d.ts',
  '**/*.spec.ts',
  '**/*.test.ts',
]);

/** The extractor's default barrel depth (`DEFAULT_OPTIONS.maxBarrelDepth`). */
export const IMPORT_GRAPH_MAX_BARREL_DEPTH = 10;

/** One spec layer as the builder needs it (spec wiring arrives in Step 25). */
export interface LayerDirs {
  readonly name: string;
  readonly directories: readonly string[];
  readonly filePatterns?: readonly string[];
}

export interface BuildImportGraphOptions {
  readonly maxBarrelDepth?: number;
}

/**
 * Node built-in module names, pinned as the extractor pins them (BR-U2-03; `package-node-factory.ts`
 * `NODE_BUILTIN_MODULES`), so built-in classification does not depend on the running Node version.
 */
const NODE_BUILTINS: ReadonlySet<string> = new Set([
  'assert', 'assert/strict', 'async_hooks', 'buffer', 'child_process', 'cluster',
  'console', 'constants', 'crypto', 'dgram', 'diagnostics_channel', 'dns',
  'dns/promises', 'domain', 'events', 'fs', 'fs/promises', 'http', 'http2', 'https',
  'inspector', 'inspector/promises', 'module', 'net', 'os', 'path', 'path/posix',
  'path/win32', 'perf_hooks', 'process', 'punycode', 'querystring', 'readline',
  'readline/promises', 'repl', 'stream', 'stream/consumers', 'stream/promises',
  'stream/web', 'string_decoder', 'sys', 'timers', 'timers/promises', 'tls',
  'trace_events', 'tty', 'url', 'util', 'util/types', 'v8', 'vm', 'wasi',
  'worker_threads', 'zlib',
]);

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function firstSegment(spec: string): string {
  const slash = spec.indexOf('/');
  return slash === -1 ? spec : spec.slice(0, slash);
}

function isBuiltin(specifier: string): boolean {
  if (specifier.startsWith('node:')) return true;
  return NODE_BUILTINS.has(specifier) || NODE_BUILTINS.has(firstSegment(specifier));
}

/** Absolute path → POSIX path relative to the root (the extractor's `normalizeFilePath`). */
function normalize(absolutePath: string, root: string): string {
  const prefix = root.endsWith('/') ? root : root + '/';
  const rel = absolutePath.startsWith(prefix) ? absolutePath.slice(prefix.length) : absolutePath;
  return rel.replace(/\\/g, '/');
}

function isUnderRoot(root: string, file: string): boolean {
  const rel = path.relative(root, file);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function hasNodeModulesSegment(p: string): boolean {
  return p.split(/[\\/]/).includes('node_modules');
}

// ── Alias rules (BR-U2-06, 10, 11) ──────────────────────────────────────────────────────────────────────────────

interface AliasRules {
  /** `paths` keys, longest prefix first, with "some substitution goes into node_modules". */
  readonly paths: readonly { readonly key: string; readonly intoNodeModules: boolean }[];
  readonly baseUrl: string | undefined;
}

function patternPrefix(key: string): string {
  const star = key.indexOf('*');
  return star === -1 ? key : key.slice(0, star);
}

function parseAliasRules(options: ts.CompilerOptions): AliasRules {
  const paths = options.paths ?? {};
  const keys = Object.keys(paths).sort((a, b) => patternPrefix(b).length - patternPrefix(a).length);
  return {
    paths: keys.map((key) => ({ key, intoNodeModules: (paths[key] ?? []).some(hasNodeModulesSegment) })),
    baseUrl: options.baseUrl,
  };
}

function matchesPathsKey(key: string, specifier: string): boolean {
  const star = key.indexOf('*');
  if (star === -1) return key === specifier;
  const prefix = key.slice(0, star);
  const suffix = key.slice(star + 1);
  return specifier.length >= prefix.length + suffix.length && specifier.startsWith(prefix) && specifier.endsWith(suffix);
}

function matchPaths(rules: AliasRules, specifier: string): { readonly intoNodeModules: boolean } | undefined {
  return rules.paths.find((r) => matchesPathsKey(r.key, specifier));
}

/** `@scope/name` or the first segment (Node package lookup root). */
function lookupRoot(specifier: string): string {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? specifier);
}

// ── Resolution context ──────────────────────────────────────────────────────────────────────────────────────────

interface Ctx {
  readonly root: string;
  readonly project: Project;
  readonly host: ts.ModuleResolutionHost;
  readonly options: ts.CompilerOptions;
  readonly rules: AliasRules;
  /** filePath → true for every File node. */
  readonly files: ReadonlySet<string>;
  readonly maxBarrelDepth: number;
}

/** Module-level outcome; `none` = Package target or a file without a File node (no File edge either way). */
type ModuleOutcome =
  | { readonly kind: 'file'; readonly sourceFile: SourceFile; readonly filePath: string }
  | { readonly kind: 'none' }
  | { readonly kind: 'unresolved' };

function isInstalledPackage(ctx: Ctx, fromDir: string, root: string): boolean {
  if (root === '' || ctx.host.directoryExists === undefined) return false;
  let dir = fromDir;
  for (;;) {
    if (ctx.host.directoryExists(path.join(dir, 'node_modules', root))) return true;
    const parent = path.dirname(dir);
    if (parent === dir) return false;
    dir = parent;
  }
}

function looksLikeProjectAlias(ctx: Ctx, specifier: string): boolean {
  if (matchPaths(ctx.rules, specifier) !== undefined) return true;
  if (ctx.rules.baseUrl === undefined) return false;
  const segment = specifier.split('/')[0] ?? '';
  if (segment === '') return false;
  const candidate = path.join(ctx.rules.baseUrl, segment);
  if (ctx.host.directoryExists?.(candidate) === true) return true;
  return ['', '.ts', '.tsx', '.d.ts', '.js'].some((ext) => ctx.host.fileExists(candidate + ext));
}

function asFile(ctx: Ctx, file: string): ModuleOutcome {
  const filePath = normalize(file, ctx.root);
  if (ctx.files.has(filePath)) {
    const sourceFile = ctx.project.getSourceFile(file);
    if (sourceFile !== undefined) return { kind: 'file', sourceFile, filePath };
  }
  return { kind: 'none' };
}

/** BR-U2-01, 03..13 collapsed to the File-edge question. */
function resolveModule(ctx: Ctx, specifier: string, from: SourceFile): ModuleOutcome {
  if (isBuiltin(specifier)) return { kind: 'none' };
  const resolved = ts.resolveModuleName(specifier, from.getFilePath(), ctx.options, ctx.host).resolvedModule;
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    if (resolved === undefined) return { kind: 'unresolved' };
    return asFile(ctx, resolved.resolvedFileName);
  }
  if (resolved !== undefined) {
    const file = resolved.resolvedFileName;
    if (resolved.isExternalLibraryImport === true || hasNodeModulesSegment(file)) return { kind: 'none' };
    if (isUnderRoot(ctx.root, file)) return asFile(ctx, file);
    return { kind: 'none' };
  }
  if (matchPaths(ctx.rules, specifier)?.intoNodeModules === true) return { kind: 'none' };
  if (isInstalledPackage(ctx, path.dirname(from.getFilePath()), lookupRoot(specifier))) return { kind: 'none' };
  if (looksLikeProjectAlias(ctx, specifier)) return { kind: 'unresolved' };
  return { kind: 'none' };
}

// ── Per-name barrel routing (BR-U2-24) ──────────────────────────────────────────────────────────────────────────

function importEqualsSpecifier(decl: ImportEqualsDeclaration): string | undefined {
  const ref = decl.getModuleReference();
  if (!Node.isExternalModuleReference(ref)) return undefined;
  const expr = ref.getExpression();
  return expr !== undefined && Node.isStringLiteral(expr) ? expr.getLiteralValue() : undefined;
}

function moduleSpecifierOfAlias(decl: Node): string | undefined {
  if (Node.isExportSpecifier(decl)) return decl.getExportDeclaration().getModuleSpecifierValue();
  if (Node.isNamespaceExport(decl)) return decl.getFirstAncestorByKind(SyntaxKind.ExportDeclaration)?.getModuleSpecifierValue();
  if (Node.isImportSpecifier(decl)) return decl.getImportDeclaration().getModuleSpecifierValue();
  if (Node.isImportClause(decl) || Node.isNamespaceImport(decl)) {
    return decl.getFirstAncestorByKind(SyntaxKind.ImportDeclaration)?.getModuleSpecifierValue();
  }
  if (Node.isImportEqualsDeclaration(decl)) return importEqualsSpecifier(decl);
  return undefined;
}

function aliasesWholeModule(decl: Node): boolean {
  return Node.isNamespaceExport(decl) || Node.isNamespaceImport(decl) || Node.isImportEqualsDeclaration(decl);
}

/** `file` = declaring File; `none` = Package or no File node (name dropped); `fallback` = the module file. */
type NameOutcome = { readonly kind: 'file'; readonly filePath: string } | { readonly kind: 'none' } | { readonly kind: 'fallback' };

function followExportedName(ctx: Ctx, name: string, moduleFile: SourceFile): NameOutcome {
  let sym: MorphSymbol | undefined = moduleFile.getExportSymbols().find((s) => s.getName() === name);
  let hops = 0;
  const visited = new Set<string>();
  while (sym !== undefined) {
    const decl = sym.getDeclarations()[0];
    if (decl === undefined) return { kind: 'fallback' };
    if (!sym.isAlias()) {
      const filePath = normalize(decl.getSourceFile().getFilePath(), ctx.root);
      return ctx.files.has(filePath) ? { kind: 'file', filePath } : { kind: 'fallback' };
    }
    const key = `${decl.getSourceFile().getFilePath()}:${String(decl.getStart())}`;
    if (visited.has(key)) return { kind: 'fallback' };
    visited.add(key);
    const hopSpecifier = moduleSpecifierOfAlias(decl);
    if (hopSpecifier !== undefined) {
      hops++;
      if (hops > ctx.maxBarrelDepth) return { kind: 'fallback' };
      const r = resolveModule(ctx, hopSpecifier, decl.getSourceFile());
      if (r.kind === 'none') return { kind: 'none' };
      if (r.kind === 'unresolved') return { kind: 'fallback' };
      if (aliasesWholeModule(decl)) return { kind: 'file', filePath: r.filePath };
    }
    sym = sym.getImmediatelyAliasedSymbol();
  }
  return { kind: 'fallback' };
}

// ── Statements → occurrences ────────────────────────────────────────────────────────────────────────────────────

interface Occurrence {
  readonly type: 'IMPORTS' | 'RE_EXPORTS';
  readonly target: string;
  readonly isTypeOnly: boolean;
  readonly line: number;
}

interface NameSpec {
  readonly name: string;
  readonly typeMarked: boolean;
}

function importOccurrences(ctx: Ctx, stmt: ImportDeclaration | ImportEqualsDeclaration): Occurrence[] {
  const sf = stmt.getSourceFile();
  const line = stmt.getStartLineNumber();
  const statementTypeOnly = stmt.isTypeOnly();
  const isEquals = Node.isImportEqualsDeclaration(stmt);
  const specifier = isEquals ? importEqualsSpecifier(stmt) : stmt.getModuleSpecifierValue();
  if (specifier === undefined) return [];
  const specs: NameSpec[] = [];
  if (isEquals) {
    specs.push({ name: '*', typeMarked: false });
  } else {
    if (stmt.getDefaultImport() !== undefined) specs.push({ name: 'default', typeMarked: false });
    if (stmt.getNamespaceImport() !== undefined) specs.push({ name: '*', typeMarked: false });
    for (const n of stmt.getNamedImports()) specs.push({ name: n.getName(), typeMarked: n.isTypeOnly() });
  }
  const module = resolveModule(ctx, specifier, sf);
  if (module.kind !== 'file') return [];
  if (specs.length === 0) return [{ type: 'IMPORTS', target: module.filePath, isTypeOnly: false, line }];

  const routed = new Map<string, NameSpec[]>();
  for (const spec of specs) {
    let target: string;
    if (spec.name === '*') {
      target = module.filePath;
    } else {
      const followed = followExportedName(ctx, spec.name, module.sourceFile);
      if (followed.kind === 'none') continue;
      target = followed.kind === 'file' ? followed.filePath : module.filePath;
    }
    const slot = routed.get(target);
    if (slot === undefined) routed.set(target, [spec]);
    else slot.push(spec);
  }
  return [...routed.entries()].map(([target, routedSpecs]) => ({
    type: 'IMPORTS' as const,
    target,
    isTypeOnly: statementTypeOnly || routedSpecs.every((s) => s.typeMarked),
    line,
  }));
}

function reExportOccurrences(ctx: Ctx, stmt: ExportDeclaration): Occurrence[] {
  const specifier = stmt.getModuleSpecifierValue();
  if (specifier === undefined) return [];
  const named = stmt.getNamedExports();
  const wholeModule = stmt.isNamespaceExport() || stmt.getNamespaceExport() !== undefined;
  const isTypeOnly = stmt.isTypeOnly() || (!wholeModule && named.length > 0 && named.every((n) => n.isTypeOnly()));
  const module = resolveModule(ctx, specifier, stmt.getSourceFile());
  if (module.kind !== 'file') return [];
  return [{ type: 'RE_EXPORTS', target: module.filePath, isTypeOnly, line: stmt.getStartLineNumber() }];
}

// ── Builder ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Opens a copy the way the extractor does in lenient mode (tsconfig files only, no dependency files added). */
export function openImportGraphProject(root: string, tsconfigPath: string): ProjectHandle {
  const absRoot = path.resolve(root);
  const absTsconfig = path.resolve(absRoot, tsconfigPath);
  const project = new Project({
    tsConfigFilePath: absTsconfig,
    skipAddingFilesFromTsConfig: false,
    skipFileDependencyResolution: true,
  });
  return { root: absRoot, tsconfigPath: absTsconfig, project };
}

/** True when every statement is an import or export declaration (and there is at least one). */
export function isBarrelFile(sf: SourceFile): boolean {
  const stmts = sf.getStatements();
  if (stmts.length === 0) return false;
  return stmts.every((s) => s.getKind() === SyntaxKind.ExportDeclaration || s.getKind() === SyntaxKind.ImportDeclaration);
}

/** Layer of one file path: directory globs first (layer order), then file patterns; `null` when none match. */
export function layerOf(filePath: string, layers: readonly LayerDirs[]): string | null {
  for (const l of layers) {
    if (l.directories.length > 0 && picomatch([...l.directories], { dot: true })(filePath)) return l.name;
  }
  for (const l of layers) {
    const patterns = l.filePatterns ?? [];
    if (patterns.length > 0 && picomatch([...patterns], { dot: true })(filePath)) return l.name;
  }
  return null;
}

/** File nodes and File→File `IMPORTS` / `RE_EXPORTS` edges of one prepared copy (BR-U5a-56). */
export function buildImportGraph(
  handle: ProjectHandle,
  layers: readonly LayerDirs[],
  options: BuildImportGraphOptions = {},
): ImportGraph {
  const root = handle.root.endsWith('/') && handle.root.length > 1 ? handle.root.slice(0, -1) : handle.root;
  const isExcluded = picomatch([...IMPORT_GRAPH_EXCLUDE_PATTERNS], { dot: true });
  const sourceFiles = handle.project
    .getSourceFiles()
    .filter((sf) => !isExcluded(path.relative(root, sf.getFilePath())));

  const files = new Map<string, ImportGraphFile>();
  for (const sf of sourceFiles) {
    const filePath = normalize(sf.getFilePath(), root);
    files.set(filePath, { filePath, layer: layerOf(filePath, layers), isBarrel: isBarrelFile(sf) });
  }

  const ctx: Ctx = {
    root,
    project: handle.project,
    host: handle.project.getModuleResolutionHost(),
    options: handle.project.getCompilerOptions(),
    rules: parseAliasRules(handle.project.getCompilerOptions()),
    files: new Set(files.keys()),
    maxBarrelDepth: options.maxBarrelDepth ?? IMPORT_GRAPH_MAX_BARREL_DEPTH,
  };

  const slots = new Map<string, { source: string; target: string; type: ImportGraphEdge['type']; typeOnly: boolean; line: number }>();
  for (const sf of sourceFiles) {
    const source = normalize(sf.getFilePath(), root);
    for (const stmt of sf.getStatements()) {
      let occurrences: Occurrence[];
      if (Node.isImportDeclaration(stmt)) occurrences = importOccurrences(ctx, stmt);
      else if (Node.isImportEqualsDeclaration(stmt)) occurrences = importOccurrences(ctx, stmt);
      else if (Node.isExportDeclaration(stmt)) occurrences = reExportOccurrences(ctx, stmt);
      else continue;
      for (const occ of occurrences) {
        const key = `${occ.type}\u0000${source}\u0000${occ.target}`;
        const slot = slots.get(key);
        if (slot === undefined) {
          slots.set(key, { source, target: occ.target, type: occ.type, typeOnly: occ.isTypeOnly, line: occ.line });
        } else {
          slot.typeOnly = slot.typeOnly && occ.isTypeOnly;
          slot.line = Math.min(slot.line, occ.line);
        }
      }
    }
  }

  const edges: ImportGraphEdge[] = [...slots.values()]
    .map((s) => ({ source: s.source, target: s.target, type: s.type, isTypeOnly: s.typeOnly, line: s.line }))
    .sort((a, b) => cmp(a.source, b.source) || cmp(a.target, b.target) || cmp(a.type, b.type));
  const sortedFiles = new Map([...files.entries()].sort((a, b) => cmp(a[0], b[0])));
  return { files: sortedFiles, edges };
}
