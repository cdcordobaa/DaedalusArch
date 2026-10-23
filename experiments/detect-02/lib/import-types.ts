/**
 * GRAPH-SCALE (v1.5-exp, U1 groundwork, fix (e)): file → file edges for inline import types,
 * `createServiceRef<import('./AuthService').AuthService>(…)`. Zero model calls.
 *
 * The frozen extractor (`src/apg-extractor/`, never edited here) has no edge for an `import('…')` *type*, while the
 * compiler counts it as a reference (REPO-SCOUT §7: all 26 literal-view misses on Backstage). This module finds every
 * `ImportTypeNode` with a string-literal argument by parsing each file (no type checker) and resolves the specifier
 * with the compiler's own module resolution under the tree's compiler options, so the edge set is the one tsc sees.
 * Consumers: the comprehension index's import graph (`impact` importers) and the coverage add-on
 * (`experiments/graph-scale/coverage.ts`), which adds these edges to the frozen extraction before comparing with tsc.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';

export interface ImportTypeEdge {
  /** Root-relative POSIX paths. */
  readonly source: string; readonly target: string;
  readonly specifier: string; readonly line: number;
}

const posix = (p: string): string => p.split(path.sep).join('/');

/** The inline import-type specifiers of one file's text, with their 1-based lines. */
export function importTypeSpecifiers(fileName: string, text: string): { specifier: string; line: number }[] {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: { specifier: string; line: number }[] = [];
  const visit = (n: ts.Node): void => {
    if (ts.isImportTypeNode(n) && ts.isLiteralTypeNode(n.argument) && ts.isStringLiteral(n.argument.literal)) {
      out.push({ specifier: n.argument.literal.text, line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1 });
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

/**
 * Import-type edges between files of the program under `root` (declaration files and `node_modules` excluded on both
 * ends). `files` defaults to the tsconfig's program files.
 */
export function importTypeEdges(root: string, tsconfig: string, files?: readonly string[]): ImportTypeEdge[] {
  const absRoot = path.resolve(root);
  const cfg = ts.getParsedCommandLineOfConfigFile(tsconfig, {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined });
  const options = cfg?.options ?? {};
  const names = files ?? cfg?.fileNames ?? [];
  const inTree = (abs: string): boolean => {
    const r = posix(path.relative(absRoot, abs));
    return !r.startsWith('..') && !abs.includes('/node_modules/') && !abs.endsWith('.d.ts');
  };
  const host = ts.createCompilerHost(options);
  const cache = ts.createModuleResolutionCache(absRoot, (s) => s, options);
  const out: ImportTypeEdge[] = [];
  for (const f of names) {
    const abs = path.resolve(f);
    if (!inTree(abs) || !fs.existsSync(abs)) continue;
    const text = fs.readFileSync(abs, 'utf8');
    if (!text.includes('import(')) continue;
    for (const s of importTypeSpecifiers(abs, text)) {
      const r = ts.resolveModuleName(s.specifier, abs, options, host, cache).resolvedModule;
      if (r === undefined || !inTree(r.resolvedFileName)) continue;
      const source = posix(path.relative(absRoot, abs));
      const target = posix(path.relative(absRoot, r.resolvedFileName));
      if (source !== target) out.push({ source, target, specifier: s.specifier, line: s.line });
    }
  }
  return out;
}
