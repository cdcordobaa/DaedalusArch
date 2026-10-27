/**
 * f26 oracle (hand-written with the puzzle, independent of the DaedalusArch instrument). Zero calls.
 *
 * SG1 (D4, Vernon P4 "modify one aggregate instance per transaction"). A store call is any call on a receiver whose
 * type name ends in Store / Repository / UnitOfWork / Database / Db. It is a WRITE unless its method name reads
 * (starts with lookup / find / get / load / list / next / exists / has / count / read / peek / all), so a write counts
 * whatever it is called (keep, record, save, apply, commit, brewWith...). The sub-goal fails when
 *   (a) outside the domain, one function body makes two or more store writes (a lot and a batch, or two lots, kept by
 *       the same command), or
 *   (b) a store type declares a non-read method that some call in the tree reaches (by name, on a store-typed
 *       receiver) and whose parameters name both a lot and a batch (by type IngredientLot / BrewBatch or by a
 *       parameter name containing "lot" / "batch"), or take an array of either root: one store call that keeps the
 *       brew and the lot draws together is the same two-aggregate write.
 * SG2 (D5, Vernon P4 "model true invariants in consistency boundaries"). Outside the domain, no function holds a
 * business comparison: a relational operator that is not a loop bound or a length check (oracle-lib), or a
 * `localeCompare` call (calendar days are strings, so a date rule can hide in one). The best-before, enough-left and
 * fermentation-days rules therefore cannot be decided in an application function, a store or the composition root.
 *
 * Limits (stated, not hidden): a write inside a loop counts once (a reaction that keeps one lot per draw is one
 * write); writes split across two helper functions that the command calls are not added up; a comparison hidden
 * behind a helper the domain does not own, or written as `Math.min` / `Math.max` / subtraction-and-sign, is not seen;
 * any comparison inside `src/<context>/domain/` is accepted. "Reached" in (b) is by method name, which is
 * conservative. Every failure on an agent tree is hand-read before it counts.
 *
 * Usage (repository root): npx tsx experiments/trap-families/f26-ddd-brewery/oracle.ts <tree>
 */
import ts from 'typescript';
import { fnName, functionsOf, isBusinessComparison, lineOf, loadTree, ownNodes, report, typeNameOf, type SubGoalVerdict } from '../../puzzle-01/tools/oracle-lib';

const STORE_TYPE = /(Store|Repository|UnitOfWork|Database|Db)$/;
const READ_NAME = /^(lookup|find|get|load|list|next|exists|has|count|read|peek|all)/i;
const LOT = { type: /\bIngredientLot\b/, name: /lot/i };
const BATCH = { type: /\bBrewBatch\b/, name: /batch/i };

const treeArg = process.argv[2];
if (treeArg === undefined) {
  process.stderr.write('usage: oracle.ts <tree>\n');
  process.exit(2);
}
const tree = loadTree(treeArg);
const inDomain = (rel: string): boolean => /^src\/[^/]+\/domain\//.test(rel);

const storeCall = (n: ts.Node): ts.PropertyAccessExpression | undefined =>
  ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && STORE_TYPE.test(typeNameOf(tree.checker, n.expression.expression)) ? n.expression : undefined;

const sg1: string[] = [];
const sg2: string[] = [];
const reached = new Set<string>();

for (const rel of tree.files) {
  const sf = tree.source(rel);
  const visit = (n: ts.Node): void => {
    const call = storeCall(n);
    if (call !== undefined) reached.add(call.name.text);
    ts.forEachChild(n, visit);
  };
  visit(sf);
  if (inDomain(rel)) continue;
  for (const fn of functionsOf(sf)) {
    const writes: string[] = [];
    for (const n of ownNodes(fn)) {
      const call = storeCall(n);
      if (call !== undefined && !READ_NAME.test(call.name.text)) writes.push(`${call.getText(sf)}@${String(lineOf(sf, n))}`);
      if (isBusinessComparison(n, sf)) sg2.push(`${rel}:${String(lineOf(sf, n))} ${fnName(fn, sf)}: ${n.getText(sf)}`);
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'localeCompare') {
        sg2.push(`${rel}:${String(lineOf(sf, n))} ${fnName(fn, sf)}: ${n.getText(sf)}`);
      }
    }
    if (writes.length >= 2) sg1.push(`${rel} ${fnName(fn, sf)}: ${writes.length} store writes in one body: ${writes.join('; ')}`);
  }
}

// (b) store declarations whose reached write takes a lot and a batch together, or an array of either.
for (const rel of tree.files) {
  const sf = tree.source(rel);
  const visit = (n: ts.Node): void => {
    if ((ts.isInterfaceDeclaration(n) || ts.isClassDeclaration(n)) && n.name !== undefined && STORE_TYPE.test(n.name.text)) {
      for (const m of n.members) {
        if (!(ts.isMethodSignature(m) || ts.isMethodDeclaration(m) || ts.isPropertySignature(m)) || m.name === undefined || !ts.isIdentifier(m.name)) continue;
        const method = m.name.text;
        if (READ_NAME.test(method) || !reached.has(method)) continue;
        const params = ts.isPropertySignature(m)
          ? (m.type !== undefined && ts.isFunctionTypeNode(m.type) ? m.type.parameters : ts.factory.createNodeArray<ts.ParameterDeclaration>())
          : m.parameters;
        const mentions = (kind: typeof LOT): boolean => params.some((p) => kind.type.test(p.type?.getText(sf) ?? '') || (ts.isIdentifier(p.name) && kind.name.test(p.name.text)));
        const arrayOfRoot = params.some((p) => {
          const t = p.type?.getText(sf) ?? '';
          return (LOT.type.test(t) || BATCH.type.test(t)) && /\[\]|Array</.test(t);
        });
        if ((mentions(LOT) && mentions(BATCH)) || arrayOfRoot) {
          sg1.push(`${rel}:${String(lineOf(sf, m))} ${n.name.text}.${method} keeps ${arrayOfRoot ? 'several roots' : 'a lot and a batch'} in one store call`);
        }
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
process.exitCode = report('f26-ddd-brewery', treeArg, verdicts);
