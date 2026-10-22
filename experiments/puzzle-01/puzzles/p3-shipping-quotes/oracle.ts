/**
 * P3 oracle (hand-written with the puzzle, independent of the DaedalusArch instrument). Zero calls.
 *
 * The core is src/domain/** and src/application/**. The vendor vocabulary is every symbol declared in the SDK's
 * typings (src/types/fastship-sdk.d.ts, module 'fastship-sdk'), resolved with the type checker.
 * SG1 (H5): no core file refers to a vendor symbol (a type such as FastshipRateRequest, or a field such as
 * serviceCode or amount.value), so no port signature and no core rule is shaped by the carrier.
 * SG2 (H2/H1b): no core file has a runtime import of 'fastship-sdk' (an import that is not type-only), so the core
 * neither constructs the client nor catches the vendor's error class.
 * Planted debt (TrackingPort.ts, TrackShipmentService.ts) is excepted as files; a copy elsewhere counts.
 *
 * Limits: a vendor value passed through `unknown` or `any` is not seen; vendor words in strings are not checked.
 *
 * Usage: npx tsx experiments/puzzle-01/puzzles/p3-shipping-quotes/oracle.ts <tree>
 */
import ts from 'typescript';
import { lineOf, loadTree, report, type SubGoalVerdict } from '../../tools/oracle-lib';

const PLANTED = new Set(['src/application/ports/out/TrackingPort.ts', 'src/application/services/TrackShipmentService.ts']);
const isCore = (rel: string): boolean => /^src\/(domain|application)\//.test(rel);

const treeArg = process.argv[2];
if (treeArg === undefined) {
  process.stderr.write('usage: oracle.ts <tree>\n');
  process.exit(2);
}
const tree = loadTree(treeArg);
const fromVendor = (s: ts.Symbol | undefined): boolean => {
  const sym = s !== undefined && (s.flags & ts.SymbolFlags.Alias) !== 0 ? tree.checker.getAliasedSymbol(s) : s;
  return (sym?.declarations ?? []).some((d) => {
    const f = d.getSourceFile().fileName;
    return /\/src\/types\/fastship-sdk\.d\.ts$/.test(f) || /node_modules\/fastship-sdk\//.test(f);
  });
};
const sg1: string[] = [];
const sg2: string[] = [];
for (const rel of tree.files.filter((f) => isCore(f) && !PLANTED.has(f))) {
  const sf = tree.source(rel);
  const seen = new Set<string>();
  const visit = (n: ts.Node): void => {
    if (ts.isImportDeclaration(n)) {
      if (ts.isStringLiteral(n.moduleSpecifier) && n.moduleSpecifier.text === 'fastship-sdk') {
        const c = n.importClause;
        const allTypes = c !== undefined && (c.isTypeOnly || (c.name === undefined && c.namedBindings !== undefined && ts.isNamedImports(c.namedBindings) && c.namedBindings.elements.every((e) => e.isTypeOnly)));
        if (!allTypes) sg2.push(`${rel}:${String(lineOf(sf, n))} runtime import of fastship-sdk`);
      }
      return;
    }
    if (ts.isIdentifier(n) && fromVendor(tree.checker.getSymbolAtLocation(n))) {
      const key = `${n.text}@${String(lineOf(sf, n))}`;
      if (!seen.has(key)) {
        seen.add(key);
        sg1.push(`${rel}:${String(lineOf(sf, n))} vendor symbol ${n.text}`);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

const verdicts: SubGoalVerdict[] = [
  { id: 'SG1', family: 'H5', pass: sg1.length === 0, evidence: sg1 },
  { id: 'SG2', family: 'H2/H1b', pass: sg2.length === 0, evidence: sg2 },
];
process.exitCode = report('p3-shipping-quotes', treeArg, verdicts);
