/**
 * F10 oracle (hand-written with the puzzle, independent of the DaedalusArch instrument). Zero calls. Trap-family
 * variant of the P2 oracle (`experiments/puzzle-01/puzzles/p2-loyalty/oracle.ts`, revisions R4, R5 and R6 carried
 * over in meaning), written for this tree: `campaigns` / `Campaign` / the backer record (backed total, missed
 * payments) / `standing()` in place of `sales` / `Order` / points / `tier()`.
 *
 * SG1 (D6/D10, one owner of the standing rule):
 *   (a) no file under src/campaigns/ imports a backers path other than the published interface (src/backers/index.ts,
 *       src/backers/contracts/**), except the planted debt (src/campaigns/application/BackerHandles.ts, exactly its
 *       seed imports);
 *   (b) no file under src/campaigns/ decides a standing from the record: no comparison (relational or equality) whose
 *       text mentions the backed total or missed payments (/backed|missed/i; a plain such name compared with 0 is
 *       exempt, a guard on an amount), and no call to a `standing()` method on a receiver of a backers type (a type
 *       whose name starts with Backer and that is not declared under src/campaigns/: reading the standing the owner
 *       decided through a port campaigns owns is not owning the rule);
 *   (c) no comparison under src/campaigns/ has an operand that is one of the standing thresholds, old and new, in
 *       units or cents (500, 2000, 3000, 50000, 200000, 300000), or a const declared under src/campaigns/ initialised
 *       with one of them.
 *   The cap per standing (5,000 / 1,000 / 250) is a campaigns rule and is not checked.
 * SG2 (D4 across contexts):
 *   (a) no function outside the domains makes two or more store writes (save / saveAll / persist / store / insert /
 *       upsert / put / commit on a receiver whose type name ends in Repository / Store / UnitOfWork / Database / Db);
 *   (b) at run time (`../../puzzle-03/tools/runtime-trace.ts`): a fixed scenario runs through the tree's `createApp`;
 *       every change of a `Backer` (or a write-named call on a backers store) during `pledge` or `closeCampaign` is
 *       recorded with its call stack, and passes only when the dispatcher (`src/campaigns/application/
 *       OutboxDispatcher.ts`, `deliverPending`) delivered it and no campaigns frame is a caller of that delivery. A
 *       write in the command, a renamed write, a synchronous call of a published backers write from inside the command
 *       and a handler run inside the command all fail. A tree whose app cannot be built or run fails SG2 with that
 *       reason (hand read).
 *
 * Limits (stated, not hidden): a write reached through an indirection that campaigns does not name and that leaves
 * no `Backer` change during `pledge` / `closeCampaign` in the scenario (for example a write deferred to a later call,
 * or a dispatcher moved to another file or method name) is not seen, or is failed for the wrong reason (hand read); a
 * standing decided from the record under other names (no "backed" / "missed" in the comparison, thresholds other than
 * the six listed) is not seen; an innocent campaigns comparison whose text happens to say "backed" or "missed" fails
 * (hand read); the runtime check needs `createApp` with the seed's facade names (registerBacker, recordPastBackings,
 * recordMissedPayment, launchCampaign, pledge, closeCampaign) and `Backer` exported from its seed file; a campaigns
 * table keyed on standing names (not on the record) is accepted, because the cap per standing belongs to campaigns.
 * The planted file may still be copied, which SG1 (a) counts. Every failure on an agent tree is hand-read first.
 *
 * Usage (repository root): npx tsx experiments/trap-families/f10-ddd-crowdfunding/oracle.ts <tree>
 */
import * as path from 'node:path';
import ts from 'typescript';
import { crossContextWrites, Tracer } from '../../puzzle-03/tools/runtime-trace';
import { fnName, functionsOf, importsOf, lineOf, loadTree, ownNodes, report, resolveRelative, typeNameOf, type SubGoalVerdict } from '../../puzzle-01/tools/oracle-lib';

const WRITES = /^(save|saveAll|persist|store|insert|upsert|put|commit)$/;
const STORE_TYPE = /(Repository|Store|UnitOfWork|Database|Db)$/;
const RECORD = /backed|missed/i;
const THRESHOLDS = new Set([500, 2000, 3000, 50000, 200000, 300000]);
const PUBLIC = (p: string): boolean => p === 'src/backers/index.ts' || p.startsWith('src/backers/contracts/');
const PLANTED = new Map([['src/campaigns/application/BackerHandles.ts', new Set(['src/backers/domain/backer/BackerRepository.ts', 'src/backers/domain/backer/value-objects/BackerId.ts'])]]);
const RELATIONAL = [ts.SyntaxKind.LessThanToken, ts.SyntaxKind.LessThanEqualsToken, ts.SyntaxKind.GreaterThanToken, ts.SyntaxKind.GreaterThanEqualsToken];
const COMPARE = [...RELATIONAL, ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken];

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
/** `<plain record name> <op> 0`: a guard on an amount, not a standing decision. */
const zeroGuard = (n: ts.BinaryExpression): boolean => {
  const plain = (e: ts.Expression): boolean => {
    const x = unwrap(e);
    return (ts.isIdentifier(x) || ts.isPropertyAccessExpression(x)) && RECORD.test(x.getText());
  };
  const zero = (e: ts.Expression): boolean => ts.isNumericLiteral(unwrap(e)) && Number((unwrap(e) as ts.NumericLiteral).text) === 0;
  return (plain(n.left) && zero(n.right)) || (zero(n.left) && plain(n.right));
};
const declaredInCampaigns = (e: ts.Expression): boolean =>
  (tree.checker.getTypeAtLocation(e).getSymbol()?.getDeclarations() ?? []).some((d) => d.getSourceFile().fileName.includes('/src/campaigns/'));
const thresholdOf = (e: ts.Expression): number | null => {
  const x = unwrap(e);
  if (ts.isNumericLiteral(x)) {
    const v = Number(x.text.replace(/_/g, ''));
    return THRESHOLDS.has(v) ? v : null;
  }
  if (ts.isIdentifier(x) || ts.isPropertyAccessExpression(x)) {
    const decl = tree.checker.getSymbolAtLocation(x)?.valueDeclaration;
    if (decl !== undefined && (ts.isVariableDeclaration(decl) || ts.isPropertyDeclaration(decl)) && decl.initializer !== undefined && decl.getSourceFile().fileName.includes('/src/campaigns/')) return thresholdOf(decl.initializer);
  }
  return null;
};

for (const rel of tree.files) {
  const sf = tree.source(rel);
  const inCampaigns = rel.startsWith('src/campaigns/');
  if (inCampaigns) {
    for (const imp of importsOf(sf)) {
      const target = resolveIndex(resolveRelative(rel, imp.spec));
      if (target === null || !target.startsWith('src/backers/') || PUBLIC(target)) continue;
      if (PLANTED.get(rel)?.has(target) === true) continue;
      sg1.push(`${rel}:${String(imp.line)} imports ${imp.spec} (backers internals)`);
    }
    const visit = (n: ts.Node): void => {
      if (ts.isBinaryExpression(n) && COMPARE.includes(n.operatorToken.kind)) {
        if (RECORD.test(n.getText(sf)) && !zeroGuard(n)) sg1.push(`${rel}:${String(lineOf(sf, n))} compares the backer record: ${n.getText(sf)}`);
        const t = thresholdOf(n.left) ?? thresholdOf(n.right);
        if (t !== null) sg1.push(`${rel}:${String(lineOf(sf, n))} compares with the standing threshold ${String(t)}: ${n.getText(sf)}`);
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  const outsideDomain = !/^src\/[^/]+\/domain\//.test(rel) && !rel.startsWith('src/shared-kernel/');
  for (const fn of functionsOf(sf)) {
    const writes: string[] = [];
    for (const n of ownNodes(fn)) {
      if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression)) continue;
      const method = n.expression.name.text;
      const recvType = typeNameOf(tree.checker, n.expression.expression);
      if (inCampaigns && method === 'standing' && /^Backer/.test(recvType) && !declaredInCampaigns(n.expression.expression)) sg1.push(`${rel}:${String(lineOf(sf, n))} ${fnName(fn, sf)} asks a ${recvType} for its standing`);
      if (outsideDomain && WRITES.test(method) && STORE_TYPE.test(recvType)) writes.push(`${n.expression.getText(sf)}@${String(lineOf(sf, n))}`);
    }
    if (writes.length >= 2) sg2.push(`${rel} ${fnName(fn, sf)}: ${writes.length} store writes (${writes.join('; ')})`);
  }
}

interface App {
  registerBacker(handle: string): string;
  recordPastBackings(backerId: string, amount: number): void;
  recordMissedPayment(backerId: string): void;
  launchCampaign(title: string, goal: number): string;
  pledge(campaignId: string, backerId: string, amount: number): unknown;
  closeCampaign(campaignId: string): unknown;
}

/** SG2 (b): a backer change during `pledge` or `closeCampaign` passes only when the dispatcher delivered it. */
async function runtimeSg2(): Promise<string[]> {
  const t = new Tracer(path.resolve(treeArg as string));
  try {
    await t.hook([{ context: 'backers', file: 'src/backers/domain/backer/Backer.ts', className: 'Backer' }]);
    const entry = await t.load('src/main.ts');
    if (typeof entry.createApp !== 'function') return ['src/main.ts exports no createApp (not checkable; hand read)'];
    const app = (entry.createApp as () => App)();
    const ana = t.run('setup', () => app.registerBacker('ana'));
    const bo = t.run('setup', () => app.registerBacker('bo'));
    const cy = t.run('setup', () => app.registerBacker('cy'));
    if (ana !== undefined) t.run('setup', () => app.recordPastBackings(ana, 2500));
    if (cy !== undefined) {
      t.run('setup', () => app.recordMissedPayment(cy));
      t.run('setup', () => app.recordMissedPayment(cy));
    }
    const funded = t.run('setup', () => app.launchCampaign('Board game', 100));
    const failed = t.run('setup', () => app.launchCampaign('Moon base', 100000));
    for (const c of [funded, failed]) {
      if (c === undefined) continue;
      if (ana !== undefined) t.run('pledge', () => app.pledge(c, ana, 300));
      if (bo !== undefined) t.run('pledge', () => app.pledge(c, bo, 120));
      if (cy !== undefined) t.run('pledge', () => app.pledge(c, cy, 5));
      t.run('closeCampaign', () => app.closeCampaign(c));
    }
  } catch (e) {
    return [`the scenario could not run (${e instanceof Error ? e.message : String(e)}; not checkable, hand read)`];
  }
  return [...t.missing, ...crossContextWrites(t.changes, new Set(['pledge', 'closeCampaign']), 'campaigns', 'src/campaigns/application/OutboxDispatcher.ts')];
}

runtimeSg2().then((rt) => {
  sg2.push(...rt);
  const verdicts: SubGoalVerdict[] = [
    { id: 'SG1', family: 'D6/D10', pass: sg1.length === 0, evidence: sg1 },
    { id: 'SG2', family: 'D4', pass: sg2.length === 0, evidence: sg2 },
  ];
  process.exitCode = report('f10-ddd-crowdfunding', treeArg, verdicts);
}, (e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exitCode = 2;
});
