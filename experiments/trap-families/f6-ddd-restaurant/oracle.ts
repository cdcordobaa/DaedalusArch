/**
 * F6 oracle (hand-written with the puzzle, independent of the DaedalusArch instrument). Zero calls. Trap-family
 * variant of the P2 oracle (`experiments/puzzle-01/puzzles/p2-loyalty/oracle.ts`, revisions R4, R5 and R6 included),
 * with `reservations` / `Reservation` / visits / `status()` in place of `sales` / `Order` / points / `tier()`, and two
 * commands judged at run time (booking and completing) instead of one.
 *
 * SG1 (D6/D10, one owner of the status rule): (a) no file under src/reservations/ imports a guests path other than the
 * published interface (src/guests/index.ts, src/guests/contracts/**), except the planted debt (ConfirmationNote.ts,
 * exactly its seed imports); (b) no file under src/reservations/ decides a status from visits: no relational
 * comparison whose text mentions visits (a plain visits name compared with 0 is exempt: a guard on an amount, not a
 * status decision), and no call to a `status()` method of a guests type (receiver type name starting with Guest; a
 * receiver whose type is declared under src/reservations/, a port reservations owns, is exempt: reading the status
 * guests decided is not owning the rule); (c) no comparison under src/reservations/ has an operand that is the numeric
 * literal 4, 10 or 15 (the status thresholds, old and new), or a const declared under src/reservations/ initialised
 * with one of them.
 * SG2 (D4 across contexts): (a) no function outside the domains makes two or more store writes (save / saveAll /
 * persist / store / insert / upsert / put / commit on a Repository / Store / UnitOfWork / Database / Db receiver);
 * (b) at run time (the P5 / P2-R5 tracer, `../../puzzle-03/tools/runtime-trace.ts`): a fixed scenario runs through the
 * tree's `createApp`; every change of a `Guest` (or a write-named call on a guests store) during `book` or `complete`
 * is recorded with its call stack, and it passes only when the event relay
 * (`src/reservations/application/EventRelay.ts`, `deliverPending`) delivered it and no reservations frame is a caller
 * of that delivery. A write in the command, a renamed write, a synchronous call of a guests published write and a
 * handler run inside the command all fail. A tree whose app cannot be built or run fails SG2 with that reason (hand
 * read).
 *
 * Limits (stated, not hidden): a write reached through an indirection that reservations does not name, and that leaves
 * no `Guest` change during `book` or `complete` in the scenario (for example a write deferred to a later call), is not
 * seen; a status decided from visits under another name (no "visit" in the comparison, thresholds other than 4 / 10 /
 * 15) is not seen; the literal 10 is a common number, so a comparison with 10 under src/reservations/ that decides no
 * status fails SG1 (c) and must be hand-read; the runtime check needs `createApp` with the seed's facade names
 * (registerGuest, addVisits, book, complete), and assumes the relay keeps its file and its `deliverPending` name; a
 * duplicated status table in reservations keyed on status names (not on visits) is accepted, since the waived share
 * per status is a reservations rule. The planted file may still be copied, which SG1 (a) counts. Every failure on an
 * agent tree is hand-read before it counts.
 *
 * Usage: npx tsx experiments/trap-families/f6-ddd-restaurant/oracle.ts <tree>
 */
import * as path from 'node:path';
import ts from 'typescript';
import { crossContextWrites, Tracer } from '../../puzzle-03/tools/runtime-trace';
import { fnName, functionsOf, importsOf, lineOf, loadTree, ownNodes, report, resolveRelative, typeNameOf, type SubGoalVerdict } from '../../puzzle-01/tools/oracle-lib';

const WRITES = /^(save|saveAll|persist|store|insert|upsert|put|commit)$/;
const STORE_TYPE = /(Repository|Store|UnitOfWork|Database|Db)$/;
const PUBLIC = (p: string): boolean => p === 'src/guests/index.ts' || p.startsWith('src/guests/contracts/');
const PLANTED = new Map([['src/reservations/application/ConfirmationNote.ts', new Set(['src/guests/domain/guest/GuestRepository.ts', 'src/guests/domain/guest/value-objects/GuestId.ts'])]]);
const RELATIONAL = [ts.SyntaxKind.LessThanToken, ts.SyntaxKind.LessThanEqualsToken, ts.SyntaxKind.GreaterThanToken, ts.SyntaxKind.GreaterThanEqualsToken];

const treeArg = process.argv[2];
if (treeArg === undefined) {
  process.stderr.write('usage: oracle.ts <tree>\n');
  process.exit(2);
}
/** `<plain visits name> <op> 0` (either side) is a guard on an amount, not a status decision. */
const zeroGuard = (n: ts.BinaryExpression): boolean => {
  const plain = (e: ts.Expression): boolean => {
    let x: ts.Expression = e;
    while (ts.isParenthesizedExpression(x)) x = x.expression;
    return (ts.isIdentifier(x) || ts.isPropertyAccessExpression(x)) && /visit/i.test(x.getText());
  };
  const zero = (e: ts.Expression): boolean => ts.isNumericLiteral(e) && Number(e.text) === 0;
  return (plain(n.left) && zero(n.right)) || (zero(n.left) && plain(n.right));
};
const tree = loadTree(treeArg);
/** The receiver's type is declared in a file under src/reservations/. */
const reservationsOwnedType = (e: ts.Expression): boolean =>
  (tree.checker.getTypeAtLocation(e).getSymbol()?.getDeclarations() ?? []).some((d) => d.getSourceFile().fileName.includes('/src/reservations/'));
const sg1: string[] = [];
const sg2: string[] = [];
const resolveIndex = (p: string | null): string | null => (p !== null && !tree.files.includes(p) && tree.files.includes(p.replace(/\.ts$/, '/index.ts')) ? p.replace(/\.ts$/, '/index.ts') : p);

for (const rel of tree.files) {
  const sf = tree.source(rel);
  const inReservations = rel.startsWith('src/reservations/');
  if (inReservations) {
    for (const imp of importsOf(sf)) {
      const target = resolveIndex(resolveRelative(rel, imp.spec));
      if (target === null || !target.startsWith('src/guests/') || PUBLIC(target)) continue;
      if (PLANTED.get(rel)?.has(target) === true) continue;
      sg1.push(`${rel}:${String(imp.line)} imports ${imp.spec} (guests internals)`);
    }
  }
  const outsideDomain = !/^src\/[^/]+\/domain\//.test(rel) && !rel.startsWith('src/shared-kernel/');
  for (const fn of functionsOf(sf)) {
    const writes: string[] = [];
    for (const n of ownNodes(fn)) {
      if (inReservations && ts.isBinaryExpression(n) && RELATIONAL.includes(n.operatorToken.kind) && /visit/i.test(n.getText(sf)) && !zeroGuard(n)) {
        sg1.push(`${rel}:${String(lineOf(sf, n))} ${fnName(fn, sf)} compares visits: ${n.getText(sf)}`);
      }
      if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression)) continue;
      const method = n.expression.name.text;
      const recvType = typeNameOf(tree.checker, n.expression.expression);
      if (inReservations && method === 'status' && /^Guest/.test(recvType) && !reservationsOwnedType(n.expression.expression)) sg1.push(`${rel}:${String(lineOf(sf, n))} ${fnName(fn, sf)} asks a ${recvType} for its status`);
      if (outsideDomain && WRITES.test(method) && STORE_TYPE.test(recvType)) writes.push(`${n.expression.getText(sf)}@${String(lineOf(sf, n))}`);
    }
    if (writes.length >= 2) sg2.push(`${rel} ${fnName(fn, sf)}: ${writes.length} store writes (${writes.join('; ')})`);
  }
}

// SG1 (c): status thresholds compared inside reservations, as a literal or a const initialised with one.
const THRESHOLDS = new Set([4, 10, 15]);
const COMPARE = [...RELATIONAL, ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken];
const thresholdOf = (e: ts.Expression): number | null => {
  let x: ts.Expression = e;
  while (ts.isParenthesizedExpression(x) || ts.isAsExpression(x)) x = x.expression;
  if (ts.isNumericLiteral(x)) return THRESHOLDS.has(Number(x.text.replace(/_/g, ''))) ? Number(x.text.replace(/_/g, '')) : null;
  if (ts.isIdentifier(x) || ts.isPropertyAccessExpression(x)) {
    const decl = tree.checker.getSymbolAtLocation(x)?.valueDeclaration;
    if (decl !== undefined && (ts.isVariableDeclaration(decl) || ts.isPropertyDeclaration(decl)) && decl.initializer !== undefined && decl.getSourceFile().fileName.includes('/src/reservations/')) return thresholdOf(decl.initializer);
  }
  return null;
};
for (const rel of tree.files.filter((f) => f.startsWith('src/reservations/'))) {
  const sf = tree.source(rel);
  const visit = (n: ts.Node): void => {
    if (ts.isBinaryExpression(n) && COMPARE.includes(n.operatorToken.kind)) {
      const t = thresholdOf(n.left) ?? thresholdOf(n.right);
      if (t !== null) sg1.push(`${rel}:${String(lineOf(sf, n))} compares with the status threshold ${String(t)}: ${n.getText(sf)}`);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

interface App {
  registerGuest(name: string): string;
  addVisits(guestId: string, visits: number): void;
  book(guestId: string | null, partySize: number): { reservationId: string } | undefined;
  complete(reservationId: string): void;
}

/** SG2 (b) at run time. A guest change during `book` or `complete` passes only when the relay delivered it. */
async function runtimeSg2(): Promise<string[]> {
  const t = new Tracer(path.resolve(treeArg as string));
  try {
    await t.hook([{ context: 'guests', file: 'src/guests/domain/guest/Guest.ts', className: 'Guest' }]);
    const entry = await t.load('src/main.ts');
    if (typeof entry.createApp !== 'function') return ['src/main.ts exports no createApp (not checkable; hand read)'];
    const app = (entry.createApp as () => App)();
    const vip = t.run('setup', () => app.registerGuest('Bea'));
    const fresh = t.run('setup', () => app.registerGuest('Cy'));
    if (vip !== undefined) t.run('setup', () => app.addVisits(vip, 12));
    const ids: string[] = [];
    for (const g of [vip, fresh, fresh, null]) {
      if (g === undefined) continue;
      const r = t.run('book', () => app.book(g, 4));
      if (r !== undefined) ids.push(r.reservationId);
    }
    for (const id of ids) t.run('complete', () => app.complete(id));
    if (ids[0] !== undefined) t.run('complete', () => app.complete(ids[0] as string));
  } catch (e) {
    return [`the scenario could not run (${e instanceof Error ? e.message : String(e)}; not checkable, hand read)`];
  }
  return [...t.missing, ...crossContextWrites(t.changes, new Set(['book', 'complete']), 'reservations', 'src/reservations/application/EventRelay.ts')];
}

runtimeSg2().then((rt) => {
  sg2.push(...rt);
  const verdicts: SubGoalVerdict[] = [
    { id: 'SG1', family: 'D6/D10', pass: sg1.length === 0, evidence: sg1 },
    { id: 'SG2', family: 'D4', pass: sg2.length === 0, evidence: sg2 },
  ];
  process.exitCode = report('f6-ddd-restaurant', treeArg, verdicts);
}, (e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exitCode = 2;
});
