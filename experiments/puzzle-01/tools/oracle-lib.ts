/**
 * Shared helpers for the PUZZLE-01 oracles (zero calls). Each puzzle's `oracle.ts` states its own rule; this file only
 * loads a tree with the TypeScript compiler API and offers small AST queries. Paths are POSIX, relative to the tree.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';

export interface SubGoalVerdict {
  readonly id: string;
  readonly family: string;
  readonly pass: boolean;
  readonly evidence: string[];
}

export interface Tree {
  readonly root: string;
  readonly program: ts.Program;
  readonly checker: ts.TypeChecker;
  /** `src/**\/*.ts` files, relative POSIX paths, sorted. */
  readonly files: string[];
  source(rel: string): ts.SourceFile;
}

export function loadTree(root: string): Tree {
  const abs = path.resolve(root);
  const files: string[] = [];
  const walk = (rel: string): void => {
    for (const e of fs.readdirSync(path.join(abs, rel), { withFileTypes: true })) {
      const r = `${rel}/${e.name}`;
      if (e.isDirectory()) walk(r);
      else if (e.name.endsWith('.ts')) files.push(r);
    }
  };
  walk('src');
  files.sort();
  const program = ts.createProgram(files.map((f) => path.join(abs, f)), {
    strict: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, moduleResolution: ts.ModuleResolutionKind.Node10,
    noEmit: true, skipLibCheck: true, types: [],
  });
  return {
    root: abs,
    program,
    checker: program.getTypeChecker(),
    files,
    source: (rel) => {
      const sf = program.getSourceFile(path.join(abs, rel));
      if (sf === undefined) throw new Error(`not in program: ${rel}`);
      return sf;
    },
  };
}

export function lineOf(sf: ts.SourceFile, node: ts.Node): number {
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

/** Module specifiers imported (or re-exported) by a file. */
export function importsOf(sf: ts.SourceFile): { spec: string; line: number; names: string[] }[] {
  const out: { spec: string; line: number; names: string[] }[] = [];
  for (const st of sf.statements) {
    if ((ts.isImportDeclaration(st) || ts.isExportDeclaration(st)) && st.moduleSpecifier !== undefined && ts.isStringLiteral(st.moduleSpecifier)) {
      const names: string[] = [];
      if (ts.isImportDeclaration(st)) {
        const c = st.importClause;
        if (c?.name !== undefined) names.push(c.name.text);
        const nb = c?.namedBindings;
        if (nb !== undefined && ts.isNamedImports(nb)) for (const e of nb.elements) names.push((e.propertyName ?? e.name).text);
        if (nb !== undefined && ts.isNamespaceImport(nb)) names.push('*');
      }
      out.push({ spec: st.moduleSpecifier.text, line: lineOf(sf, st), names });
    }
  }
  return out;
}

/** Resolves a relative import of `fromRel` to a tree-relative path (with `.ts`), or null for a package import. */
export function resolveRelative(fromRel: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const joined = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), spec));
  return joined.endsWith('.ts') ? joined : `${joined.replace(/\.js$/, '')}.ts`;
}

/** Every function-like node with a body (functions, methods, arrows, accessors, constructors). */
export function functionsOf(sf: ts.SourceFile): ts.FunctionLikeDeclaration[] {
  const out: ts.FunctionLikeDeclaration[] = [];
  const visit = (n: ts.Node): void => {
    if ((ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isConstructorDeclaration(n) || ts.isGetAccessorDeclaration(n)) && n.body !== undefined) out.push(n);
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

/** Nodes inside a function body, not descending into nested function-like nodes. */
export function ownNodes(fn: ts.FunctionLikeDeclaration): ts.Node[] {
  const out: ts.Node[] = [];
  const visit = (n: ts.Node): void => {
    out.push(n);
    ts.forEachChild(n, (c) => {
      if (ts.isFunctionDeclaration(c) || ts.isMethodDeclaration(c) || ts.isArrowFunction(c) || ts.isFunctionExpression(c)) return;
      visit(c);
    });
  };
  if (fn.body !== undefined) visit(fn.body);
  return out;
}

export function fnName(fn: ts.FunctionLikeDeclaration, sf: ts.SourceFile): string {
  const n = fn.name;
  const own = n !== undefined && (ts.isIdentifier(n) || ts.isStringLiteral(n)) ? n.text : ts.isConstructorDeclaration(fn) ? 'constructor' : '<anonymous>';
  let p: ts.Node | undefined = fn.parent;
  while (p !== undefined && !ts.isClassDeclaration(p) && !ts.isSourceFile(p)) p = p.parent;
  const cls = p !== undefined && ts.isClassDeclaration(p) && p.name !== undefined ? `${p.name.text}.` : '';
  return `${cls}${own}@${String(lineOf(sf, fn))}`;
}

/** Name of the (apparent) type of an expression, or its symbol, for receiver classification. */
export function typeNameOf(checker: ts.TypeChecker, e: ts.Expression): string {
  const t = checker.getTypeAtLocation(e);
  const s = t.getSymbol() ?? t.aliasSymbol;
  return s?.getName() ?? checker.typeToString(t);
}

/** True for a relational comparison that is not a loop bound or a length / index check. */
export function isBusinessComparison(n: ts.Node, sf: ts.SourceFile): boolean {
  if (!ts.isBinaryExpression(n)) return false;
  const k = n.operatorToken.kind;
  if (![ts.SyntaxKind.LessThanToken, ts.SyntaxKind.LessThanEqualsToken, ts.SyntaxKind.GreaterThanToken, ts.SyntaxKind.GreaterThanEqualsToken].includes(k)) return false;
  const text = n.getText(sf);
  if (/\.length\b|\bindex\b|\bi\b|\bsize\b/.test(text)) return false;
  let p: ts.Node | undefined = n.parent;
  while (p !== undefined && !ts.isFunctionLike(p)) {
    if (ts.isForStatement(p) && p.condition === n) return false;
    p = p.parent;
  }
  return true;
}

export function report(puzzle: string, tree: string, verdicts: SubGoalVerdict[]): number {
  const pass = verdicts.every((v) => v.pass);
  process.stdout.write(`${JSON.stringify({ puzzle, tree, pass, subGoals: verdicts })}\n`);
  return pass ? 0 : 1;
}
