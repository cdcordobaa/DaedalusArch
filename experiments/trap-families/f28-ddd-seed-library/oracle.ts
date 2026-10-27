/**
 * F28 oracle (hand-written with the puzzle, independent of the DaedalusArch instrument). Zero calls.
 *
 * SG1 (D4, Vernon P4 "modify one aggregate instance per transaction"; here the split of one SeedLot into two):
 *   (a) outside the domain (src/<context>/domain/** and src/shared-kernel/**), no function makes two or more store
 *       writes. A store is any interface or class whose name ends in Shelf / Store / Repository / Catalogue / Registry
 *       / Archive / UnitOfWork / Database / Db, or that declares a method taking or returning a SeedLot (so a store
 *       renamed to anything is still a store). A write is ANY method called on a store-typed receiver whose name is
 *       not a read (reads start with find / get / load / list / exists / has / count / read / by / of / at / all /
 *       next / peek / lookup / fetch / search / query / is / contains): `keep`, `file`, `record`, `put`, `shelve` and
 *       any other renamed write all count. A call to a function or method of the tree that itself writes counts as
 *       its writes (resolved through the type checker, to a fixed point), so a wrapper such as `keepBoth()` or a
 *       second helper that writes the new lot is still two writes in the calling function.
 *   (b) no store type declares a write method, reached by some call in the tree (by name, on a store-typed receiver),
 *       that takes two SeedLot values, an array of SeedLot, or two lot numbers (LotNumber, or a string parameter whose
 *       name mentions lot / origin / source / target / portion): one store call that keeps both lots of a split is the
 *       same two-instance write.
 * SG2 (D5, Vernon P4 "model true invariants in consistency boundaries"): outside the domain, no function holds a
 *   business comparison (a relational operator that is not a loop bound or a length / index / size check), so the
 *   quarantine period and the germination floor cannot be decided in a service, the composition root or a store.
 *
 * Limits (stated, not hidden): a write in a loop counts once; a write reached through a dynamic dispatch the checker
 * cannot resolve (a callback, a listener table, an element of an array of functions) is not followed, which is also
 * why the event-delivered write of the clean line is not added to the command; a comparison hidden behind a helper
 * the domain does not own (for example Math.min, a library call) is not seen; a comparison in the domain is always
 * accepted, whatever it decides; a store typed `any` or `unknown` is not recognised. Every failure on an agent tree is
 * hand-read before it counts.
 *
 * Usage (repository root): npx tsx experiments/trap-families/f28-ddd-seed-library/oracle.ts <tree>
 */
import ts from 'typescript';
import { fnName, functionsOf, isBusinessComparison, lineOf, loadTree, ownNodes, report, typeNameOf, type SubGoalVerdict } from '../../puzzle-01/tools/oracle-lib';

const ROOT = 'SeedLot';
const STORE_NAME = /(Shelf|Store|Repository|Catalogue|Registry|Archive|UnitOfWork|Database|Db)$/;
const READ = /^(find|get|load|list|exists|has|count|read|by|of|at|all|next|peek|lookup|fetch|search|query|is|contains)/i;
const LOT_ID_NAME = /lot|origin|source|target|portion/i;

const treeArg = process.argv[2];
if (treeArg === undefined) {
  process.stderr.write('usage: oracle.ts <tree>\n');
  process.exit(2);
}
const tree = loadTree(treeArg);
const inDomain = (rel: string): boolean => /^src\/[^/]+\/domain\//.test(rel) || rel.startsWith('src/shared-kernel/');
const mentionsRoot = (t: ts.TypeNode | undefined, sf: ts.SourceFile): boolean => t !== undefined && new RegExp(`\\b${ROOT}\\b`).test(t.getText(sf));

// 1. Store types: by name, or by handling SeedLot values.
const storeTypes = new Set<string>();
for (const rel of tree.files) {
  const sf = tree.source(rel);
  const visit = (n: ts.Node): void => {
    if ((ts.isInterfaceDeclaration(n) || ts.isClassDeclaration(n)) && n.name !== undefined && n.name.text !== ROOT) {
      const handlesLots = n.members.some((m) => (ts.isMethodSignature(m) || ts.isMethodDeclaration(m)) && (m.parameters.some((p) => mentionsRoot(p.type, sf)) || mentionsRoot(m.type, sf)));
      if (STORE_NAME.test(n.name.text) || handlesLots) storeTypes.add(n.name.text);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
const isStoreReceiver = (e: ts.Expression): boolean => storeTypes.has(typeNameOf(tree.checker, e));
const isStoreWrite = (n: ts.Node): n is ts.CallExpression & { expression: ts.PropertyAccessExpression } =>
  ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && !READ.test(n.expression.name.text) && isStoreReceiver(n.expression.expression);

// 2. Writes per function, following calls to functions of the tree that write (fixed point).
interface Fn { readonly rel: string; readonly sf: ts.SourceFile; readonly node: ts.FunctionLikeDeclaration; direct: string[]; calls: ts.CallExpression[] }
const fns: Fn[] = [];
const byDecl = new Map<ts.Node, Fn>();
for (const rel of tree.files) {
  const sf = tree.source(rel);
  for (const node of functionsOf(sf)) {
    const f: Fn = { rel, sf, node, direct: [], calls: [] };
    for (const n of ownNodes(node)) {
      if (isStoreWrite(n)) f.direct.push(`${n.expression.getText(sf)}(${n.arguments.map((a) => a.getText(sf)).join(', ')})@${String(lineOf(sf, n))}`);
      else if (ts.isCallExpression(n)) f.calls.push(n);
    }
    fns.push(f);
    byDecl.set(node, f);
  }
}
const calleeOf = (call: ts.CallExpression): Fn | undefined => {
  let sym = tree.checker.getSymbolAtLocation(ts.isPropertyAccessExpression(call.expression) ? call.expression.name : call.expression);
  if (sym !== undefined && sym.flags & ts.SymbolFlags.Alias) sym = tree.checker.getAliasedSymbol(sym);
  for (const d of sym?.declarations ?? []) {
    const hit = byDecl.get(d) ?? (ts.isVariableDeclaration(d) && d.initializer !== undefined ? byDecl.get(d.initializer) : undefined);
    if (hit !== undefined) return hit;
  }
  return undefined;
};
const total = new Map<Fn, string[]>(fns.map((f) => [f, [...f.direct]]));
for (let changed = true, rounds = 0; changed && rounds < 20; rounds += 1) {
  changed = false;
  for (const f of fns) {
    const acc = [...f.direct];
    for (const call of f.calls) {
      const g = calleeOf(call);
      if (g !== undefined && g !== f && inDomain(g.rel) === false) for (const w of total.get(g) ?? []) acc.push(`${call.expression.getText(f.sf)}() -> ${w}`);
    }
    if (acc.length !== (total.get(f) ?? []).length) {
      total.set(f, acc);
      changed = true;
    }
  }
}

const sg1: string[] = [];
const sg2: string[] = [];
for (const f of fns) {
  if (inDomain(f.rel)) continue;
  const writes = total.get(f) ?? [];
  if (writes.length >= 2) sg1.push(`${f.rel} ${fnName(f.node, f.sf)}: ${writes.join('; ')}`);
  for (const n of ownNodes(f.node)) if (isBusinessComparison(n, f.sf)) sg2.push(`${f.rel}:${String(lineOf(f.sf, n))} ${fnName(f.node, f.sf)}: ${n.getText(f.sf)}`);
}

// 3. Store declarations whose reached write takes both lots of a split.
const reached = new Set<string>();
for (const rel of tree.files) {
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && isStoreReceiver(n.expression.expression)) reached.add(n.expression.name.text);
    ts.forEachChild(n, visit);
  };
  visit(tree.source(rel));
}
for (const rel of tree.files) {
  const sf = tree.source(rel);
  const visit = (n: ts.Node): void => {
    if ((ts.isInterfaceDeclaration(n) || ts.isClassDeclaration(n)) && n.name !== undefined && storeTypes.has(n.name.text)) {
      for (const m of n.members) {
        if (!(ts.isMethodSignature(m) || ts.isMethodDeclaration(m)) || m.name === undefined || !ts.isIdentifier(m.name)) continue;
        if (READ.test(m.name.text) || !reached.has(m.name.text)) continue;
        const lots = m.parameters.filter((p) => mentionsRoot(p.type, sf));
        const lotArray = lots.some((p) => /\[\]|Array</.test(p.type!.getText(sf)));
        const ids = m.parameters.filter((p) => {
          const t = p.type?.getText(sf) ?? '';
          return /\bLotNumber\b/.test(t) || (t === 'string' && ts.isIdentifier(p.name) && LOT_ID_NAME.test(p.name.text));
        }).length;
        if (lots.length >= 2 || lotArray || ids >= 2) sg1.push(`${rel}:${String(lineOf(sf, m))} ${n.name.text}.${m.name.text} writes several lots in one call (${String(lots.length)} SeedLot, ${String(ids)} lot ids${lotArray ? ', array' : ''})`);
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
process.exitCode = report('f28-ddd-seed-library', treeArg, verdicts);
