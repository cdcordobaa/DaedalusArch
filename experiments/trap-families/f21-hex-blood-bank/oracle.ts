/**
 * F21 oracle (trap family "vendor shape in the port", hexagonal; hand-written with the puzzle, independent of the
 * DaedalusArch instrument). Zero calls. Built on the P3r oracle (experiments/puzzle-03/puzzles/p3r-shipping-quotes),
 * same rules, with the regional blood supplier's vocabulary in place of the carrier's.
 *
 * The core is src/domain/** and src/application/**. The vendor vocabulary is read from the SDK's typings
 * (src/types/haemalink-sdk.d.ts, module 'haemalink-sdk') with the type checker.
 * SG1 (H5, ports and the core speak the application's language and state its own outcomes):
 *   (a) no core file refers to a symbol declared by the vendor typings (a type such as HlOrderRequest, HlOrderReceipt
 *       or HaemalinkEmbargoError, or a field such as qtyAllocated, allocationStatus, embargoCode or liftsAt);
 *   (b) no core file imports an adapter or the composition root (a port typed with an adapter's types);
 *   (c) no core file declares a property with a field name that only the vendor's data model has (VENDOR_FIELDS),
 *       so a renamed copy of a vendor type counts;
 *   (d) no core file holds a string literal equal to a value of a vendor literal type: product codes ('RBC', 'PLT',
 *       'FFP'), RhD codes ('POS', 'NEG'), priorities ('STAT', 'ROUTINE'), allocation status strings ('ALLOCATED',
 *       'PART_ALLOCATED', 'BACKORDERED'), consignment stages ('PICKING', 'DISPATCHED', 'DELIVERED') and embargo codes
 *       ('REGIONAL_SHORTAGE', 'TTI_QUARANTINE'). The ABO letters 'O', 'A', 'B', 'AB' are left out: they are blood
 *       bank vocabulary before they are the vendor's.
 * SG2 (H2/H1b, no dependency on the vendor in the core):
 *   (a) no runtime (non-type-only) import of 'haemalink-sdk' in a core file;
 *   (b) no require('haemalink-sdk') or import('haemalink-sdk') in a core file;
 *   (c) no core file names a vendor declaration in a string (for example comparing an error's name with
 *       'HaemalinkEmbargoError'), so the vendor's embargo error is not recognised by name.
 * The seed has no planted debt (its delivery precedent is clean), so no file is excepted.
 *
 * Limits: a vendor value passed through `unknown` or `any` and read by computed keys is not seen; VENDOR_FIELDS is a
 * fixed list and leaves out names that are plain blood bank or ordering words (abo, rhd, product, priority, lines,
 * qty, allocations, stage), so a renamed copy that keeps only those names is not seen; vendor codes rebuilt from
 * pieces (concatenation, case changes, substrings such as includes('SHORTAGE')) are not seen by (d) on their own; a
 * core that mirrors the vendor's codes one to one under its own spelling is not seen (a translation in form only). A
 * vendor error that passes through the core untouched (neither caught by class nor by name) is not counted: only
 * recognising it is. The oracle does not judge where the holds are remembered (in the core or in the adapter): both
 * are clean when the core holds only its own types. It does not judge behaviour: the tests do. Every failure on an
 * agent tree is hand-read before it counts.
 *
 * Usage: npx tsx experiments/trap-families/f21-hex-blood-bank/oracle.ts <tree>
 */
import ts from 'typescript';
import { importsOf, lineOf, loadTree, report, resolveRelative, type SubGoalVerdict } from '../../puzzle-01/tools/oracle-lib';

const VENDOR = 'haemalink-sdk';
const PLANTED = new Set<string>();
const isCore = (rel: string): boolean => /^src\/(domain|application)\//.test(rel);
/** Field names of the vendor's data model that a blood bank model has no reason to share. */
const VENDOR_FIELDS = new Set([
  'orderRef', 'qtyRequested', 'qtyAllocated', 'allocationStatus', 'lineNo', 'etaMinutes', 'embargoCode', 'liftsAt',
  'httpStatus', 'stageAt', 'courierId', 'clinicalNote', 'siteCode',
]);
const GENERIC_LITERALS = new Set(['O', 'A', 'B', 'AB']);

const treeArg = process.argv[2];
if (treeArg === undefined) {
  process.stderr.write('usage: oracle.ts <tree>\n');
  process.exit(2);
}
const tree = loadTree(treeArg);
const isVendorFile = (f: string): boolean => /\/src\/types\/haemalink-sdk\.d\.ts$/.test(f) || /node_modules\/haemalink-sdk\//.test(f);
const fromVendor = (s: ts.Symbol | undefined): boolean => {
  const sym = s !== undefined && (s.flags & ts.SymbolFlags.Alias) !== 0 ? tree.checker.getAliasedSymbol(s) : s;
  return (sym?.declarations ?? []).some((d) => isVendorFile(d.getSourceFile().fileName));
};

// The vendor vocabulary: declared names and literal-type values, read from the typings in the tree.
const vendorNames = new Set<string>();
const vendorLiterals = new Set<string>();
for (const sf of tree.program.getSourceFiles().filter((f) => isVendorFile(f.fileName))) {
  const visit = (n: ts.Node): void => {
    if ((ts.isClassDeclaration(n) || ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n)) && n.name !== undefined) vendorNames.add(n.name.text);
    if (ts.isLiteralTypeNode(n) && ts.isStringLiteral(n.literal) && !GENERIC_LITERALS.has(n.literal.text)) vendorLiterals.add(n.literal.text);
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
if (vendorNames.size === 0) {
  process.stderr.write(`oracle: no typings of ${VENDOR} found in the tree (src/types/${VENDOR}.d.ts)\n`);
  process.exit(2);
}

const sg1: string[] = [];
const sg2: string[] = [];
for (const rel of tree.files.filter((f) => isCore(f) && !PLANTED.has(f))) {
  const sf = tree.source(rel);
  for (const imp of importsOf(sf)) {
    const target = resolveRelative(rel, imp.spec);
    if (target !== null && /^src\/(adapters|config)\//.test(target)) sg1.push(`${rel}:${String(imp.line)} imports ${imp.spec} (an adapter or the composition root)`);
  }
  const seen = new Set<string>();
  const add = (list: string[], line: number, what: string): void => {
    const key = `${String(list === sg1)}|${String(line)}|${what}`;
    if (seen.has(key)) return;
    seen.add(key);
    list.push(`${rel}:${String(line)} ${what}`);
  };
  const visit = (n: ts.Node): void => {
    if (ts.isImportDeclaration(n)) {
      if (ts.isStringLiteral(n.moduleSpecifier) && n.moduleSpecifier.text === VENDOR) {
        const c = n.importClause;
        const allTypes = c !== undefined && (c.isTypeOnly || (c.name === undefined && c.namedBindings !== undefined && ts.isNamedImports(c.namedBindings) && c.namedBindings.elements.every((e) => e.isTypeOnly)));
        if (!allTypes) add(sg2, lineOf(sf, n), `runtime import of ${VENDOR}`);
      }
      // The imported names still count under SG1 (a): visit the bindings, not the specifier.
      if (n.importClause !== undefined) ts.forEachChild(n.importClause, visit);
      return;
    }
    if (ts.isCallExpression(n) && n.arguments.length > 0 && ts.isStringLiteral(n.arguments[0]!) && n.arguments[0].text === VENDOR
      && (n.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(n.expression) && n.expression.text === 'require'))) {
      add(sg2, lineOf(sf, n), `dynamic load of ${VENDOR}`);
    }
    if (ts.isIdentifier(n) && fromVendor(tree.checker.getSymbolAtLocation(n))) add(sg1, lineOf(sf, n), `vendor symbol ${n.text}`);
    if ((ts.isPropertySignature(n) || ts.isPropertyDeclaration(n)) && n.name !== undefined && (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name)) && VENDOR_FIELDS.has(n.name.text)) {
      add(sg1, lineOf(sf, n), `declares the vendor field name ${n.name.text}`);
    }
    if (ts.isStringLiteralLike(n) && !ts.isImportDeclaration(n.parent) && !ts.isLiteralTypeNode(n.parent)) {
      if (vendorLiterals.has(n.text)) add(sg1, lineOf(sf, n), `vendor code '${n.text}'`);
      const named = [...vendorNames].find((v) => n.text.includes(v));
      if (named !== undefined) add(sg2, lineOf(sf, n), `names the vendor declaration ${named} in a string`);
    }
    if (ts.isLiteralTypeNode(n) && ts.isStringLiteral(n.literal) && vendorLiterals.has(n.literal.text)) add(sg1, lineOf(sf, n), `vendor code '${n.literal.text}' in a type`);
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

const verdicts: SubGoalVerdict[] = [
  { id: 'SG1', family: 'H5', pass: sg1.length === 0, evidence: sg1 },
  { id: 'SG2', family: 'H2/H1b', pass: sg2.length === 0, evidence: sg2 },
];
process.exitCode = report('f21-hex-blood-bank', treeArg, verdicts);
