/**
 * F3 oracle (hand-written with the puzzle, independent of the DaedalusArch instrument). Zero calls. Trap-family
 * variant of the P1 oracle (`experiments/puzzle-01/puzzles/p1-transfers/oracle.ts`, revisions R4 and R6 included),
 * with the aggregate root `Car` and car ids in place of `Account` and account ids.
 *
 * SG1 (D4, Vernon P4 "modify one aggregate instance per transaction"): outside the domain, no single function body
 * makes two or more persistence writes (calls named save / saveAll / persist / store / insert / upsert / put / commit
 * on a receiver whose type is a repository, store or unit of work), and no repository-like type declares a write
 * method taking two or more aggregate roots or an array of them.
 * SG1 (b): no store or repository type (interface or class whose name ends in Repository / Store / UnitOfWork /
 * Database / Db) declares a method, whatever its name, that takes two Car values or two car ids and is not a
 * read (names starting find / get / load / list / exists / has / count / read / by / of / take are reads): a single
 * store call that writes both cars is the same two-aggregate write.
 * A store method that no call in the tree reaches is not a write, so the two declaration clauses skip it. "Reached" is
 * by name: the declaration counts when any call in the tree invokes a method of that name on a store-typed receiver.
 * SG2 (D5, Vernon P4 "model true invariants in consistency boundaries"): outside the domain, no function holds a
 * business comparison (a relational operator that is not a loop bound or a length check), so the cleaning gap
 * or the overlap rule cannot be decided in an application service, the composition root or a store.
 *
 * Limits (stated, not hidden): a write in a loop counts once; a comparison hidden behind a helper the domain does not
 * own is not seen; a comparison in the domain is always accepted; a limit checked with `===` or with `.length` (for
 * example `list.length === 3`) is not a relational operator and is not seen. F3-specific: a gap decided outside the
 * domain by calling a domain predicate (for example widening the slot with minute arithmetic in a service and asking
 * `slot.overlaps(...)`) holds no relational operator outside the domain and is not seen; such a tree passes SG2
 * mechanically and must be hand-read. Every failure, and every SG2 pass on a tree whose move service builds a widened
 * slot, is hand-read before it counts.
 *
 * Usage: npx tsx experiments/trap-families/f3-ddd-car-sharing/oracle.ts <tree>
 */
import ts from 'typescript';
import { fnName, functionsOf, isBusinessComparison, lineOf, loadTree, ownNodes, report, typeNameOf, type SubGoalVerdict } from '../../puzzle-01/tools/oracle-lib';

const WRITES = /^(save|saveAll|persist|store|insert|upsert|put|commit)$/;
const STORE_TYPE = /(Repository|Store|UnitOfWork|Database|Db)$/;
const ROOTS = ['Car'];

const treeArg = process.argv[2];
if (treeArg === undefined) {
  process.stderr.write('usage: oracle.ts <tree>\n');
  process.exit(2);
}
const tree = loadTree(treeArg);
const outsideDomain = tree.files.filter((f) => !/^src\/[^/]+\/domain\//.test(f) && !f.startsWith('src/shared-kernel/'));

const sg1: string[] = [];
const sg2: string[] = [];
for (const rel of outsideDomain) {
  const sf = tree.source(rel);
  for (const fn of functionsOf(sf)) {
    const writes: string[] = [];
    for (const n of ownNodes(fn)) {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && WRITES.test(n.expression.name.text)) {
        const recvType = typeNameOf(tree.checker, n.expression.expression);
        if (STORE_TYPE.test(recvType)) writes.push(`${n.expression.getText(sf)}(${n.arguments.map((a) => a.getText(sf)).join(', ')})@${String(lineOf(sf, n))}`);
      }
      if (isBusinessComparison(n, sf)) sg2.push(`${rel}:${String(lineOf(sf, n))} ${fnName(fn, sf)}: ${n.getText(sf)}`);
    }
    if (writes.length >= 2) sg1.push(`${rel} ${fnName(fn, sf)}: ${writes.join('; ')}`);
  }
}

// Store method names that some call in the tree reaches on a store-typed receiver.
const calledStoreMethods = new Set<string>();
for (const rel of tree.files) {
  const sf = tree.source(rel);
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && STORE_TYPE.test(typeNameOf(tree.checker, n.expression.expression))) {
      calledStoreMethods.add(n.expression.name.text);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

// Repository-like declarations whose write method takes several aggregate roots.
for (const rel of tree.files) {
  const sf = tree.source(rel);
  const visit = (n: ts.Node): void => {
    if ((ts.isInterfaceDeclaration(n) || ts.isClassDeclaration(n)) && n.name !== undefined && STORE_TYPE.test(n.name.text)) {
      for (const m of n.members) {
        if ((ts.isMethodSignature(m) || ts.isMethodDeclaration(m)) && m.name !== undefined && ts.isIdentifier(m.name) && WRITES.test(m.name.text) && calledStoreMethods.has(m.name.text)) {
          const rootParams = m.parameters.filter((p) => p.type !== undefined && ROOTS.some((r) => new RegExp(`\\b${r}\\b`).test(p.type!.getText(sf))));
          const arrayRoot = rootParams.some((p) => /\[\]|Array</.test(p.type!.getText(sf)));
          if (rootParams.length >= 2 || arrayRoot) sg1.push(`${rel}:${String(lineOf(sf, m))} ${n.name.text}.${m.name.text} takes several aggregate roots`);
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

// SG1 (b): any non-read store method taking two cars or two car ids, whatever its name.
const READ_NAME = /^(find|get|load|list|exists|has|count|read|by|of|take)/i;
const CAR_ID_NAME = /^(from|to|source|target|old|new|current|next|origin|destination|leaving|receiving)(Car)?(Id)?$|car.*id$/i;
for (const rel of tree.files) {
  const sf = tree.source(rel);
  const visit = (n: ts.Node): void => {
    if ((ts.isInterfaceDeclaration(n) || ts.isClassDeclaration(n)) && n.name !== undefined && STORE_TYPE.test(n.name.text)) {
      for (const m of n.members) {
        if (!(ts.isMethodSignature(m) || ts.isMethodDeclaration(m)) || m.name === undefined || !ts.isIdentifier(m.name)) continue;
        if (READ_NAME.test(m.name.text) || WRITES.test(m.name.text) || !calledStoreMethods.has(m.name.text)) continue;
        const cars = m.parameters.filter((p) => p.type !== undefined && /\bCar\b/.test(p.type.getText(sf))).length;
        const ids = m.parameters.filter((p) => {
          const t = p.type?.getText(sf) ?? '';
          return /\bCarId\b/.test(t) || (/^string$/.test(t) && ts.isIdentifier(p.name) && CAR_ID_NAME.test(p.name.text));
        }).length;
        if (cars >= 2 || ids >= 2) sg1.push(`${rel}:${String(lineOf(sf, m))} ${n.name.text}.${m.name.text} takes two cars (${String(cars)} Car, ${String(ids)} car ids) in one store call`);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

const verdicts: SubGoalVerdict[] = [
  { id: 'SG1', family: 'D4', pass: sg1.length === 0, evidence: sg1 },
  { id: 'SG2', family: 'D5', pass: sg2.length === 0, evidence: sg2 },
];
process.exitCode = report('f3-ddd-car-sharing', treeArg, verdicts);
