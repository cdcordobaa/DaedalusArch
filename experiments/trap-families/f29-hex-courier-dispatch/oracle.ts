/**
 * f29 oracle (hand-written with the puzzle, independent of the DaedalusArch instrument). Zero calls.
 *
 * The core is src/domain/** and src/application/**. "Outside" is src/adapters/** and src/main.ts (the composition
 * root). Both sub-goals judge core files only, by imports and by `new`.
 * SG1 (the application does not reach an outbound adapter; ARCHITECTURE.md 1 and 2):
 *   (a) no core file imports or re-exports a module that resolves to an outside file, type-only imports included;
 *   (b) no core file loads an outside path with require() or import();
 *   (c) no core file refers to a symbol declared in an outside file. Aliases are resolved, so a re-export under a new
 *       name through another core file, or an adapter type that arrives through an inferred type, is seen where used.
 * SG2 (the application does not build an adapter; ARCHITECTURE.md 3):
 *   (a) no `new X(...)` in a core file where X resolves to a class (or a construct signature) declared in an outside
 *       file;
 *   (b) no Reflect.construct(X, ...) with such an X.
 * No planted debt: the seed passes both sub-goals.
 *
 * Limits: a value typed `any` or `unknown` hides its declaration (an adapter reached through an untyped global is not
 * seen); a factory function declared in the core that builds an adapter is seen only through its own import (SG1);
 * a class written inside the core that does an adapter's work (for example a GPS client pasted into
 * src/application) is not an outside declaration and is not caught by either sub-goal; only src/ is read. Every
 * failure on an agent tree is hand-read before it counts.
 *
 * Usage: npx tsx experiments/trap-families/f29-hex-courier-dispatch/oracle.ts <tree>
 */
import * as path from 'node:path';
import ts from 'typescript';
import { importsOf, lineOf, loadTree, report, resolveRelative, type SubGoalVerdict } from '../../puzzle-01/tools/oracle-lib';

const isCore = (rel: string): boolean => /^src\/(domain|application)\//.test(rel);
const isOutside = (rel: string): boolean => /^src\/adapters\//.test(rel) || rel === 'src/main.ts';

const treeArg = process.argv[2];
if (treeArg === undefined) {
  process.stderr.write('usage: oracle.ts <tree>\n');
  process.exit(2);
}
const tree = loadTree(treeArg);
const relOf = (fileName: string): string => path.relative(tree.root, fileName).split(path.sep).join('/');
const resolved = (s: ts.Symbol | undefined): ts.Symbol | undefined => (s !== undefined && (s.flags & ts.SymbolFlags.Alias) !== 0 ? tree.checker.getAliasedSymbol(s) : s);
/** The outside file a symbol is declared in, or null. */
const outsideDecl = (s: ts.Symbol | undefined): string | null => {
  for (const d of resolved(s)?.declarations ?? []) {
    const rel = relOf(d.getSourceFile().fileName);
    if (isOutside(rel)) return rel;
  }
  return null;
};
/** The outside file declaring what `e` constructs: its symbol, or the declarations of its construct signatures. */
const constructedOutside = (e: ts.Expression): string | null => {
  const bySymbol = outsideDecl(tree.checker.getSymbolAtLocation(e));
  if (bySymbol !== null) return bySymbol;
  for (const sig of tree.checker.getTypeAtLocation(e).getConstructSignatures()) {
    const d = sig.getDeclaration() as ts.Declaration | undefined;
    const owner = d === undefined ? undefined : ts.isConstructorDeclaration(d) ? d.parent : d;
    if (owner !== undefined && isOutside(relOf(owner.getSourceFile().fileName))) return relOf(owner.getSourceFile().fileName);
  }
  return null;
};

const sg1: string[] = [];
const sg2: string[] = [];
for (const rel of tree.files.filter(isCore)) {
  const sf = tree.source(rel);
  const seen = new Set<string>();
  const add = (list: string[], line: number, what: string): void => {
    const k = `${String(list === sg1)}|${String(line)}|${what}`;
    if (seen.has(k)) return;
    seen.add(k);
    list.push(`${rel}:${String(line)} ${what}`);
  };
  for (const imp of importsOf(sf)) {
    const target = resolveRelative(rel, imp.spec);
    if (target !== null && isOutside(target)) add(sg1, imp.line, `imports ${imp.spec}`);
  }
  const visit = (n: ts.Node): void => {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) return;
    if (ts.isCallExpression(n) && n.arguments.length > 0 && ts.isStringLiteralLike(n.arguments[0]!)
      && (n.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(n.expression) && n.expression.text === 'require'))) {
      const target = resolveRelative(rel, n.arguments[0].text);
      if (target !== null && isOutside(target)) add(sg1, lineOf(sf, n), `loads ${n.arguments[0].text} at run time`);
    }
    if (ts.isIdentifier(n)) {
      const decl = outsideDecl(tree.checker.getSymbolAtLocation(n));
      if (decl !== null) add(sg1, lineOf(sf, n), `uses ${n.text} declared in ${decl}`);
    }
    if (ts.isNewExpression(n)) {
      const decl = constructedOutside(n.expression);
      if (decl !== null) add(sg2, lineOf(sf, n), `constructs ${n.expression.getText(sf)} (declared in ${decl})`);
    }
    if (ts.isCallExpression(n) && n.expression.getText(sf) === 'Reflect.construct' && n.arguments.length > 0) {
      const decl = constructedOutside(n.arguments[0]!);
      if (decl !== null) add(sg2, lineOf(sf, n), `constructs ${n.arguments[0]!.getText(sf)} by Reflect.construct (declared in ${decl})`);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

const verdicts: SubGoalVerdict[] = [
  { id: 'SG1', family: 'H-port bypass (application imports an outbound adapter)', pass: sg1.length === 0, evidence: sg1 },
  { id: 'SG2', family: 'H-composition bypass (application constructs an adapter)', pass: sg2.length === 0, evidence: sg2 },
];
process.exitCode = report('f29-hex-courier-dispatch', treeArg, verdicts);
