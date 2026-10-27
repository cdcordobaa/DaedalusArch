/**
 * F4 oracle (hand-written with the puzzle, independent of the DaedalusArch instrument). Zero calls. Trap-family
 * variant of the P2 oracle (`experiments/puzzle-01/puzzles/p2-loyalty/oracle.ts`, revisions R4, R5 and R6 included),
 * with `bookings` / `Booking` / visits / `level()` in place of `sales` / `Order` / points / `tier()`.
 *
 * SG1 (D6/D10, one owner of the level rule): (a) no file under src/bookings/ imports a membership path other than the
 * published interface (src/membership/index.ts, src/membership/contracts/**), except the planted debt
 * (ConfirmationNote.ts, exactly its seed imports); (b) no file under src/bookings/ decides a level from visits: no
 * relational comparison whose text mentions visits (a plain visits name compared with 0 is exempt: a guard on an
 * amount, not a level decision), and no call to a `level()` method of a membership type (a receiver whose type is
 * declared under src/bookings/, a port bookings owns, is exempt: reading the level membership decided is not owning
 * the rule); (c) no comparison under src/bookings/ has an operand that is the numeric literal 25, 45 or 60 (the level
 * thresholds, old and new), or a const declared under src/bookings/ initialised with one of them.
 * SG2 (D4 across contexts): (a) no function outside the domains makes two or more store writes (save / saveAll /
 * persist / store / insert / upsert / put / commit on a Repository / Store / UnitOfWork / Database / Db receiver);
 * (b) at run time (the P5 / P2-R5 tracer, `../../puzzle-03/tools/runtime-trace.ts`): a fixed scenario runs through the
 * tree's `createApp`; every change of a `Member` (or a write-named call on a membership store) during `bookClass` is
 * recorded with its call stack, and it passes only when the event relay (`src/bookings/application/EventRelay.ts`,
 * `deliverPending`) delivered it and no bookings frame is a caller of that delivery. A write in the command, a renamed
 * write, a synchronous call of membership's published write and a handler run inside the command all fail. A tree whose
 * app cannot be built or run fails SG2 with that reason (hand read).
 *
 * Limits (stated, not hidden): a write reached through an indirection that bookings does not name, and that leaves no
 * `Member` change during `bookClass` in the scenario (for example a write deferred to a later call), is not seen; a
 * level decided from visits under another name (no "visit" in the comparison, thresholds other than 25 / 45 / 60) is
 * not seen; the runtime check needs `createApp` with the seed's facade names (join, addVisits, bookClass), and assumes
 * the relay keeps its file and its `deliverPending` name; a duplicated level table in bookings keyed on level names
 * (not on visits) is accepted, since the discount per level is a bookings rule. The planted file may still be copied,
 * which SG1 (a) counts. Every failure on an agent tree is hand-read before it counts.
 *
 * Usage: npx tsx experiments/trap-families/f4-ddd-gym-classes/oracle.ts <tree>
 */
import * as path from 'node:path';
import ts from 'typescript';
import { crossContextWrites, Tracer } from '../../puzzle-03/tools/runtime-trace';
import { fnName, functionsOf, importsOf, lineOf, loadTree, ownNodes, report, resolveRelative, typeNameOf, type SubGoalVerdict } from '../../puzzle-01/tools/oracle-lib';

const WRITES = /^(save|saveAll|persist|store|insert|upsert|put|commit)$/;
const STORE_TYPE = /(Repository|Store|UnitOfWork|Database|Db)$/;
const PUBLIC = (p: string): boolean => p === 'src/membership/index.ts' || p.startsWith('src/membership/contracts/');
const PLANTED = new Map([['src/bookings/application/ConfirmationNote.ts', new Set(['src/membership/domain/member/MemberRepository.ts', 'src/membership/domain/member/value-objects/MemberId.ts'])]]);
const RELATIONAL = [ts.SyntaxKind.LessThanToken, ts.SyntaxKind.LessThanEqualsToken, ts.SyntaxKind.GreaterThanToken, ts.SyntaxKind.GreaterThanEqualsToken];

const treeArg = process.argv[2];
if (treeArg === undefined) {
  process.stderr.write('usage: oracle.ts <tree>\n');
  process.exit(2);
}
/** `<plain visits name> <op> 0` (either side) is a guard on an amount, not a level decision. */
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
/** The receiver's type is declared in a file under src/bookings/. */
const bookingsOwnedType = (e: ts.Expression): boolean =>
  (tree.checker.getTypeAtLocation(e).getSymbol()?.getDeclarations() ?? []).some((d) => d.getSourceFile().fileName.includes('/src/bookings/'));
const sg1: string[] = [];
const sg2: string[] = [];
const resolveIndex = (p: string | null): string | null => (p !== null && !tree.files.includes(p) && tree.files.includes(p.replace(/\.ts$/, '/index.ts')) ? p.replace(/\.ts$/, '/index.ts') : p);

for (const rel of tree.files) {
  const sf = tree.source(rel);
  const inBookings = rel.startsWith('src/bookings/');
  if (inBookings) {
    for (const imp of importsOf(sf)) {
      const target = resolveIndex(resolveRelative(rel, imp.spec));
      if (target === null || !target.startsWith('src/membership/') || PUBLIC(target)) continue;
      if (PLANTED.get(rel)?.has(target) === true) continue;
      sg1.push(`${rel}:${String(imp.line)} imports ${imp.spec} (membership internals)`);
    }
  }
  const outsideDomain = !/^src\/[^/]+\/domain\//.test(rel) && !rel.startsWith('src/shared-kernel/');
  for (const fn of functionsOf(sf)) {
    const writes: string[] = [];
    for (const n of ownNodes(fn)) {
      if (inBookings && ts.isBinaryExpression(n) && RELATIONAL.includes(n.operatorToken.kind) && /visit/i.test(n.getText(sf)) && !zeroGuard(n)) {
        sg1.push(`${rel}:${String(lineOf(sf, n))} ${fnName(fn, sf)} compares visits: ${n.getText(sf)}`);
      }
      if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression)) continue;
      const method = n.expression.name.text;
      const recvType = typeNameOf(tree.checker, n.expression.expression);
      if (inBookings && method === 'level' && /^Member/.test(recvType) && !bookingsOwnedType(n.expression.expression)) sg1.push(`${rel}:${String(lineOf(sf, n))} ${fnName(fn, sf)} asks a ${recvType} for its level`);
      if (outsideDomain && WRITES.test(method) && STORE_TYPE.test(recvType)) writes.push(`${n.expression.getText(sf)}@${String(lineOf(sf, n))}`);
    }
    if (writes.length >= 2) sg2.push(`${rel} ${fnName(fn, sf)}: ${writes.length} store writes (${writes.join('; ')})`);
  }
}

// SG1 (c): level thresholds compared inside bookings, as a literal or a const initialised with one.
const THRESHOLDS = new Set([25, 45, 60]);
const COMPARE = [...RELATIONAL, ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken];
const thresholdOf = (e: ts.Expression): number | null => {
  let x: ts.Expression = e;
  while (ts.isParenthesizedExpression(x) || ts.isAsExpression(x)) x = x.expression;
  if (ts.isNumericLiteral(x)) return THRESHOLDS.has(Number(x.text.replace(/_/g, ''))) ? Number(x.text.replace(/_/g, '')) : null;
  if (ts.isIdentifier(x) || ts.isPropertyAccessExpression(x)) {
    const decl = tree.checker.getSymbolAtLocation(x)?.valueDeclaration;
    if (decl !== undefined && (ts.isVariableDeclaration(decl) || ts.isPropertyDeclaration(decl)) && decl.initializer !== undefined && decl.getSourceFile().fileName.includes('/src/bookings/')) return thresholdOf(decl.initializer);
  }
  return null;
};
for (const rel of tree.files.filter((f) => f.startsWith('src/bookings/'))) {
  const sf = tree.source(rel);
  const visit = (n: ts.Node): void => {
    if (ts.isBinaryExpression(n) && COMPARE.includes(n.operatorToken.kind)) {
      const t = thresholdOf(n.left) ?? thresholdOf(n.right);
      if (t !== null) sg1.push(`${rel}:${String(lineOf(sf, n))} compares with the level threshold ${String(t)}: ${n.getText(sf)}`);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

interface App {
  join(name: string): string;
  addVisits(memberId: string, visits: number): void;
  bookClass(memberId: string | null, classes: { classCode: string; sessions: number; fee: number }[]): unknown;
}

/** SG2 (b) at run time. A member change during `bookClass` passes only when the relay delivered it. */
async function runtimeSg2(): Promise<string[]> {
  const t = new Tracer(path.resolve(treeArg as string));
  try {
    await t.hook([{ context: 'membership', file: 'src/membership/domain/member/Member.ts', className: 'Member' }]);
    const entry = await t.load('src/main.ts');
    if (typeof entry.createApp !== 'function') return ['src/main.ts exports no createApp (not checkable; hand read)'];
    const app = (entry.createApp as () => App)();
    const premium = t.run('setup', () => app.join('Bea'));
    const fresh = t.run('setup', () => app.join('Cy'));
    if (premium !== undefined) t.run('setup', () => app.addVisits(premium, 50));
    const hundred = [{ classCode: 'YOGA', sessions: 4, fee: 25 }];
    if (premium !== undefined) t.run('bookClass', () => app.bookClass(premium, hundred));
    if (fresh !== undefined) {
      t.run('bookClass', () => app.bookClass(fresh, [{ classCode: 'SPIN', sessions: 2, fee: 3.5 }]));
      t.run('bookClass', () => app.bookClass(fresh, hundred));
    }
    t.run('bookClass', () => app.bookClass(null, hundred));
  } catch (e) {
    return [`the scenario could not run (${e instanceof Error ? e.message : String(e)}; not checkable, hand read)`];
  }
  return [...t.missing, ...crossContextWrites(t.changes, new Set(['bookClass']), 'bookings', 'src/bookings/application/EventRelay.ts')];
}

runtimeSg2().then((rt) => {
  sg2.push(...rt);
  const verdicts: SubGoalVerdict[] = [
    { id: 'SG1', family: 'D6/D10', pass: sg1.length === 0, evidence: sg1 },
    { id: 'SG2', family: 'D4', pass: sg2.length === 0, evidence: sg2 },
  ];
  process.exitCode = report('f4-ddd-gym-classes', treeArg, verdicts);
}, (e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exitCode = 2;
});
