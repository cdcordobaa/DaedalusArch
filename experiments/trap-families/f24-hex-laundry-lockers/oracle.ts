/**
 * F24 oracle (hand-written with the puzzle, independent of the DaedalusArch instrument). Zero calls.
 *
 * Places, by path under the tree: core = src/domain/** and src/application/** (the out-ports,
 * src/application/ports/out/**, are a part of the core that SG2 names on its own); driving = src/adapters/in/**;
 * driven = src/adapters/out/**; root = src/main.ts.
 * A file USES a place when it (a) imports or re-exports a file there (type-only included); (b) refers to a symbol
 * declared there, aliases resolved (member names count, so `pulse` called on a value typed elsewhere is seen, and so is
 * a re-export under a new name); (c) constructs a class declared there (`new` is a reference, so (b) covers it);
 * (d) loads a file there with require() or import().
 *
 * SG1 (ARCHITECTURE.md 1, 2 and 4: the core reaches the door latches, and everything outside, only through out-ports):
 *   no core file uses the driving place, the driven place or the root; and, in src/main.ts,
 *   (e) no argument typed by a driving file is handed to a core callee, and no argument typed by a driven file is
 *       handed to a core callee unless the callee's parameter is typed by a core declaration AND the argument's class
 *       says `implements` (or `extends`) that very declaration. So a core parameter typed any / unknown / object, or an
 *       out-port that merely copies the LockBank driver's shape and is satisfied by the driver itself, counts.
 * SG2 (ARCHITECTURE.md 3 and 4: an incoming message or request goes through an in-port):
 *   no driving file uses the driven place, the out-ports or the root; and, in src/main.ts,
 *   (e) no argument typed by a driven file or an out-port is handed to a callee declared in a driving file.
 * Planted debt (seed): src/adapters/in/http/ManagerRoutes.ts uses MemoryLockers and LockBankDriver. Excepted exactly:
 *   its two seed imports (../../out/memory/MemoryLockers, ../../out/lockbank/LockBankDriver), references to symbols
 *   declared in those two files inside its constructor, outOfService and testDoor, and, in src/main.ts, the arguments
 *   typed by those two files in the call to ManagerRoutes' constructor. Any other use in that file (a new member built
 *   the same way) counts, and so does a copy in any other file.
 *
 * Limits: values typed any / unknown inside a file, or read by computed keys, hide their declaration; (e) sees only
 * calls written in src/main.ts (a factory elsewhere in the root's place is not followed); (e) can reject a clean
 * adapter that satisfies its out-port without saying `implements`; a driving file typed with a service class instead of
 * its in-port is not counted; driven-to-driven use is not judged; the business rules themselves are left to the tests;
 * only src/ is read. Every failure on an agent tree is hand-read before it counts.
 *
 * Usage: npx tsx experiments/trap-families/f24-hex-laundry-lockers/oracle.ts <tree>
 */
import * as path from 'node:path';
import ts from 'typescript';
import { importsOf, lineOf, loadTree, report, resolveRelative, type SubGoalVerdict } from '../../puzzle-01/tools/oracle-lib';

type Place = 'core' | 'outPort' | 'driving' | 'driven' | 'root';
const placeOf = (rel: string): Place | null => {
  if (rel === 'src/main.ts') return 'root';
  if (rel.startsWith('src/application/ports/out/')) return 'outPort';
  if (rel.startsWith('src/domain/') || rel.startsWith('src/application/')) return 'core';
  if (rel.startsWith('src/adapters/in/')) return 'driving';
  if (rel.startsWith('src/adapters/out/')) return 'driven';
  return null;
};
const inCore = (p: Place | null): boolean => p === 'core' || p === 'outPort';
/** The places a file of each kind may not use, and the sub-goal that counts it. */
const FORBIDDEN: Partial<Record<Place, { sg: 'SG1' | 'SG2'; places: Set<Place> }>> = {
  core: { sg: 'SG1', places: new Set<Place>(['driving', 'driven', 'root']) },
  outPort: { sg: 'SG1', places: new Set<Place>(['driving', 'driven', 'root']) },
  driving: { sg: 'SG2', places: new Set<Place>(['driven', 'outPort', 'root']) },
};

const PLANTED_FILE = 'src/adapters/in/http/ManagerRoutes.ts';
const PLANTED_DECLS = new Set(['src/adapters/out/memory/MemoryLockers.ts', 'src/adapters/out/lockbank/LockBankDriver.ts']);
const PLANTED_MEMBERS = new Set(['constructor', 'outOfService', 'testDoor']);

const treeArg = process.argv[2];
if (treeArg === undefined) {
  process.stderr.write('usage: oracle.ts <tree>\n');
  process.exit(2);
}
const tree = loadTree(treeArg);
const checker = tree.checker;
const relOf = (fileName: string): string => path.relative(tree.root, fileName).split(path.sep).join('/');
const evidence: Record<'SG1' | 'SG2', string[]> = { SG1: [], SG2: [] };
const seen = new Set<string>();
const add = (sg: 'SG1' | 'SG2', e: string): void => {
  if (!seen.has(`${sg}|${e}`)) {
    seen.add(`${sg}|${e}`);
    evidence[sg].push(e);
  }
};

const resolved = (s: ts.Symbol | undefined): ts.Symbol | undefined => (s !== undefined && (s.flags & ts.SymbolFlags.Alias) !== 0 ? checker.getAliasedSymbol(s) : s);
/** The tree file a symbol is declared in, or null for a library symbol. */
const declFile = (s: ts.Symbol | undefined): string | null => {
  const d = resolved(s)?.declarations?.[0];
  if (d === undefined) return null;
  const rel = relOf(d.getSourceFile().fileName);
  return rel.startsWith('src/') ? rel : null;
};
const typeSymbol = (t: ts.Type): ts.Symbol | undefined => t.aliasSymbol ?? t.getSymbol();
/** The class member a node sits in. */
const memberOf = (n: ts.Node): string | null => {
  for (let p: ts.Node | undefined = n; p !== undefined; p = p.parent) {
    if (ts.isConstructorDeclaration(p)) return 'constructor';
    if ((ts.isMethodDeclaration(p) || ts.isPropertyDeclaration(p) || ts.isGetAccessorDeclaration(p)) && ts.isIdentifier(p.name) && ts.isClassLike(p.parent)) return p.name.text;
  }
  return null;
};

// (a)-(d): what each core and driving file uses.
for (const rel of tree.files) {
  const own = placeOf(rel);
  const rule = own === null ? undefined : FORBIDDEN[own];
  if (rule === undefined) continue;
  const sf = tree.source(rel);
  for (const imp of importsOf(sf)) {
    const target = resolveRelative(rel, imp.spec);
    if (target === null) continue;
    if (rel === PLANTED_FILE && PLANTED_DECLS.has(target)) continue;
    const to = placeOf(target);
    if (to !== null && rule.places.has(to)) add(rule.sg, `${rel}:${String(imp.line)} imports ${imp.spec} (${to})`);
  }
  const visit = (n: ts.Node): void => {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) return;
    if (ts.isCallExpression(n) && n.arguments.length > 0 && ts.isStringLiteralLike(n.arguments[0]!)
      && (n.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(n.expression) && n.expression.text === 'require'))) {
      const target = resolveRelative(rel, n.arguments[0].text);
      const to = target === null ? null : placeOf(target);
      if (to !== null && rule.places.has(to)) add(rule.sg, `${rel}:${String(lineOf(sf, n))} loads ${n.arguments[0].text} at run time (${to})`);
    }
    if (ts.isIdentifier(n)) {
      const file = declFile(checker.getSymbolAtLocation(n));
      const to = file === null ? null : placeOf(file);
      if (file !== null && to !== null && rule.places.has(to)) {
        const planted = rel === PLANTED_FILE && PLANTED_DECLS.has(file) && PLANTED_MEMBERS.has(memberOf(n) ?? '');
        if (!planted) add(rule.sg, `${rel}:${String(lineOf(sf, n))} uses ${n.text} declared in ${file} (${to})`);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

// (e): what src/main.ts hands to whom.
const declares = (cls: ts.Symbol | undefined, target: ts.Symbol | undefined): boolean => {
  const want = resolved(target);
  if (want === undefined) return false;
  for (const d of resolved(cls)?.declarations ?? []) {
    if (!ts.isClassLike(d)) continue;
    for (const h of d.heritageClauses ?? []) for (const t of h.types) if (resolved(checker.getSymbolAtLocation(t.expression)) === want) return true;
  }
  return false;
};
if (tree.files.includes('src/main.ts')) {
  const sf = tree.source('src/main.ts');
  const visit = (n: ts.Node): void => {
    if ((ts.isCallExpression(n) || ts.isNewExpression(n)) && (n.arguments?.length ?? 0) > 0) {
      const sig = checker.getResolvedSignature(n);
      const decl = sig?.declaration;
      const calleeFile = decl === undefined ? null : relOf(decl.getSourceFile().fileName);
      const callee = calleeFile === null ? null : placeOf(calleeFile);
      n.arguments!.forEach((arg, i) => {
        const argSym = typeSymbol(checker.getTypeAtLocation(arg));
        const argFile = declFile(argSym);
        const argPlace = argFile === null ? null : placeOf(argFile);
        const where = `src/main.ts:${String(lineOf(sf, arg))} hands ${arg.getText(sf)} (${argFile ?? '?'})`;
        if (callee === 'driving' && (argPlace === 'driven' || argPlace === 'outPort')) {
          const planted = calleeFile === PLANTED_FILE && decl !== undefined && ts.isConstructorDeclaration(decl) && argFile !== null && PLANTED_DECLS.has(argFile);
          if (!planted) add('SG2', `${where} to ${calleeFile ?? '?'} (a driving callee)`);
        }
        if (inCore(callee)) {
          if (argPlace === 'driving' || argPlace === 'root') add('SG1', `${where} to ${calleeFile ?? '?'} (a core callee)`);
          if (argPlace === 'driven') {
            const params = sig!.parameters;
            const param = params[Math.min(i, params.length - 1)];
            const paramSym = param === undefined ? undefined : typeSymbol(checker.getTypeOfSymbolAtLocation(param, n));
            const paramFile = declFile(paramSym);
            const typedByCore = paramFile !== null && inCore(placeOf(paramFile));
            if (!typedByCore || !declares(argSym, paramSym)) add('SG1', `${where} to ${calleeFile ?? '?'} as ${param?.name ?? '?'}${typedByCore ? ' (the class does not implement that out-port)' : ' (not typed by a core declaration)'}`);
          }
        }
      });
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

const verdicts: SubGoalVerdict[] = [
  { id: 'SG1', family: 'H7-hex core reaches a driven adapter', pass: evidence.SG1.length === 0, evidence: evidence.SG1 },
  { id: 'SG2', family: 'H7-hex driving adapter bypasses the in-ports', pass: evidence.SG2.length === 0, evidence: evidence.SG2 },
];
process.exitCode = report('f24-hex-laundry-lockers', treeArg, verdicts);
