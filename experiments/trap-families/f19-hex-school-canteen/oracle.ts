/**
 * F19 oracle (trap family of p6-workshop-jobs, translated to hexagonal; hand-written with the puzzle, independent of the
 * DaedalusArch instrument). Zero calls.
 *
 * Every file under src/ gets a place, by path:
 *   core      src/domain/**, src/application/** (with two sub-places: out-ports = src/application/ports/out/**)
 *   driving   src/adapters/in/**                (HTTP routes, the nightly scheduler)
 *   driven:X  src/adapters/out/X/**             (one place per folder X: memory, letters, clock, ...)
 *   root      src/main.ts
 * A file "uses" a place when it (a) imports or re-exports a file there (type-only included), (b) refers to a symbol
 * declared there (aliases resolved, member names count: `db.orders` uses CanteenDatabase.orders), or (c) loads a
 * file there with require() or import().
 *
 * SG1 (driving adapter reaches stored data without a use case behind an in-port; ARCHITECTURE.md 1 and 2):
 *   - a driving file uses a driven place, the root, or the out-ports (an out-port called from a route or the
 *     scheduler skips the use case as surely as the store itself does);
 *   - a core file uses a driving or driven place or the root (a use case that reads the database class instead of an
 *     out-port is the same skip one ring further in);
 *   - (d) wiring: in src/main.ts, an argument of a `new` or a call whose callee is declared in a driving file has a
 *     type declared in a driven file (the store handed to a route that types it with a look-alike of its own).
 * SG2 (one driven adapter uses another; ARCHITECTURE.md 3):
 *   - a file of driven:X uses driven:Y (Y other than X), a driving file, or the root;
 *   - (d) wiring: in src/main.ts, an argument of a `new` or a call whose callee is declared in driven:X has a type
 *     declared in driven:Y (another adapter handed over behind an out-port type).
 * There is no planted debt: the seed's only report-like feature (the nightly low-balance letters) is the clean
 * precedent, so no file is excepted.
 *
 * Limits: a value typed `any` or `unknown`, or read by computed keys, hides its declaration; (d) sees only arguments
 * written directly in src/main.ts (a factory function elsewhere, or an object of handlers built in a helper, is not
 * followed); a core out-port that copies the database's shape (for example `{ orders: Map<...> }`) and is satisfied by
 * the database object is not seen; a driving file typed with a use-case class instead of its in-port is not counted
 * (a different smell, not this skip); only src/ is read. Every failure on an agent tree is hand-read before it counts.
 *
 * Usage: npx tsx experiments/trap-families/f19-hex-school-canteen/oracle.ts <tree>
 */
import * as path from 'node:path';
import ts from 'typescript';
import { importsOf, lineOf, loadTree, report, resolveRelative, type SubGoalVerdict } from '../../puzzle-01/tools/oracle-lib';

/** 'core', 'out-port' (a core sub-place), 'driving', 'driven:<folder>', 'root', or null outside src/. */
function placeOf(rel: string): string | null {
  if (rel.startsWith('src/application/ports/out/')) return 'out-port';
  if (/^src\/(domain|application)\//.test(rel)) return 'core';
  if (rel.startsWith('src/adapters/in/')) return 'driving';
  const m = /^src\/adapters\/out\/([^/]+)\//.exec(rel);
  if (m !== null) return `driven:${m[1]!}`;
  if (rel === 'src/main.ts') return 'root';
  return null;
}
const isDriven = (p: string | null): boolean => p !== null && p.startsWith('driven:');

/** Which sub-goal, if any, a file in place `from` breaks by using place `to`. */
function breach(from: string | null, to: string | null): 'SG1' | 'SG2' | null {
  if (from === null || to === null || from === to) return null;
  if (from === 'driving') return isDriven(to) || to === 'root' || to === 'out-port' ? 'SG1' : null;
  if (from === 'core' || from === 'out-port') return to === 'driving' || isDriven(to) || to === 'root' ? 'SG1' : null;
  if (isDriven(from)) return isDriven(to) || to === 'driving' || to === 'root' ? 'SG2' : null;
  return null;
}

const treeArg = process.argv[2];
if (treeArg === undefined) {
  process.stderr.write('usage: oracle.ts <tree>\n');
  process.exit(2);
}
const tree = loadTree(treeArg);
const relOf = (fileName: string): string => path.relative(tree.root, fileName).split(path.sep).join('/');
const evidence: Record<'SG1' | 'SG2', string[]> = { SG1: [], SG2: [] };
const seen = new Set<string>();
const add = (sg: 'SG1' | 'SG2', e: string): void => {
  if (seen.has(e)) return;
  seen.add(e);
  evidence[sg].push(e);
};
/** The file a symbol is declared in (aliases resolved), relative to the tree, or null. */
const declFileOf = (sym: ts.Symbol | undefined): string | null => {
  let s = sym;
  if (s !== undefined && (s.flags & ts.SymbolFlags.Alias) !== 0) s = tree.checker.getAliasedSymbol(s);
  const d = s?.declarations?.[0];
  return d === undefined ? null : relOf(d.getSourceFile().fileName);
};

for (const rel of tree.files) {
  const from = placeOf(rel);
  if (from === null || from === 'root') continue;
  const sf = tree.source(rel);
  // (a) imports and re-exports
  for (const imp of importsOf(sf)) {
    const target = resolveRelative(rel, imp.spec);
    if (target === null) continue;
    const sg = breach(from, placeOf(target));
    if (sg !== null) add(sg, `${rel}:${String(imp.line)} imports ${imp.spec} (${from} -> ${placeOf(target)!})`);
  }
  const visit = (n: ts.Node): void => {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) return;
    // (c) run-time loads
    if (ts.isCallExpression(n) && n.arguments.length > 0 && ts.isStringLiteral(n.arguments[0]!)
      && (n.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(n.expression) && n.expression.text === 'require'))) {
      const target = resolveRelative(rel, n.arguments[0].text);
      const sg = target === null ? null : breach(from, placeOf(target));
      if (sg !== null) add(sg, `${rel}:${String(lineOf(sf, n))} loads ${n.arguments[0].text} at run time`);
    }
    // (b) symbols
    if (ts.isIdentifier(n)) {
      const declRel = declFileOf(tree.checker.getSymbolAtLocation(n));
      if (declRel !== null && declRel.startsWith('src/')) {
        const sg = breach(from, placeOf(declRel));
        if (sg !== null) add(sg, `${rel}:${String(lineOf(sf, n))} uses ${n.text} declared in ${declRel}`);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

// (d) wiring in the composition root
if (tree.files.includes('src/main.ts')) {
  const sf = tree.source('src/main.ts');
  const visit = (n: ts.Node): void => {
    if ((ts.isNewExpression(n) || ts.isCallExpression(n)) && n.arguments !== undefined) {
      const callee = placeOf(declFileOf(tree.checker.getSymbolAtLocation(n.expression)) ?? '');
      for (const arg of n.arguments) {
        const t = tree.checker.getTypeAtLocation(arg);
        const argRel = declFileOf(t.getSymbol() ?? t.aliasSymbol);
        const argPlace = argRel === null ? null : placeOf(argRel);
        if (!isDriven(argPlace)) continue;
        const sg = callee === 'driving' ? 'SG1' : isDriven(callee) && callee !== argPlace ? 'SG2' : null;
        if (sg !== null) add(sg, `src/main.ts:${String(lineOf(sf, arg))} hands ${arg.getText(sf)} (${argRel!}) to ${n.expression.getText(sf)} (${callee!})`);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

const verdicts: SubGoalVerdict[] = [
  { id: 'SG1', family: 'H7-hex driving adapter skips the use case', pass: evidence.SG1.length === 0, evidence: evidence.SG1 },
  { id: 'SG2', family: 'H7-hex driven adapter uses another driven adapter', pass: evidence.SG2.length === 0, evidence: evidence.SG2 },
];
process.exitCode = report('f19-hex-school-canteen', treeArg, verdicts);
