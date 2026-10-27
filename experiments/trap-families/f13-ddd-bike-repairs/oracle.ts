/**
 * F13 oracle (hand-written with the puzzle, independent of the DaedalusArch instrument). Zero calls. Trap-family
 * variant of the P1 oracle (`experiments/puzzle-01/puzzles/p1-transfers/oracle.ts`, revisions R4 and R6 included),
 * with two aggregate roots of different types, `RepairJob` and `Stockroom`, in one context (`workshop`).
 *
 * SG1 (D4, Vernon P4 "modify one aggregate instance per transaction"):
 *  (a) outside the domain, no single function body makes two or more store writes. A store write is any call on a
 *      receiver whose type name ends in Repository / Store / UnitOfWork / Database / Db and whose method is not a read
 *      (names starting find / get / load / list / exists / has / count / read / by / of / take / next are reads).
 *      This is wider than P1 (which counted only save / persist / store / insert / upsert / put / commit), because the
 *      tempting second write here is a stock deduction that an agent may name deduct / consume / use / remove;
 *  (b) no store type declares a non-read method, reached by some call in the tree (R6, by name), that takes two or
 *      more aggregate roots (any mix of RepairJob and Stockroom, or an array of them) or two or more root ids
 *      (a `JobId`, or a `string` parameter named like a job or stockroom id);
 *  (c) no such reached non-read store method takes a job (RepairJob or job id) together with parts or stock (a
 *      parameter whose name or type mentions part / sku / stock / inventory): one store call that completes the job
 *      and moves the shelf count is the same two-aggregate write.
 * SG2 (D5, Vernon P4 "model true invariants in consistency boundaries"): outside the domain, no function holds a
 * business comparison (a relational operator that is not a loop bound or a length check), so the labour cap or the
 * shelf count cannot be decided in an application service, the composition root or a store.
 *
 * Limits (stated, not hidden): a write in a loop counts once; a write made through a helper function called twice is
 * seen only inside the helper; a store whose type name has none of the suffixes is not seen; a comparison hidden
 * behind a helper the domain does not own is not seen; a comparison in the domain is always accepted; a cap checked
 * with `===` or with a library call (for example `Math.max`) is not a relational operator and is not seen. SG1 says
 * nothing about where the stock check lives: a service that reads the stockroom and asks it to check (a domain method)
 * passes. Every failure on an agent tree is hand-read before it counts.
 *
 * Usage: npx tsx experiments/trap-families/f13-ddd-bike-repairs/oracle.ts <tree>
 */
import ts from 'typescript';
import { fnName, functionsOf, isBusinessComparison, lineOf, loadTree, ownNodes, report, typeNameOf, type SubGoalVerdict } from '../../puzzle-01/tools/oracle-lib';

const STORE_TYPE = /(Repository|Store|UnitOfWork|Database|Db)$/;
const READ_NAME = /^(find|get|load|list|exists|has|count|read|by|of|take|next)/i;
const ROOTS = ['RepairJob', 'Stockroom'];
const ROOT_ID_TYPE = /\b(JobId|StockroomId)\b/;
const ROOT_ID_NAME = /^(job|repairJob|stockroom|room)(Id)?$|(job|stockroom).*id$/i;
const JOB_ID_NAME = /^(job|repairJob)(Id)?$|job.*id$/i;
const STOCK_PARAM = /part|sku|stock|inventory/i;

const treeArg = process.argv[2];
if (treeArg === undefined) {
  process.stderr.write('usage: oracle.ts <tree>\n');
  process.exit(2);
}
const tree = loadTree(treeArg);
const outsideDomain = tree.files.filter((f) => !/^src\/[^/]+\/domain\//.test(f) && !f.startsWith('src/shared-kernel/'));
const isStoreWrite = (n: ts.Node): n is ts.CallExpression & { expression: ts.PropertyAccessExpression } =>
  ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && !READ_NAME.test(n.expression.name.text)
  && STORE_TYPE.test(typeNameOf(tree.checker, n.expression.expression));

const sg1: string[] = [];
const sg2: string[] = [];
for (const rel of outsideDomain) {
  const sf = tree.source(rel);
  for (const fn of functionsOf(sf)) {
    const writes: string[] = [];
    for (const n of ownNodes(fn)) {
      if (isStoreWrite(n)) writes.push(`${n.expression.getText(sf)}(${n.arguments.map((a) => a.getText(sf)).join(', ')})@${String(lineOf(sf, n))}`);
      if (isBusinessComparison(n, sf)) sg2.push(`${rel}:${String(lineOf(sf, n))} ${fnName(fn, sf)}: ${n.getText(sf)}`);
    }
    if (writes.length >= 2) sg1.push(`${rel} ${fnName(fn, sf)}: ${writes.join('; ')}`);
  }
}

// R6: store method names that some call in the tree reaches on a store-typed receiver.
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

// (b) and (c): reached non-read store methods whose parameters reach two aggregates.
for (const rel of tree.files) {
  const sf = tree.source(rel);
  const visit = (n: ts.Node): void => {
    if ((ts.isInterfaceDeclaration(n) || ts.isClassDeclaration(n)) && n.name !== undefined && STORE_TYPE.test(n.name.text)) {
      for (const m of n.members) {
        if (!(ts.isMethodSignature(m) || ts.isMethodDeclaration(m)) || m.name === undefined || !ts.isIdentifier(m.name)) continue;
        if (READ_NAME.test(m.name.text) || !calledStoreMethods.has(m.name.text)) continue;
        const typeOf = (p: ts.ParameterDeclaration): string => p.type?.getText(sf) ?? '';
        const nameOf = (p: ts.ParameterDeclaration): string => (ts.isIdentifier(p.name) ? p.name.text : '');
        const rootParams = m.parameters.filter((p) => ROOTS.some((r) => new RegExp(`\\b${r}\\b`).test(typeOf(p))));
        const arrayRoot = rootParams.some((p) => /\[\]|Array</.test(typeOf(p)));
        const ids = m.parameters.filter((p) => ROOT_ID_TYPE.test(typeOf(p)) || (/^string$/.test(typeOf(p)) && ROOT_ID_NAME.test(nameOf(p)))).length;
        const where = `${rel}:${String(lineOf(sf, m))} ${n.name.text}.${m.name.text}`;
        if (rootParams.length >= 2 || arrayRoot || ids >= 2) {
          sg1.push(`${where} takes several aggregates (${String(rootParams.length)} roots, ${String(ids)} root ids) in one store call`);
          continue;
        }
        const job = m.parameters.some((p) => /\bRepairJob\b|\bJobId\b/.test(typeOf(p)) || (/^string$/.test(typeOf(p)) && JOB_ID_NAME.test(nameOf(p))));
        const stock = m.parameters.some((p) => !/\bRepairJob\b|\bJobId\b/.test(typeOf(p)) && (STOCK_PARAM.test(nameOf(p)) || STOCK_PARAM.test(typeOf(p))));
        if (job && stock) sg1.push(`${where} takes a job and parts or stock in one store call`);
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
process.exitCode = report('f13-ddd-bike-repairs', treeArg, verdicts);
