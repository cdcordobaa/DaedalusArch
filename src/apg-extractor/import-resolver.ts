/**
 * Import resolution (FR-v1.2E-09, FR-v1.2E-10, FR-v1.2E-34, ADR-015 item 7).
 *
 * Module-level resolution of one specifier from one source file, following the
 * decision list of `business-logic-model.md` §3.1 (first match wins): built-in →
 * relative → alias or bare through `ts.resolveModuleName` (D-U2-3) → `paths`
 * rule into `node_modules` → installed package → looks like a project alias →
 * bare Package. Statement-level resolution (§3.2 per-name barrel routing, §3.3
 * re-exports) turns each statement into occurrences and one partition outcome
 * (§6). Shapes follow `domain-entities.md` §2.1–2.5.
 */
import { dirname, isAbsolute, join, relative } from 'node:path';
import { Node, SyntaxKind, ts } from 'ts-morph';
import type {
  ExportDeclaration, ImportDeclaration, ImportEqualsDeclaration, Project, SourceFile, Symbol as MorphSymbol,
} from 'ts-morph';
import type { ExtractorOptions, NodeLookup } from './types.js';
import { DEFAULT_OPTIONS } from './types.js';
import { normalizeFilePath } from './id-generator.js';
import {
  builtinRoot,
  isBuiltinSpecifier,
  packageRootFromAliasKey,
  packageRootFromBaseUrlSpecifier,
  packageRootFromNodeModulesPath,
  packageRootFromSpecifier,
} from './package-node-factory.js';
import type { PackageNodeRegistry, PackageRoot } from './package-node-factory.js';
import type { ImportOccurrence } from './import-edge-merger.js';

// ── Entities ─────────────────────────────────────────────────────────────────

/** `domain-entities.md` §2.1 (BR-U2-01). */
export type SpecifierClass = 'relative' | 'alias-or-bare' | 'node-builtin';

/** Result of resolving one module specifier from one source file (`domain-entities.md` §2.2). */
export type ModuleResolution =
  | { readonly kind: 'project-file'; readonly sourceFile: SourceFile; readonly fileNodeId: string }
  | { readonly kind: 'no-file-node'; readonly reason: 'excluded-or-skipped' | 'outside-root' }
  | { readonly kind: 'package'; readonly root: PackageRoot; readonly outOfRootAlias: boolean }
  | { readonly kind: 'unresolved' };

/** One `compilerOptions.paths` key or the `baseUrl` (`domain-entities.md` §2.5). */
export interface AliasRule {
  readonly kind: 'paths' | 'baseUrl';
  /** The `paths` key as written (`@app/*`, `~/*`), or the absolute `baseUrl` directory. */
  readonly key: string;
  /** Any substitution contains a `node_modules` path segment (ADR-015 item 7). */
  readonly targetsIntoNodeModules: boolean;
}

export type AddWarning = (filePath: string, code: string, message: string) => void;

/** `domain-entities.md` §2.5. Internal to C1. */
export interface ImportResolutionContext {
  readonly lookup: NodeLookup;
  /** Absolute, no trailing slash. */
  readonly projectRoot: string;
  readonly maxBarrelDepth: number;
  readonly addWarning: AddWarning;
  readonly compilerOptions: ts.CompilerOptions;
  readonly aliasRules: readonly AliasRule[];
  readonly packages: PackageNodeRegistry;
  /** `node_modules/<root>` exists in `fromDir` or an ancestor (Node lookup semantics). */
  readonly isInstalledPackage: (fromDir: string, root: string) => boolean;
  readonly project: Project;
  readonly host: ts.ModuleResolutionHost;
}

// ── Classification (BR-U2-01) ────────────────────────────────────────────────

export function classifySpecifier(specifier: string): SpecifierClass {
  if (isBuiltinSpecifier(specifier)) return 'node-builtin';
  if (specifier.startsWith('.') || specifier.startsWith('/')) return 'relative';
  return 'alias-or-bare';
}

// ── Context ──────────────────────────────────────────────────────────────────

function hasNodeModulesSegment(path: string): boolean {
  return path.split(/[\\/]/).includes('node_modules');
}

/** Parses `paths` keys (longest prefix first, TypeScript's matching order) and `baseUrl`. */
export function parseAliasRules(options: ts.CompilerOptions): AliasRule[] {
  const rules: AliasRule[] = [];
  const paths = options.paths ?? {};
  const keys = Object.keys(paths).sort((a, b) => patternPrefix(b).length - patternPrefix(a).length);
  for (const key of keys) {
    const substitutions = paths[key] ?? [];
    rules.push({ kind: 'paths', key, targetsIntoNodeModules: substitutions.some(hasNodeModulesSegment) });
  }
  if (options.baseUrl !== undefined) {
    rules.push({ kind: 'baseUrl', key: options.baseUrl, targetsIntoNodeModules: false });
  }
  return rules;
}

function patternPrefix(key: string): string {
  const star = key.indexOf('*');
  return star === -1 ? key : key.slice(0, star);
}

function matchesPathsKey(key: string, specifier: string): boolean {
  const star = key.indexOf('*');
  if (star === -1) return key === specifier;
  const prefix = key.slice(0, star);
  const suffix = key.slice(star + 1);
  return specifier.length >= prefix.length + suffix.length
    && specifier.startsWith(prefix) && specifier.endsWith(suffix);
}

/** The first (longest-prefix) `paths` rule whose key matches the specifier. */
function matchPathsRule(rules: readonly AliasRule[], specifier: string): AliasRule | undefined {
  return rules.find(r => r.kind === 'paths' && matchesPathsKey(r.key, specifier));
}

function baseUrlRule(rules: readonly AliasRule[]): AliasRule | undefined {
  return rules.find(r => r.kind === 'baseUrl');
}

/** Root used for the installed-package lookup: `@scope/name` or the first segment. */
function lookupRoot(specifier: string): string {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? specifier);
}

/** Builds `isInstalledPackage` on the module-resolution host, so in-memory tests can model `node_modules`. */
export function makeIsInstalledPackage(host: ts.ModuleResolutionHost): (fromDir: string, root: string) => boolean {
  return (fromDir: string, root: string): boolean => {
    if (root === '' || host.directoryExists === undefined) return false;
    let dir = fromDir;
    for (;;) {
      if (host.directoryExists(join(dir, 'node_modules', root))) return true;
      const parent = dirname(dir);
      if (parent === dir) return false;
      dir = parent;
    }
  };
}

export function buildImportResolutionContext(
  project: Project,
  lookup: NodeLookup,
  projectRoot: string,
  opts: ExtractorOptions,
  addWarning: AddWarning,
  packages: PackageNodeRegistry,
): ImportResolutionContext {
  const compilerOptions = project.getCompilerOptions();
  const host = project.getModuleResolutionHost();
  const root = projectRoot.endsWith('/') && projectRoot.length > 1 ? projectRoot.slice(0, -1) : projectRoot;
  return {
    lookup,
    projectRoot: root,
    maxBarrelDepth: opts.maxBarrelDepth ?? DEFAULT_OPTIONS.maxBarrelDepth,
    addWarning,
    compilerOptions,
    aliasRules: parseAliasRules(compilerOptions),
    packages,
    isInstalledPackage: makeIsInstalledPackage(host),
    project,
    host,
  };
}

// ── Module resolution (business-logic-model.md §3.1) ─────────────────────────

function isUnderRoot(root: string, file: string): boolean {
  const rel = relative(root, file);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

/** Package name for an alias or bare specifier: BR-U2-05, else BR-U2-06 (paths key, else baseUrl first segment). */
function packageRootForSpecifier(specifier: string, rules: readonly AliasRule[]): PackageRoot {
  const shaped = packageRootFromSpecifier(specifier);
  if (shaped !== undefined) return shaped;
  const rule = matchPathsRule(rules, specifier);
  if (rule !== undefined) return packageRootFromAliasKey(rule.key);
  return packageRootFromBaseUrlSpecifier(specifier);
}

/** BR-U2-11: matches a `paths` pattern, or `baseUrl` is set and its first segment names an existing file or directory under it. */
function looksLikeProjectAlias(specifier: string, ctx: ImportResolutionContext): boolean {
  if (matchPathsRule(ctx.aliasRules, specifier) !== undefined) return true;
  const base = baseUrlRule(ctx.aliasRules);
  if (base === undefined) return false;
  const segment = specifier.split('/')[0] ?? '';
  if (segment === '') return false;
  const candidate = join(base.key, segment);
  if (ctx.host.directoryExists?.(candidate) === true) return true;
  return ['', '.ts', '.tsx', '.d.ts', '.js'].some(ext => ctx.host.fileExists(candidate + ext));
}

function fileResolution(file: string, ctx: ImportResolutionContext): ModuleResolution {
  const fileNodeId = ctx.lookup.fileNodes.get(normalizeFilePath(file, ctx.projectRoot));
  if (fileNodeId !== undefined) {
    const sourceFile = ctx.project.getSourceFile(file);
    if (sourceFile !== undefined) return { kind: 'project-file', sourceFile, fileNodeId };
  }
  return { kind: 'no-file-node', reason: isUnderRoot(ctx.projectRoot, file) ? 'excluded-or-skipped' : 'outside-root' };
}

export interface ResolveModuleOptions {
  /** When false, an unresolved specifier emits no `EXTRACTOR_002` (S-9a barrel hops). Default true. */
  readonly warnUnresolved?: boolean;
}

/**
 * Resolves one specifier from one source file (BR-U2-01, 03..13). Emits
 * `EXTRACTOR_002` for an unresolved specifier (unless suppressed) and
 * `EXTRACTOR_008` for a file without a File node, attributed to `fromSourceFile`.
 */
export function resolveModule(
  specifier: string,
  fromSourceFile: SourceFile,
  ctx: ImportResolutionContext,
  options: ResolveModuleOptions = {},
): ModuleResolution {
  const fromPath = normalizeFilePath(fromSourceFile.getFilePath(), ctx.projectRoot);
  const result = resolveModuleSilently(specifier, fromSourceFile, ctx);
  if (result.kind === 'unresolved' && options.warnUnresolved !== false) {
    ctx.addWarning(fromPath, 'EXTRACTOR_002', `Unresolvable import: ${specifier}`);
  } else if (result.kind === 'no-file-node') {
    ctx.addWarning(fromPath, 'EXTRACTOR_008', `Import target outside the extracted set: ${specifier}`);
  }
  return result;
}

function resolveModuleSilently(specifier: string, fromSourceFile: SourceFile, ctx: ImportResolutionContext): ModuleResolution {
  const cls = classifySpecifier(specifier);

  // 1. Built-in (BR-U2-03, 04).
  if (cls === 'node-builtin') return { kind: 'package', root: builtinRoot(specifier), outOfRootAlias: false };

  const resolved = ts.resolveModuleName(specifier, fromSourceFile.getFilePath(), ctx.compilerOptions, ctx.host).resolvedModule;

  // 2. Relative (BR-U2-09 S-4, 12, 13).
  if (cls === 'relative') {
    if (resolved === undefined) return { kind: 'unresolved' };
    const file = resolved.resolvedFileName;
    const asFile = fileResolution(file, ctx);
    if (asFile.kind === 'project-file') return asFile;
    if (hasNodeModulesSegment(file)) {
      const root = packageRootFromNodeModulesPath(file);
      if (root !== undefined) return { kind: 'package', root, outOfRootAlias: false };
    }
    return asFile;
  }

  // 3. Alias or bare (BR-U2-05..11).
  if (resolved !== undefined) {
    const file = resolved.resolvedFileName;
    if (resolved.isExternalLibraryImport === true || hasNodeModulesSegment(file)) {
      return { kind: 'package', root: packageRootForSpecifier(specifier, ctx.aliasRules), outOfRootAlias: false };
    }
    if (isUnderRoot(ctx.projectRoot, file)) return fileResolution(file, ctx);
    const viaAlias = matchPathsRule(ctx.aliasRules, specifier) !== undefined || baseUrlRule(ctx.aliasRules) !== undefined;
    return { kind: 'package', root: packageRootForSpecifier(specifier, ctx.aliasRules), outOfRootAlias: viaAlias };
  }
  if (matchPathsRule(ctx.aliasRules, specifier)?.targetsIntoNodeModules === true) {
    return { kind: 'package', root: packageRootForSpecifier(specifier, ctx.aliasRules), outOfRootAlias: false };
  }
  if (ctx.isInstalledPackage(dirname(fromSourceFile.getFilePath()), lookupRoot(specifier))) {
    return { kind: 'package', root: packageRootForSpecifier(specifier, ctx.aliasRules), outOfRootAlias: false };
  }
  if (looksLikeProjectAlias(specifier, ctx)) return { kind: 'unresolved' };
  return { kind: 'package', root: packageRootForSpecifier(specifier, ctx.aliasRules), outOfRootAlias: false };
}

// ── Statement resolution (business-logic-model.md §3.2, §3.3, §6) ────────────

/** The single partition counter a statement increments (`domain-entities.md` §2.3, BR-U2-14). */
export type StatementOutcome = 'resolvedInternal' | 'external' | 'droppedNoFileNode' | 'unresolved';

export interface StatementResolution {
  /** In emission order (BR-U2-15). */
  readonly occurrences: readonly ImportOccurrence[];
  readonly outcome: StatementOutcome;
  /** The statement's own specifier was an out-of-root alias and the outcome is `external` (BR-U2-08, 14). */
  readonly outOfRootAlias: boolean;
}

type OccurrenceTarget = ImportOccurrence['target'];

/** Result of following one exported name to its declaring file. */
type NameTarget =
  | { readonly kind: 'target'; readonly target: OccurrenceTarget }
  | { readonly kind: 'dropped' }
  | { readonly kind: 'fallback' };

function sourceFileNodeIdOf(sf: SourceFile, ctx: ImportResolutionContext): string {
  const id = ctx.lookup.fileNodes.get(normalizeFilePath(sf.getFilePath(), ctx.projectRoot));
  if (id === undefined) throw new Error('import-resolver: statement in a file without a File node');
  return id;
}

function targetKey(target: OccurrenceTarget, ctx: ImportResolutionContext): string {
  return target.kind === 'file' ? `file:${target.fileNodeId}` : `package:${ctx.packages.getOrCreate(target.root).id}`;
}

/** Precedence for split statements: File > Package > dropped (BR-U2-14). */
function outcomeOf(occurrences: readonly ImportOccurrence[]): StatementOutcome {
  if (occurrences.some(o => o.target.kind === 'file')) return 'resolvedInternal';
  if (occurrences.some(o => o.target.kind === 'package')) return 'external';
  return 'droppedNoFileNode';
}

/** Module specifier of the import or export statement an alias declaration belongs to, if any. */
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

/** The alias stands for a whole module (`* as ns`, `import x = require()`), not for one of its names. */
function aliasesWholeModule(decl: Node): boolean {
  return Node.isNamespaceExport(decl) || Node.isNamespaceImport(decl) || Node.isImportEqualsDeclaration(decl);
}

/** String specifier of `import x = require('m')`; `undefined` for `import x = N.M`. */
export function importEqualsSpecifier(decl: ImportEqualsDeclaration): string | undefined {
  const ref = decl.getModuleReference();
  if (!Node.isExternalModuleReference(ref)) return undefined;
  const expr = ref.getExpression();
  return expr !== undefined && Node.isStringLiteral(expr) ? expr.getLiteralValue() : undefined;
}

function fileTargetOf(sf: SourceFile, ctx: ImportResolutionContext): OccurrenceTarget | undefined {
  const fileNodeId = ctx.lookup.fileNodes.get(normalizeFilePath(sf.getFilePath(), ctx.projectRoot));
  return fileNodeId === undefined ? undefined : { kind: 'file', fileNodeId };
}

/**
 * Follows one exported name of module file M hop by hop with
 * `getImmediatelyAliasedSymbol()` (BR-U2-24). Each hop through an import or
 * `export … from 'S'` statement classifies `S` from the hop's file (S-9a):
 * project File → continue; Package → Package target; no File node → dropped
 * (`EXTRACTOR_008`); unresolved → fall back to M, no extra warning. More hops
 * than `maxBarrelDepth` → `EXTRACTOR_006`, a revisited alias declaration →
 * `EXTRACTOR_007`; both fall back to M, as does a name the chain cannot resolve.
 */
function followExportedName(
  name: string,
  moduleFile: SourceFile,
  specifier: string,
  warnFile: string,
  ctx: ImportResolutionContext,
): NameTarget {
  let sym: MorphSymbol | undefined = moduleFile.getExportSymbols().find(s => s.getName() === name);
  let hops = 0;
  const visited = new Set<string>();
  while (sym !== undefined) {
    const decl = sym.getDeclarations()[0];
    if (decl === undefined) return { kind: 'fallback' };
    if (!sym.isAlias()) {
      const target = fileTargetOf(decl.getSourceFile(), ctx);
      return target === undefined ? { kind: 'fallback' } : { kind: 'target', target };
    }
    const key = `${decl.getSourceFile().getFilePath()}:${String(decl.getStart())}`;
    if (visited.has(key)) {
      ctx.addWarning(warnFile, 'EXTRACTOR_007', `Circular barrel chain detected: ${specifier}`);
      return { kind: 'fallback' };
    }
    visited.add(key);
    const hopSpecifier = moduleSpecifierOfAlias(decl);
    if (hopSpecifier !== undefined) {
      hops++;
      if (hops > ctx.maxBarrelDepth) {
        ctx.addWarning(warnFile, 'EXTRACTOR_006', `Barrel resolution depth exceeded: ${specifier}`);
        return { kind: 'fallback' };
      }
      const r = resolveModule(hopSpecifier, decl.getSourceFile(), ctx, { warnUnresolved: false });
      if (r.kind === 'package') return { kind: 'target', target: { kind: 'package', root: r.root } };
      if (r.kind === 'no-file-node') return { kind: 'dropped' };
      if (r.kind === 'unresolved') return { kind: 'fallback' };
      if (aliasesWholeModule(decl)) return { kind: 'target', target: { kind: 'file', fileNodeId: r.fileNodeId } };
    }
    sym = sym.getImmediatelyAliasedSymbol();
  }
  return { kind: 'fallback' };
}

interface NameSpec {
  /** Exported-name form (Q8 A): `default`, `*`, or `A` for `{ A as B }`. */
  readonly name: string;
  readonly typeMarked: boolean;
}

/** Specifiers of an import declaration in source order. */
function importNameSpecs(decl: ImportDeclaration): NameSpec[] {
  const specs: NameSpec[] = [];
  if (decl.getDefaultImport() !== undefined) specs.push({ name: 'default', typeMarked: false });
  if (decl.getNamespaceImport() !== undefined) specs.push({ name: '*', typeMarked: false });
  for (const n of decl.getNamedImports()) specs.push({ name: n.getName(), typeMarked: n.isTypeOnly() });
  return specs;
}

function allTypeMarked(specs: readonly NameSpec[]): boolean {
  return specs.length > 0 && specs.every(s => s.typeMarked);
}

/**
 * IMPORTS occurrences of one import declaration or `import x = require()`
 * (BR-U2-15, 16, 20, 21, 24; S-9b) and the statement's partition outcome.
 */
export function resolveImportTargets(
  statement: ImportDeclaration | ImportEqualsDeclaration,
  ctx: ImportResolutionContext,
): StatementResolution {
  const sf = statement.getSourceFile();
  const sourceFileNodeId = sourceFileNodeIdOf(sf, ctx);
  const warnFile = normalizeFilePath(sf.getFilePath(), ctx.projectRoot);
  const line = statement.getStartLineNumber();
  const statementTypeOnly = statement.isTypeOnly();
  const isEquals = Node.isImportEqualsDeclaration(statement);
  const specifier = isEquals ? importEqualsSpecifier(statement) : statement.getModuleSpecifierValue();
  if (specifier === undefined) throw new Error('import-resolver: import-equals without a module reference');
  // `import x = require()` is a static import of the whole module (S-9b).
  const specs = isEquals ? [{ name: '*', typeMarked: false }] : importNameSpecs(statement);

  const occurrence = (target: OccurrenceTarget, names: readonly string[], isTypeOnly: boolean): ImportOccurrence => ({
    edgeType: 'IMPORTS', sourceFileNodeId, target, specifier, line, names, isTypeOnly,
  });

  const resolution = resolveModule(specifier, sf, ctx);
  switch (resolution.kind) {
    case 'unresolved':
      return { occurrences: [], outcome: 'unresolved', outOfRootAlias: false };
    case 'no-file-node':
      return { occurrences: [], outcome: 'droppedNoFileNode', outOfRootAlias: false };
    case 'package': {
      const names = specs.map(s => s.name);
      const occ = occurrence({ kind: 'package', root: resolution.root }, names, statementTypeOnly || allTypeMarked(specs));
      return { occurrences: [occ], outcome: 'external', outOfRootAlias: resolution.outOfRootAlias };
    }
    case 'project-file':
      break;
  }

  const moduleTarget: OccurrenceTarget = { kind: 'file', fileNodeId: resolution.fileNodeId };
  if (specs.length === 0) {
    // Side-effect import: one occurrence to M, no names, never type-only (BR-U2-20, 21).
    return { occurrences: [occurrence(moduleTarget, [], false)], outcome: 'resolvedInternal', outOfRootAlias: false };
  }

  const routed = new Map<string, { target: OccurrenceTarget; specs: NameSpec[] }>();
  for (const spec of specs) {
    let target: OccurrenceTarget | undefined;
    if (spec.name === '*') {
      target = moduleTarget;
    } else {
      const followed = followExportedName(spec.name, resolution.sourceFile, specifier, warnFile, ctx);
      if (followed.kind === 'dropped') continue;
      target = followed.kind === 'target' ? followed.target : moduleTarget;
    }
    const key = targetKey(target, ctx);
    const slot = routed.get(key);
    if (slot === undefined) routed.set(key, { target, specs: [spec] });
    else slot.specs.push(spec);
  }

  const occurrences = [...routed.values()].map(({ target, specs: routedSpecs }) =>
    occurrence(target, routedSpecs.map(s => s.name), statementTypeOnly || allTypeMarked(routedSpecs)));
  return { occurrences, outcome: outcomeOf(occurrences), outOfRootAlias: false };
}

/**
 * RE_EXPORTS occurrence of one `export … from 'S'` statement: one occurrence to
 * the module it names, not followed further (BR-U2-22, 23; S-3).
 */
export function resolveReExportTargets(statement: ExportDeclaration, ctx: ImportResolutionContext): StatementResolution {
  const specifier = statement.getModuleSpecifierValue();
  if (specifier === undefined) throw new Error('import-resolver: export declaration without a module specifier');
  const sf = statement.getSourceFile();
  const sourceFileNodeId = sourceFileNodeIdOf(sf, ctx);
  const named = statement.getNamedExports();
  const wholeModule = statement.isNamespaceExport() || statement.getNamespaceExport() !== undefined;
  const names = wholeModule ? ['*'] : named.map(n => n.getName());
  const isTypeOnly = statement.isTypeOnly() || (!wholeModule && named.length > 0 && named.every(n => n.isTypeOnly()));

  const resolution = resolveModule(specifier, sf, ctx);
  let target: OccurrenceTarget;
  switch (resolution.kind) {
    case 'unresolved':
      return { occurrences: [], outcome: 'unresolved', outOfRootAlias: false };
    case 'no-file-node':
      return { occurrences: [], outcome: 'droppedNoFileNode', outOfRootAlias: false };
    case 'package':
      target = { kind: 'package', root: resolution.root };
      break;
    case 'project-file':
      target = { kind: 'file', fileNodeId: resolution.fileNodeId };
      break;
  }
  const occ: ImportOccurrence = {
    edgeType: 'RE_EXPORTS', sourceFileNodeId, target, specifier, line: statement.getStartLineNumber(), names, isTypeOnly,
  };
  return {
    occurrences: [occ],
    outcome: outcomeOf([occ]),
    outOfRootAlias: resolution.kind === 'package' && resolution.outOfRootAlias,
  };
}

/**
 * `import()` and `require()` call occurrences in one file (BR-U2-25). Import-equals
 * declarations, `import('x').T` type references and `require.resolve()` are not calls
 * of this form and are not counted.
 */
export function countUnsupportedDynamicImports(sf: SourceFile): number {
  let count = 0;
  for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const callee = call.getExpression();
    if (callee.getKind() === SyntaxKind.ImportKeyword) count++;
    else if (Node.isIdentifier(callee) && callee.getText() === 'require') count++;
  }
  return count;
}
