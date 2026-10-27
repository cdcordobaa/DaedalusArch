/**
 * F12 oracle (hand-written with the puzzle, independent of the DaedalusArch instrument). Zero calls. Trap-family
 * variant of the P2 oracle (`experiments/puzzle-01/puzzles/p2-loyalty/oracle.ts`, revisions R4, R5 and R6 carried
 * over in meaning), written for this tree: `market` / `MarketDay` / the vendor record (inspection score, strikes) /
 * `licenceStatus()` in place of `sales` / `Order` / points / `tier()`.
 *
 * SG1 (D6/D10, one owner of the licence status):
 *   (a) no file under src/market/ imports a licensing path other than the published interface (src/licensing/index.ts,
 *       src/licensing/published/**), except the planted debt (src/market/application/PitchPlan.ts, exactly its seed
 *       imports);
 *   (b) no file under src/market/ decides a licence status from the record: no comparison (relational or equality)
 *       whose text mentions the inspection score or the strikes (/score|strike/i; a plain such name compared with 0 is
 *       exempt, a guard on an amount), and no call to a `licenceStatus()` method on a receiver whose type is not
 *       declared under src/market/ (reading the status licensing decided, through a port the market owns or through
 *       the published `LicenceSheet.status`, is not owning the rule);
 *   (c) no comparison under src/market/ has an operand that is a full-licence score threshold, old or new (85, 75), or
 *       a const declared under src/market/ initialised with one of them.
 *   Which standing a kind of pitch admits (hall: full only; open: full or basic; suspended: none) is a market rule and
 *   is not checked.
 * SG2 (D4 across contexts):
 *   (a) no function outside the domains makes two or more store writes (save / saveAll / persist / store / insert /
 *       upsert / put / commit / write on a receiver whose type name ends in Repository / Store / UnitOfWork /
 *       Database / Db);
 *   (b) at run time (`../../puzzle-03/tools/runtime-trace.ts`): a fixed scenario runs through the tree's `createApp`;
 *       every change of a `Vendor` (or a write-named call on a licensing store) during `openDay`, `book`, `checkIn` or
 *       `reportNoShow` is recorded with its call stack, and passes only when the courier
 *       (`src/market/application/NoticeCourier.ts`, `deliverPendingNotices`) delivered it and no market frame is a
 *       caller of that delivery. The seed's own check-in reaction (licensing keeps the last trading date) passes this
 *       way. A write in the command, a renamed write, a synchronous call of a published licensing write from inside the
 *       command and a listener run inside the command all fail. A tree whose app cannot be built or run fails SG2 with
 *       that reason (hand read).
 *
 * Limits (stated, not hidden): a write reached through an indirection that the market does not name and that leaves
 * no `Vendor` change during the four market calls of the scenario (for example a write deferred to a later call, or a
 * courier moved to another file or method name) is not seen, or is failed for the wrong reason (hand read); a status
 * decided from the record under other names (no "score" / "strike" in the comparison, thresholds other than 85 / 75,
 * a strike count compared under another name) is not seen; an innocent market comparison whose text happens to say
 * "score" or "strike" fails (hand read); the runtime check needs `createApp` with the seed's names (registerVendor,
 * recordInspection, issueStrike, openDay, book, checkIn, reportNoShow) and `Vendor` exported from its seed file; a
 * market table keyed on status names (not on the record) is accepted, because pitch admission belongs to the market.
 * The planted file may still be copied, which SG1 (a) counts. Every failure on an agent tree is hand-read first.
 *
 * Usage (repository root): npx tsx experiments/trap-families/f12-ddd-farmers-market/oracle.ts <tree>
 */
import * as path from 'node:path';
import ts from 'typescript';
import { crossContextWrites, Tracer } from '../../puzzle-03/tools/runtime-trace';
import { fnName, functionsOf, importsOf, lineOf, loadTree, ownNodes, report, resolveRelative, typeNameOf, type SubGoalVerdict } from '../../puzzle-01/tools/oracle-lib';

const WRITES = /^(save|saveAll|persist|store|insert|upsert|put|commit|write)$/;
const STORE_TYPE = /(Repository|Store|UnitOfWork|Database|Db)$/;
const RECORD = /score|strike/i;
const THRESHOLDS = new Set([85, 75]);
const PUBLIC = (p: string): boolean => p === 'src/licensing/index.ts' || p.startsWith('src/licensing/published/');
const PLANTED = new Map([['src/market/application/PitchPlan.ts', new Set(['src/licensing/domain/vendor/VendorRepository.ts', 'src/licensing/domain/vendor/value-objects/VendorId.ts'])]]);
const COMPARE = [ts.SyntaxKind.LessThanToken, ts.SyntaxKind.LessThanEqualsToken, ts.SyntaxKind.GreaterThanToken, ts.SyntaxKind.GreaterThanEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken];

const treeArg = process.argv[2];
if (treeArg === undefined) {
  process.stderr.write('usage: oracle.ts <tree>\n');
  process.exit(2);
}
const tree = loadTree(treeArg);
const sg1: string[] = [];
const sg2: string[] = [];
const resolveIndex = (p: string | null): string | null => (p !== null && !tree.files.includes(p) && tree.files.includes(p.replace(/\.ts$/, '/index.ts')) ? p.replace(/\.ts$/, '/index.ts') : p);
const unwrap = (e: ts.Expression): ts.Expression => {
  let x = e;
  while (ts.isParenthesizedExpression(x) || ts.isAsExpression(x) || ts.isNonNullExpression(x)) x = x.expression;
  return x;
};
/** `<plain record name> <op> 0`: a guard on an amount, not a status decision. */
const zeroGuard = (n: ts.BinaryExpression): boolean => {
  const plain = (e: ts.Expression): boolean => {
    const x = unwrap(e);
    return (ts.isIdentifier(x) || ts.isPropertyAccessExpression(x)) && RECORD.test(x.getText());
  };
  const zero = (e: ts.Expression): boolean => {
    const x = unwrap(e);
    return ts.isNumericLiteral(x) && Number(x.text) === 0;
  };
  return (plain(n.left) && zero(n.right)) || (zero(n.left) && plain(n.right));
};
const declaredInMarket = (e: ts.Expression): boolean =>
  (tree.checker.getTypeAtLocation(e).getSymbol()?.getDeclarations() ?? []).some((d) => d.getSourceFile().fileName.includes('/src/market/'));
const thresholdOf = (e: ts.Expression): number | null => {
  const x = unwrap(e);
  if (ts.isNumericLiteral(x)) {
    const v = Number(x.text.replace(/_/g, ''));
    return THRESHOLDS.has(v) ? v : null;
  }
  if (ts.isIdentifier(x) || ts.isPropertyAccessExpression(x)) {
    const decl = tree.checker.getSymbolAtLocation(x)?.valueDeclaration;
    if (decl !== undefined && (ts.isVariableDeclaration(decl) || ts.isPropertyDeclaration(decl)) && decl.initializer !== undefined && decl.getSourceFile().fileName.includes('/src/market/')) return thresholdOf(decl.initializer);
  }
  return null;
};

for (const rel of tree.files) {
  const sf = tree.source(rel);
  const inMarket = rel.startsWith('src/market/');
  if (inMarket) {
    for (const imp of importsOf(sf)) {
      const target = resolveIndex(resolveRelative(rel, imp.spec));
      if (target === null || !target.startsWith('src/licensing/') || PUBLIC(target)) continue;
      if (PLANTED.get(rel)?.has(target) === true) continue;
      sg1.push(`${rel}:${String(imp.line)} imports ${imp.spec} (licensing internals)`);
    }
    const visit = (n: ts.Node): void => {
      if (ts.isBinaryExpression(n) && COMPARE.includes(n.operatorToken.kind)) {
        if (RECORD.test(n.getText(sf)) && !zeroGuard(n)) sg1.push(`${rel}:${String(lineOf(sf, n))} compares the vendor record: ${n.getText(sf)}`);
        const t = thresholdOf(n.left) ?? thresholdOf(n.right);
        if (t !== null) sg1.push(`${rel}:${String(lineOf(sf, n))} compares with the full-licence threshold ${String(t)}: ${n.getText(sf)}`);
      }
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'licenceStatus' && !declaredInMarket(n.expression.expression)) {
        sg1.push(`${rel}:${String(lineOf(sf, n))} asks a ${typeNameOf(tree.checker, n.expression.expression)} for its licence status`);
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  const outsideDomain = !/^src\/[^/]+\/domain\//.test(rel) && !rel.startsWith('src/shared-kernel/');
  if (!outsideDomain) continue;
  for (const fn of functionsOf(sf)) {
    const writes: string[] = [];
    for (const n of ownNodes(fn)) {
      if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression)) continue;
      if (WRITES.test(n.expression.name.text) && STORE_TYPE.test(typeNameOf(tree.checker, n.expression.expression))) writes.push(`${n.expression.getText(sf)}@${String(lineOf(sf, n))}`);
    }
    if (writes.length >= 2) sg2.push(`${rel} ${fnName(fn, sf)}: ${String(writes.length)} store writes (${writes.join('; ')})`);
  }
}

interface App {
  registerVendor(tradingName: string): string;
  recordInspection(vendorId: string, score: number): void;
  issueStrike(vendorId: string): void;
  openDay(date: string, pitches: { code: string; kind: string }[]): void;
  book(date: string, pitch: string, vendorId: string): unknown;
  checkIn(date: string, vendorId: string): void;
  reportNoShow(date: string, pitch: string): void;
}
const LAYOUT = [{ code: 'H1', kind: 'hall' }, { code: 'O1', kind: 'open' }, { code: 'O2', kind: 'open' }];
const MARKET_CALLS = new Set(['openDay', 'book', 'checkIn', 'reportNoShow']);

/** SG2 (b) at run time: a vendor change during a market call passes only when the courier delivered it. */
async function runtimeSg2(): Promise<string[]> {
  const t = new Tracer(path.resolve(treeArg as string));
  try {
    await t.hook([{ context: 'licensing', file: 'src/licensing/domain/vendor/Vendor.ts', className: 'Vendor' }]);
    const entry = await t.load('src/main.ts');
    if (typeof entry.createApp !== 'function') return ['src/main.ts exports no createApp (not checkable; hand read)'];
    const app = (entry.createApp as () => App)();
    const full = t.run('setup', () => app.registerVendor('Green Acres'));
    const basic = t.run('setup', () => app.registerVendor('Honey Hill'));
    const late = t.run('setup', () => app.registerVendor('Late Again'));
    if (full !== undefined) t.run('setup', () => app.recordInspection(full, 91));
    if (basic !== undefined) t.run('setup', () => app.recordInspection(basic, 60));
    if (late !== undefined) for (let i = 0; i < 3; i += 1) t.run('setup', () => app.issueStrike(late));
    for (const day of ['2026-11-07', '2026-11-14']) {
      t.run('openDay', () => app.openDay(day, LAYOUT));
      if (full !== undefined) t.run('book', () => app.book(day, 'H1', full));
      if (basic !== undefined) t.run('book', () => app.book(day, 'O1', basic));
      if (late !== undefined) t.run('book', () => app.book(day, 'O2', late));
      if (full !== undefined) t.run('checkIn', () => app.checkIn(day, full));
      t.run('reportNoShow', () => app.reportNoShow(day, 'O1'));
      t.run('reportNoShow', () => app.reportNoShow(day, 'O2'));
    }
  } catch (e) {
    return [`the scenario could not run (${e instanceof Error ? e.message : String(e)}; not checkable, hand read)`];
  }
  return [...t.missing, ...crossContextWrites(t.changes, MARKET_CALLS, 'market', 'src/market/application/NoticeCourier.ts')];
}

runtimeSg2().then((rt) => {
  sg2.push(...rt);
  const verdicts: SubGoalVerdict[] = [
    { id: 'SG1', family: 'D6/D10', pass: sg1.length === 0, evidence: sg1 },
    { id: 'SG2', family: 'D4', pass: sg2.length === 0, evidence: sg2 },
  ];
  process.exitCode = report('f12-ddd-farmers-market', treeArg, verdicts);
}, (e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exitCode = 2;
});
