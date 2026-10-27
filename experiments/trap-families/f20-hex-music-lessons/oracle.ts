/**
 * F20 oracle (trap family of p6-workshop-jobs, translated to hexagonal; hand-written with the puzzle, independent of
 * the DaedalusArch instrument). Zero calls.
 *
 * Places, by path: core = src/domain/** and src/application/** (with the out-ports src/application/ports/out/** as a
 * sub-place); driving = src/adapters/in/**; driven = src/adapters/out/**; root = src/main.ts.
 * A file USES a place when it (a) imports or re-exports a file there (type-only included); (b) refers to a symbol
 * declared there (aliases resolved; types, values and member names all count); (c) constructs, with `new`, a class
 * declared there; (d) loads a file there with require() or import().
 *
 * SG1 (the core takes a shortcut through an adapter; ARCHITECTURE.md 1 and 2):
 *   no core file uses the driving place, the driven place or the root; and
 *   (e) in src/main.ts, no argument whose type is declared in a driven file is handed to a constructor or function
 *       declared in the core unless the parameter it fills is typed by a core declaration (so a core parameter typed
 *       `any`, `unknown` or `object` that receives an adapter counts).
 * SG2 (a driving adapter goes round the application; ARCHITECTURE.md 3):
 *   no driving file uses the driven place, the out-ports or the root; and
 *   (e) in src/main.ts, no argument whose type is declared in a driven file or an out-port is handed to a constructor
 *       or function declared in a driving file.
 * No file is excepted: the seed's only calendar use (TempoTeachingHours behind the TeachingHours out-port, wired in
 * src/main.ts) is clean.
 *
 * Limits: a value typed `any` / `unknown` inside a file, or read by computed keys, hides its declaration; (e) sees only
 * calls written in src/main.ts (not factories in other files); a core out-port that copies the Tempo client's method
 * shape, satisfied by the client itself, is not counted (that is a vendor-shaped port, another family); a driving file
 * typed with a workflow class instead of its in-port is not counted; driven-to-driven use is not judged; only src/ is
 * read. Every failure on an agent tree is hand-read before it counts.
 *
 * Usage: npx tsx experiments/trap-families/f20-hex-music-lessons/oracle.ts <tree>
 */
import * as path from 'node:path';
import ts from 'typescript';
import { importsOf, lineOf, loadTree, report, resolveRelative, type SubGoalVerdict } from '../../puzzle-01/tools/oracle-lib';

type Place = 'core' | 'outPort' | 'driving' | 'driven' | 'root' | 'other';
const placeOf = (rel: string): Place => {
  if (rel === 'src/main.ts') return 'root';
  if (rel.startsWith('src/application/ports/out/')) return 'outPort';
  if (rel.startsWith('src/domain/') || rel.startsWith('src/application/')) return 'core';
  if (rel.startsWith('src/adapters/in/')) return 'driving';
  if (rel.startsWith('src/adapters/out/')) return 'driven';
  return 'other';
};
const isCore = (p: Place): boolean => p === 'core' || p === 'outPort';
/** Places a file of each kind may not use, and the sub-goal that counts it. */
const FORBIDDEN: Partial<Record<'core' | 'driving', { places: Place[]; sg: 'SG1' | 'SG2' }>> = {
  core: { places: ['driving', 'driven', 'root'], sg: 'SG1' },
  driving: { places: ['driven', 'outPort', 'root'], sg: 'SG2' },
};

const treeArg = process.argv[2];
if (treeArg === undefined) {
  process.stderr.write('usage: oracle.ts <tree>\n');
  process.exit(2);
}
const tree = loadTree(treeArg);
const relOf = (fileName: string): string => path.relative(tree.root, fileName).split(path.sep).join('/');
const ev: Record<'SG1' | 'SG2', string[]> = { SG1: [], SG2: [] };
const seen = new Set<string>();
const add = (sg: 'SG1' | 'SG2', e: string): void => {
  if (seen.has(`${sg}|${e}`)) return;
  seen.add(`${sg}|${e}`);
  ev[sg].push(e);
};
const resolved = (s: ts.Symbol | undefined): ts.Symbol | undefined => (s !== undefined && (s.flags & ts.SymbolFlags.Alias) !== 0 ? tree.checker.getAliasedSymbol(s) : s);
/** Tree-relative file of a symbol's first declaration, or null outside src/. */
const declFile = (s: ts.Symbol | undefined): string | null => {
  const d = resolved(s)?.declarations?.[0];
  if (d === undefined) return null;
  const rel = relOf(d.getSourceFile().fileName);
  return rel.startsWith('src/') ? rel : null;
};
const typeFile = (t: ts.Type): string | null => declFile(t.getSymbol() ?? t.aliasSymbol);

for (const rel of tree.files) {
  const place = placeOf(rel);
  const kind = isCore(place) ? 'core' : place === 'driving' ? 'driving' : null;
  const sf = tree.source(rel);
  if (kind !== null) {
    const rule = FORBIDDEN[kind]!;
    const bad = (target: string | null): boolean => target !== null && rule.places.includes(placeOf(target));
    for (const imp of importsOf(sf)) {
      const target = resolveRelative(rel, imp.spec);
      if (bad(target)) add(rule.sg, `${rel}:${String(imp.line)} imports ${imp.spec} (${placeOf(target!)})`);
    }
    const visit = (n: ts.Node): void => {
      if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) return;
      if (ts.isCallExpression(n) && n.arguments.length > 0 && ts.isStringLiteral(n.arguments[0]!) && (n.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(n.expression) && n.expression.text === 'require'))) {
        const target = resolveRelative(rel, n.arguments[0].text);
        if (bad(target)) add(rule.sg, `${rel}:${String(lineOf(sf, n))} loads ${n.arguments[0].text} at run time (${placeOf(target!)})`);
      }
      if (ts.isNewExpression(n)) {
        const target = declFile(tree.checker.getSymbolAtLocation(n.expression));
        if (bad(target)) add(rule.sg, `${rel}:${String(lineOf(sf, n))} constructs ${n.expression.getText(sf)} declared in ${target!} (${placeOf(target!)})`);
      }
      if (ts.isIdentifier(n)) {
        const target = declFile(tree.checker.getSymbolAtLocation(n));
        if (bad(target)) add(rule.sg, `${rel}:${String(lineOf(sf, n))} uses ${n.text} declared in ${target!} (${placeOf(target!)})`);
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  if (place === 'root') {
    const visit = (n: ts.Node): void => {
      if ((ts.isNewExpression(n) || ts.isCallExpression(n)) && n.arguments !== undefined && n.arguments.length > 0) {
        const calleeFile = declFile(tree.checker.getSymbolAtLocation(n.expression));
        const calleePlace = calleeFile === null ? 'other' : placeOf(calleeFile);
        const sig = tree.checker.getResolvedSignature(n);
        n.arguments.forEach((arg, i) => {
          const argFile = typeFile(tree.checker.getTypeAtLocation(arg));
          if (argFile === null) return;
          const argPlace = placeOf(argFile);
          const where = `${rel}:${String(lineOf(sf, arg))} hands ${arg.getText(sf)} (typed in ${argFile}) to ${n.expression.getText(sf)}`;
          if (calleePlace === 'driving' && (argPlace === 'driven' || argPlace === 'outPort')) add('SG2', `${where}, declared in a driving file`);
          if (isCore(calleePlace) && argPlace === 'driven') {
            const param = sig?.parameters[Math.min(i, (sig?.parameters.length ?? 1) - 1)];
            const paramFile = param === undefined ? null : typeFile(tree.checker.getTypeOfSymbolAtLocation(param, n));
            if (paramFile === null || !isCore(placeOf(paramFile))) add('SG1', `${where}, a core callee whose parameter is not typed by the core`);
          }
        });
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
}

const verdicts: SubGoalVerdict[] = [
  { id: 'SG1', family: 'H7-hex core uses an adapter', pass: ev.SG1.length === 0, evidence: ev.SG1 },
  { id: 'SG2', family: 'H7-hex driving adapter bypasses the application', pass: ev.SG2.length === 0, evidence: ev.SG2 },
];
process.exitCode = report('f20-hex-music-lessons', treeArg, verdicts);
