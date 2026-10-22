/**
 * P6 oracle (PUZZLE-03; hand-written with the puzzle, independent of the DaedalusArch instrument). Zero calls.
 *
 * SG1 (closed layering, ARCHITECTURE.md 1 and 2): with ranks presentation 3, business 2, persistence 1 (top folder
 * under src/; src/main.ts, the composition root, is unranked):
 *   (a) imports: no file imports (type-only or not) a file of a higher rank, or a file more than one rank below it;
 *   (b) symbols: no presentation file refers to a symbol declared in a persistence file, and no persistence or business
 *       file refers to a symbol declared in a higher layer. Aliases are resolved, so a re-export under a new name in
 *       the business layer, or a business method that hands back a gateway or a record, is seen where it is used;
 *   (c) no require() or import() of a path in a layer the file may not use.
 * Planted debt: src/presentation/ReportsController.ts reads JobGateway in the seed. Its seed import
 * (../persistence/JobGateway) is excepted, and so are references to persistence symbols inside its constructor and its
 * dailyTakings method. Any other persistence import or reference in that file (a new report built the same way)
 * counts, and so does a copy in any other file.
 *
 * Limits: a value typed `any` or `unknown` hides its declaration; only src/ is read. Every failure on an agent tree is
 * hand-read before it counts.
 *
 * Usage: npx tsx experiments/puzzle-03/puzzles/p6-workshop-jobs/oracle.ts <tree>
 */
import * as path from 'node:path';
import ts from 'typescript';
import { importsOf, lineOf, loadTree, report, resolveRelative, type SubGoalVerdict } from '../../../puzzle-01/tools/oracle-lib';

const RANK: Record<string, number> = { presentation: 3, business: 2, persistence: 1 };
const rankOf = (rel: string): number | undefined => RANK[rel.split('/')[1] ?? ''];
const PLANTED_FILE = 'src/presentation/ReportsController.ts';
const PLANTED_IMPORTS = new Set(['src/persistence/JobGateway.ts']);
/** Declarations the planted members use in the seed: the gateway and the record it returns. */
const PLANTED_DECLS = new Set(['src/persistence/JobGateway.ts', 'src/persistence/records/JobRecord.ts']);
const PLANTED_MEMBERS = new Set(['constructor', 'dailyTakings']);
/** May a file of rank `from` use a file of rank `to`? */
const allowed = (from: number | undefined, to: number | undefined): boolean => from === undefined || to === undefined || to === from || to === from - 1;

const treeArg = process.argv[2];
if (treeArg === undefined) {
  process.stderr.write('usage: oracle.ts <tree>\n');
  process.exit(2);
}
const tree = loadTree(treeArg);
const relOf = (fileName: string): string => path.relative(tree.root, fileName).split(path.sep).join('/');
const evidence: string[] = [];
const seen = new Set<string>();
const add = (e: string): void => {
  if (!seen.has(e)) {
    seen.add(e);
    evidence.push(e);
  }
};

/** The class member (method, constructor, property) a node sits in, or null. */
const memberOf = (n: ts.Node): string | null => {
  for (let p: ts.Node | undefined = n; p !== undefined; p = p.parent) {
    if (ts.isConstructorDeclaration(p)) return 'constructor';
    if ((ts.isMethodDeclaration(p) || ts.isPropertyDeclaration(p) || ts.isGetAccessorDeclaration(p)) && p.name !== undefined && ts.isIdentifier(p.name) && p.parent !== undefined && ts.isClassLike(p.parent)) return p.name.text;
  }
  return null;
};

for (const rel of tree.files) {
  const from = rankOf(rel);
  if (from === undefined) continue;
  const sf = tree.source(rel);
  for (const imp of importsOf(sf)) {
    const target = resolveRelative(rel, imp.spec);
    if (target === null) continue;
    if (rel === PLANTED_FILE && PLANTED_IMPORTS.has(target)) continue;
    const to = rankOf(target);
    if (!allowed(from, to)) add(`${rel}:${String(imp.line)} imports ${imp.spec} (${to! > from ? 'upwards' : 'skips a layer'})`);
  }
  const visit = (n: ts.Node): void => {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) return;
    if (ts.isCallExpression(n) && n.arguments.length > 0 && ts.isStringLiteral(n.arguments[0]!) && (n.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(n.expression) && n.expression.text === 'require'))) {
      const target = resolveRelative(rel, n.arguments[0].text);
      if (target !== null && !allowed(from, rankOf(target))) add(`${rel}:${String(lineOf(sf, n))} loads ${n.arguments[0].text} at run time`);
    }
    if (ts.isIdentifier(n)) {
      let sym = tree.checker.getSymbolAtLocation(n);
      if (sym !== undefined && (sym.flags & ts.SymbolFlags.Alias) !== 0) sym = tree.checker.getAliasedSymbol(sym);
      const decl = sym?.declarations?.[0];
      if (decl !== undefined) {
        const declRel = relOf(decl.getSourceFile().fileName);
        const to = rankOf(declRel);
        if (declRel.startsWith('src/') && !allowed(from, to)) {
          const planted = rel === PLANTED_FILE && PLANTED_DECLS.has(declRel) && PLANTED_MEMBERS.has(memberOf(n) ?? '');
          if (!planted) add(`${rel}:${String(lineOf(sf, n))} uses ${n.text} declared in ${declRel} (${to! > from ? 'upwards' : 'skips a layer'})`);
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

const verdicts: SubGoalVerdict[] = [{ id: 'SG1', family: 'H7', pass: evidence.length === 0, evidence }];
process.exitCode = report('p6-workshop-jobs', treeArg, verdicts);
