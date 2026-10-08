/**
 * U2 scout import probe (ADR-016 h, former OI-7).
 *
 * Read-only. Builds a ts-morph Project the way `extractAPG` does
 * (`src/apg-extractor/apg-extractor.ts`: tsconfig.json of the project, lenient
 * mode = `skipFileDependencyResolution: true`, DEFAULT_EXCLUDE_PATTERNS matched
 * against the path relative to the project) and counts, per project, how its
 * import statements classify under `ts.resolveModuleName` with the project's
 * compiler options and module-resolution host (the call fixed by D-U2-3).
 *
 * Self-contained on purpose: it imports nothing from `src/`, so it measures the
 * extractor's inputs, not U2's output.
 *
 * Usage (from the repository root):
 *   npx tsx "Docs/DiagnosticRuns /u2-import-probe/probe-imports.ts" \
 *     [--json <file>] [--md <file>] <projectPath> [<projectPath> ...]
 * Without --json / --md the JSON is printed to stdout. The output holds no
 * absolute path and no timestamp, so a re-run over unchanged inputs is
 * byte-identical.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { join, relative, resolve, isAbsolute, sep } from 'node:path';
import { Node, Project, SyntaxKind, ts } from 'ts-morph';
import type { SourceFile } from 'ts-morph';
import picomatch from 'picomatch';

// Copied literally from src/apg-extractor/types.ts (DEFAULT_EXCLUDE_PATTERNS).
const DEFAULT_EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/*.d.ts',
  '**/*.spec.ts',
  '**/*.test.ts',
];

// Bare built-in names only: `_`-prefixed and `node:`-only entries (`node:test`,
// `node:sqlite`, `node:sea`, ...) are left out, so `test/x` stays an alias/bare specifier.
const BUILTINS = new Set(builtinModules.filter(m => !m.startsWith('_') && !m.startsWith('node:')));

/** Classes of one static import statement (import declaration or `import x = require()`). */
type ImportClass =
  | 'relativeInProject'
  | 'relativeOutsideRoot'
  | 'relativeUnresolved'
  | 'aliasInProject'
  | 'aliasOutsideRoot'
  | 'nodeModules'
  | 'unresolvedBare'
  | 'builtin';

interface ProjectRow {
  project: string;
  gitHead: string;
  gitStatusLines: number;
  files: number;
  importStatements: number;
  relativeInProject: number;
  aliasInProject: number;
  aliasOutsideRoot: number;
  nodeModules: number;
  unresolvedBare: number;
  builtin: number;
  typeOnlyStatements: number;
  repeatedPairs: number;
  exportFrom: number;
  // Supplementary columns (not in the FD plan Section 3 table).
  relativeOutsideRoot: number;
  relativeUnresolved: number;
  nodeModulesJsOnly: number;
  typeOnlyInclAllNamed: number;
  repeatedMergePairs: number;
  exportFromByClass: Record<ImportClass, number>;
  dynamicImportCalls: number;
  requireCalls: number;
  nullableUnionInstanceFields: number;
  hasPaths: boolean;
  hasBaseUrl: boolean;
}

function isRelative(spec: string): boolean {
  return spec === '.' || spec === '..' || spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('/');
}

function isBuiltin(spec: string): boolean {
  if (spec.startsWith('node:')) return true;
  return BUILTINS.has(spec) || BUILTINS.has(spec.split('/')[0] ?? '');
}

/** Package root of a bare specifier: `@scope/name/sub` -> `@scope/name`, `name/sub` -> `name`. */
function packageRoot(spec: string): string {
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? spec);
}

function isUnder(root: string, file: string): boolean {
  const rel = relative(root, file);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

function inNodeModules(file: string): boolean {
  return file.split(/[\\/]/).includes('node_modules');
}

function git(cwd: string, args: string[]): string {
  try {
    return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

function emptyByClass(): Record<ImportClass, number> {
  return {
    relativeInProject: 0, relativeOutsideRoot: 0, relativeUnresolved: 0,
    aliasInProject: 0, aliasOutsideRoot: 0, nodeModules: 0, unresolvedBare: 0, builtin: 0,
  };
}

function probeProject(projectArg: string): ProjectRow {
  const root = resolve(projectArg);
  const tsconfigPath = join(root, 'tsconfig.json');
  const project = new Project(existsSync(tsconfigPath)
    ? { tsConfigFilePath: tsconfigPath, skipAddingFilesFromTsConfig: false, skipFileDependencyResolution: true }
    : { skipFileDependencyResolution: true });
  if (!existsSync(tsconfigPath)) project.addSourceFilesAtPaths(join(root, '**/*.ts'));

  const isExcluded = picomatch(DEFAULT_EXCLUDE_PATTERNS, { dot: true });
  const sourceFiles = project.getSourceFiles()
    .filter(sf => !isExcluded(relative(root, sf.getFilePath())))
    .sort((a, b) => (a.getFilePath() < b.getFilePath() ? -1 : a.getFilePath() > b.getFilePath() ? 1 : 0));

  const options = project.getCompilerOptions();
  const host = project.getModuleResolutionHost();

  const classify = (spec: string, from: SourceFile): { cls: ImportClass; target: string; mergeKey: string; jsOnly: boolean } => {
    if (!isRelative(spec) && isBuiltin(spec)) {
      const pkg = `package:${spec.replace(/^node:/, '').split('/')[0]}`;
      return { cls: 'builtin', target: pkg, mergeKey: pkg, jsOnly: false };
    }
    const resolved = ts.resolveModuleName(spec, from.getFilePath(), options, host).resolvedModule;
    if (isRelative(spec)) {
      if (!resolved) return { cls: 'relativeUnresolved', target: `unresolved:${spec}`, mergeKey: `unresolved:${spec}`, jsOnly: false };
      const file = resolve(resolved.resolvedFileName);
      if (inNodeModules(file) || resolved.isExternalLibraryImport) return { cls: 'nodeModules', target: `file:${file}`, mergeKey: `nm:${file}`, jsOnly: false };
      return { cls: isUnder(root, file) ? 'relativeInProject' : 'relativeOutsideRoot', target: `file:${file}`, mergeKey: `file:${file}`, jsOnly: false };
    }
    if (!resolved) return { cls: 'unresolvedBare', target: `package:${packageRoot(spec)}`, mergeKey: `package:${packageRoot(spec)}`, jsOnly: false };
    const file = resolve(resolved.resolvedFileName);
    const jsOnly = /\.(c|m)?jsx?$/.test(file);
    if (resolved.isExternalLibraryImport || inNodeModules(file)) return { cls: 'nodeModules', target: `file:${file}`, mergeKey: `package:${packageRoot(spec)}`, jsOnly };
    return { cls: isUnder(root, file) ? 'aliasInProject' : 'aliasOutsideRoot', target: `file:${file}`, mergeKey: `file:${file}`, jsOnly: false };
  };

  const counts = emptyByClass();
  const exportFromByClass = emptyByClass();
  let importStatements = 0;
  let typeOnlyStatements = 0;
  let typeOnlyInclAllNamed = 0;
  let repeatedMergePairs = 0;
  let nodeModulesJsOnly = 0;
  let repeatedPairs = 0;
  let exportFrom = 0;
  let dynamicImportCalls = 0;
  let requireCalls = 0;
  let nullableUnionInstanceFields = 0;

  for (const sf of sourceFiles) {
    const pairCounts = new Map<string, number>();
    const mergeCounts = new Map<string, number>();
    const record = (spec: string, typeOnly: false | 'declaration' | 'allNamed'): void => {
      const { cls, target, mergeKey, jsOnly } = classify(spec, sf);
      importStatements++;
      counts[cls]++;
      if (jsOnly) nodeModulesJsOnly++;
      if (typeOnly === 'declaration') typeOnlyStatements++;
      if (typeOnly) typeOnlyInclAllNamed++;
      pairCounts.set(target, (pairCounts.get(target) ?? 0) + 1);
      mergeCounts.set(mergeKey, (mergeCounts.get(mergeKey) ?? 0) + 1);
    };

    for (const stmt of sf.getStatements()) {
      if (Node.isImportDeclaration(stmt)) {
        const named = stmt.getNamedImports();
        const typeOnly = stmt.isTypeOnly() ? 'declaration' as const : (
          named.length > 0 && named.every(n => n.isTypeOnly())
          && stmt.getDefaultImport() === undefined && stmt.getNamespaceImport() === undefined
        ) ? 'allNamed' as const : false;
        record(stmt.getModuleSpecifierValue(), typeOnly);
      } else if (Node.isImportEqualsDeclaration(stmt)) {
        const ref = stmt.getModuleReference();
        if (Node.isExternalModuleReference(ref)) {
          const expr = ref.getExpression();
          if (expr && Node.isStringLiteral(expr)) record(expr.getLiteralValue(), stmt.isTypeOnly() ? 'declaration' : false);
        }
      } else if (Node.isExportDeclaration(stmt)) {
        const spec = stmt.getModuleSpecifierValue();
        if (spec !== undefined) {
          exportFrom++;
          exportFromByClass[classify(spec, sf).cls]++;
        }
      }
    }
    for (const n of pairCounts.values()) if (n > 1) repeatedPairs++;
    for (const n of mergeCounts.values()) if (n > 1) repeatedMergePairs++;

    for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const callee = call.getExpression();
      if (callee.getKind() === SyntaxKind.ImportKeyword) dynamicImportCalls++;
      else if (Node.isIdentifier(callee) && callee.getText() === 'require') requireCalls++;
    }

    for (const cls of sf.getDescendantsOfKind(SyntaxKind.ClassDeclaration)) {
      const isNullableUnion = (typeNode: Node | undefined): boolean =>
        typeNode !== undefined && Node.isUnionTypeNode(typeNode)
        && typeNode.getTypeNodes().some(t => Node.isLiteralTypeNode(t) && t.getLiteral().getKind() === SyntaxKind.NullKeyword);
      for (const prop of cls.getProperties()) {
        if (!prop.isStatic() && isNullableUnion(prop.getTypeNode())) nullableUnionInstanceFields++;
      }
      for (const ctor of cls.getConstructors()) {
        for (const p of ctor.getParameters()) {
          if (p.isParameterProperty() && isNullableUnion(p.getTypeNode())) nullableUnionInstanceFields++;
        }
      }
    }
  }

  return {
    project: projectArg.split(sep).join('/'),
    gitHead: git(root, ['rev-parse', 'HEAD']).trim(),
    gitStatusLines: git(root, ['status', '--porcelain']).split('\n').filter(l => l.length > 0).length,
    files: sourceFiles.length,
    importStatements,
    relativeInProject: counts.relativeInProject,
    aliasInProject: counts.aliasInProject,
    aliasOutsideRoot: counts.aliasOutsideRoot,
    nodeModules: counts.nodeModules,
    unresolvedBare: counts.unresolvedBare,
    builtin: counts.builtin,
    typeOnlyStatements,
    repeatedPairs,
    exportFrom,
    relativeOutsideRoot: counts.relativeOutsideRoot,
    relativeUnresolved: counts.relativeUnresolved,
    nodeModulesJsOnly,
    typeOnlyInclAllNamed,
    repeatedMergePairs,
    exportFromByClass,
    dynamicImportCalls,
    requireCalls,
    nullableUnionInstanceFields,
    hasPaths: options.paths !== undefined,
    hasBaseUrl: options.baseUrl !== undefined,
  };
}

function toMarkdown(rows: ProjectRow[]): string {
  const head = [
    'Project (files)', 'HEAD', 'Dirty', 'Import stmts', 'Relative in project', 'Alias/baseUrl in project',
    'Alias outside root', '`node_modules`', 'Unresolved bare', 'Built-in', 'Type-only stmts', 'Repeated pair',
    '`export…from`',
  ];
  const lines = [
    '# U2 scout import probe — output',
    '',
    '## FD plan Section 3 columns',
    '',
    `| ${head.join(' | ')} |`,
    `|${head.map(() => '---').join('|')}|`,
    ...rows.map(r => `| ${[
      `${r.project} (${r.files})`, `\`${r.gitHead.slice(0, 7)}\``, r.gitStatusLines, r.importStatements,
      r.relativeInProject, r.aliasInProject, r.aliasOutsideRoot, r.nodeModules, r.unresolvedBare, r.builtin,
      r.typeOnlyStatements, r.repeatedPairs, r.exportFrom,
    ].join(' | ')} |`),
    '',
    '## Supplementary columns',
    '',
    '| Project | Relative outside root | Relative unresolved | `node_modules` resolved to JS only | Type-only incl. all-`type` named | Repeated pair (U2 merge key) | `export…from` by class | `import()` calls | `require()` calls | Nullable-union instance fields | `paths` | `baseUrl` |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map(r => `| ${[
      r.project, r.relativeOutsideRoot, r.relativeUnresolved, r.nodeModulesJsOnly, r.typeOnlyInclAllNamed, r.repeatedMergePairs,
      Object.entries(r.exportFromByClass).filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}`).join(', ') || '—',
      r.dynamicImportCalls, r.requireCalls, r.nullableUnionInstanceFields, r.hasPaths ? 'yes' : 'no', r.hasBaseUrl ? 'yes' : 'no',
    ].join(' | ')} |`),
    '',
  ];
  return lines.join('\n');
}

function main(argv: string[]): void {
  let jsonOut: string | undefined;
  let mdOut: string | undefined;
  const projects: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a === '--json') jsonOut = argv[++i];
    else if (a === '--md') mdOut = argv[++i];
    else projects.push(a);
  }
  if (projects.length === 0) {
    process.stderr.write('usage: probe-imports.ts [--json <file>] [--md <file>] <projectPath> ...\n');
    process.exit(2);
  }
  const rows = projects.map(probeProject);
  const json = `${JSON.stringify({ probe: 'u2-import-probe', node: process.version, typescript: ts.version, rows }, null, 2)}\n`;
  if (jsonOut) writeFileSync(jsonOut, json); else process.stdout.write(json);
  if (mdOut) writeFileSync(mdOut, toMarkdown(rows));
}

main(process.argv.slice(2));
