/**
 * P2 oracle (hand-written with the puzzle, independent of the DaedalusArch instrument). Zero calls.
 *
 * SG1 (D6/D10, one owner of the tier rule): (a) no file under src/sales/ imports a membership path other than the
 * published interface (src/membership/index.ts, src/membership/contracts/**), except the planted debt
 * (ReceiptFooter.ts, exactly its seed imports); (b) no file under src/sales/ decides a tier from points: no relational
 * comparison whose text mentions points, and no call to a `tier()` method of a membership type.
 * SG1 addition (revision R4, PUZZLE-01 baseline, 2026-10-21): (c) no comparison under src/sales/ has an operand that is
 * the numeric literal 500, 1500 or 2000 (the tier thresholds, old and new), or a const initialised with one of them.
 * SG2 (D4 across contexts): (a) no function outside the domains makes two or more store writes; (b) no file under
 * src/sales/ calls a membership write (a method named award*, earn*, credit*, grant*, addPoints*, purchaseMade, or
 * save on a member store).
 *
 * Limits: a write reached through an indirection that sales does not name is not seen; the planted file may still be
 * copied, which SG1 (a) counts. Every failure on an agent tree is hand-read before it counts.
 *
 * Usage: npx tsx experiments/puzzle-01/puzzles/p2-loyalty/oracle.ts <tree>
 */
import ts from 'typescript';
import { fnName, functionsOf, importsOf, lineOf, loadTree, ownNodes, report, resolveRelative, typeNameOf, type SubGoalVerdict } from '../../tools/oracle-lib';

const WRITES = /^(save|saveAll|persist|store|insert|upsert|put|commit)$/;
const STORE_TYPE = /(Repository|Store|UnitOfWork|Database|Db)$/;
const MEMBER_WRITES = /^(award|earn|credit|grant|addPoints|purchaseMade)/i;
const PUBLIC = (p: string): boolean => p === 'src/membership/index.ts' || p.startsWith('src/membership/contracts/');
const PLANTED = new Map([['src/sales/application/ReceiptFooter.ts', new Set(['src/membership/domain/member/MemberRepository.ts', 'src/membership/domain/member/value-objects/MemberId.ts'])]]);

const treeArg = process.argv[2];
if (treeArg === undefined) {
  process.stderr.write('usage: oracle.ts <tree>\n');
  process.exit(2);
}
const tree = loadTree(treeArg);
const sg1: string[] = [];
const sg2: string[] = [];
const resolveIndex = (p: string | null): string | null => (p !== null && !tree.files.includes(p) && tree.files.includes(p.replace(/\.ts$/, '/index.ts')) ? p.replace(/\.ts$/, '/index.ts') : p);

for (const rel of tree.files) {
  const sf = tree.source(rel);
  const inSales = rel.startsWith('src/sales/');
  if (inSales) {
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
      if (inSales && ts.isBinaryExpression(n) && [ts.SyntaxKind.LessThanToken, ts.SyntaxKind.LessThanEqualsToken, ts.SyntaxKind.GreaterThanToken, ts.SyntaxKind.GreaterThanEqualsToken].includes(n.operatorToken.kind) && /point/i.test(n.getText(sf)) && !/\bcents\b|\bpoints\s*>\s*0\b/.test(n.getText(sf))) {
        sg1.push(`${rel}:${String(lineOf(sf, n))} ${fnName(fn, sf)} compares points: ${n.getText(sf)}`);
      }
      if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression)) continue;
      const method = n.expression.name.text;
      const recvType = typeNameOf(tree.checker, n.expression.expression);
      if (inSales && method === 'tier' && /^Member/.test(recvType)) sg1.push(`${rel}:${String(lineOf(sf, n))} ${fnName(fn, sf)} asks a ${recvType} for its tier`);
      if (inSales && (MEMBER_WRITES.test(method) || (WRITES.test(method) && /^Member/.test(recvType)))) sg2.push(`${rel}:${String(lineOf(sf, n))} ${fnName(fn, sf)} writes a member: ${n.expression.getText(sf)}`);
      if (outsideDomain && WRITES.test(method) && STORE_TYPE.test(recvType)) writes.push(`${n.expression.getText(sf)}@${String(lineOf(sf, n))}`);
    }
    if (writes.length >= 2) sg2.push(`${rel} ${fnName(fn, sf)}: ${writes.length} store writes (${writes.join('; ')})`);
  }
}

// R4 (2026-10-21): tier thresholds compared inside sales, as a literal or a const initialised with one.
const THRESHOLDS = new Set([500, 1500, 2000]);
const COMPARE = [ts.SyntaxKind.LessThanToken, ts.SyntaxKind.LessThanEqualsToken, ts.SyntaxKind.GreaterThanToken, ts.SyntaxKind.GreaterThanEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken];
const thresholdOf = (e: ts.Expression): number | null => {
  let x: ts.Expression = e;
  while (ts.isParenthesizedExpression(x) || ts.isAsExpression(x)) x = x.expression;
  if (ts.isNumericLiteral(x)) return THRESHOLDS.has(Number(x.text.replace(/_/g, ''))) ? Number(x.text.replace(/_/g, '')) : null;
  if (ts.isIdentifier(x) || ts.isPropertyAccessExpression(x)) {
    const decl = tree.checker.getSymbolAtLocation(x)?.valueDeclaration;
    if (decl !== undefined && (ts.isVariableDeclaration(decl) || ts.isPropertyDeclaration(decl)) && decl.initializer !== undefined && decl.getSourceFile().fileName.includes('/src/sales/')) return thresholdOf(decl.initializer);
  }
  return null;
};
for (const rel of tree.files.filter((f) => f.startsWith('src/sales/'))) {
  const sf = tree.source(rel);
  const visit = (n: ts.Node): void => {
    if (ts.isBinaryExpression(n) && COMPARE.includes(n.operatorToken.kind)) {
      const t = thresholdOf(n.left) ?? thresholdOf(n.right);
      if (t !== null) sg1.push(`${rel}:${String(lineOf(sf, n))} compares with the tier threshold ${String(t)}: ${n.getText(sf)}`);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

const verdicts: SubGoalVerdict[] = [
  { id: 'SG1', family: 'D6/D10', pass: sg1.length === 0, evidence: sg1 },
  { id: 'SG2', family: 'D4', pass: sg2.length === 0, evidence: sg2 },
];
process.exitCode = report('p2-loyalty', treeArg, verdicts);
