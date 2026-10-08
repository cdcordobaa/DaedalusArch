/**
 * Import resolution (FR-v1.2E-09, ADR-015 item 7).
 *
 * Module-level resolution of one specifier from one source file, following the
 * decision list of `business-logic-model.md` §3.1 (first match wins): built-in →
 * relative → alias or bare through `ts.resolveModuleName` (D-U2-3) → `paths`
 * rule into `node_modules` → installed package → looks like a project alias →
 * bare Package. Shapes follow `domain-entities.md` §2.1–2.3 and §2.5.
 */
import { dirname, isAbsolute, join, relative } from 'node:path';
import { ts } from 'ts-morph';
import type { Project, SourceFile } from 'ts-morph';
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
