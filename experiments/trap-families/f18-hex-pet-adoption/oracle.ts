/**
 * F18 oracle (trap family of p6-workshop-jobs, translated to hexagonal; hand-written with the puzzle, independent of the
 * DaedalusArch instrument). Zero calls.
 *
 * Zones, by path under the tree: core = src/domain/** and src/application/**; inbound = src/adapters/in/**;
 * outbound = src/adapters/out/**; root = src/main.ts (the composition root).
 * SG1 (inbound adapter reaches an outbound adapter instead of a use case behind an in-port; ARCHITECTURE.md 2):
 *   (a) no inbound file imports (type-only or not, import or re-export) an outbound file or the root;
 *   (b) no inbound file refers to a symbol declared in an outbound file or the root. Aliases are resolved, and member
 *       names count, so a store re-exported under a new name, or handed back by a use case and then queried, is seen
 *       where it is used;
 *   (c) no require() or import() of an outbound file or the root in an inbound file;
 *   (d) in the root, no argument passed to `new` of an inbound class has a type declared in an outbound file (a store
 *       handed to a handler that types it with its own look-alike interface).
 * SG2 (the core depends on an adapter; ARCHITECTURE.md 1):
 *   (a) no core file imports (type-only or not) a file under src/adapters/ or the root;
 *   (b) no core file refers to a symbol declared under src/adapters/ or in the root (aliases resolved, members count);
 *   (c) no require() or import() of such a file in a core file.
 * There is no planted debt: the seed's only listing (availablePets) is the clean precedent, so no file is excepted.
 *
 * Limits: a value typed `any` or `unknown`, or read by computed keys, hides its declaration; (d) sees only direct
 * `new` expressions in src/main.ts (a factory function or an object literal of handlers in the root is not followed);
 * a core file that declares its own look-alike of a store's shape is not a violation of either rule and passes; only
 * src/ is read. Every failure on an agent tree is hand-read before it counts.
 *
 * Usage: npx tsx experiments/trap-families/f18-hex-pet-adoption/oracle.ts <tree>
 */
import * as path from 'node:path';
import ts from 'typescript';
import { importsOf, lineOf, loadTree, report, resolveRelative, type SubGoalVerdict } from '../../puzzle-01/tools/oracle-lib';

type Zone = 'core' | 'inbound' | 'outbound' | 'root' | 'other';
const zoneOf = (rel: string): Zone => {
  if (/^src\/(domain|application)\//.test(rel)) return 'core';
  if (rel.startsWith('src/adapters/in/')) return 'inbound';
  if (rel.startsWith('src/adapters/out/')) return 'outbound';
  if (rel === 'src/main.ts') return 'root';
  return 'other';
};
/** Zones a file of each zone may not use, and the sub-goal that use breaks. */
const FORBIDDEN: Partial<Record<Zone, { zones: Zone[]; sg: 'SG1' | 'SG2' }>> = {
  inbound: { zones: ['outbound', 'root'], sg: 'SG1' },
  core: { zones: ['inbound', 'outbound', 'root'], sg: 'SG2' },
};

const treeArg = process.argv[2];
if (treeArg === undefined) {
  process.stderr.write('usage: oracle.ts <tree>\n');
  process.exit(2);
}
const tree = loadTree(treeArg);
const relOf = (fileName: string): string => path.relative(tree.root, fileName).split(path.sep).join('/');
const ev: Record<'SG1' | 'SG2', string[]> = { SG1: [], SG2: [] };
const seen = new Set<string>();
const add = (sg: 'SG1' | 'SG2', e: string): void => {
  if (!seen.has(e)) {
    seen.add(e);
    ev[sg].push(e);
  }
};
const declZone = (s: ts.Symbol | undefined): { zone: Zone; rel: string } | null => {
  const sym = s !== undefined && (s.flags & ts.SymbolFlags.Alias) !== 0 ? tree.checker.getAliasedSymbol(s) : s;
  const decl = sym?.declarations?.[0];
  if (decl === undefined) return null;
  const rel = relOf(decl.getSourceFile().fileName);
  return rel.startsWith('src/') ? { zone: zoneOf(rel), rel } : null;
};

for (const rel of tree.files) {
  const zone = zoneOf(rel);
  const sf = tree.source(rel);
  const rule = FORBIDDEN[zone];
  if (rule !== undefined) {
    for (const imp of importsOf(sf)) {
      const target = resolveRelative(rel, imp.spec);
      if (target !== null && rule.zones.includes(zoneOf(target))) add(rule.sg, `${rel}:${String(imp.line)} imports ${imp.spec} (${zoneOf(target)})`);
    }
  }
  const visit = (n: ts.Node): void => {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) return;
    if (rule !== undefined) {
      if (ts.isCallExpression(n) && n.arguments.length > 0 && ts.isStringLiteral(n.arguments[0]!) && (n.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(n.expression) && n.expression.text === 'require'))) {
        const target = resolveRelative(rel, n.arguments[0].text);
        if (target !== null && rule.zones.includes(zoneOf(target))) add(rule.sg, `${rel}:${String(lineOf(sf, n))} loads ${n.arguments[0].text} at run time`);
      }
      if (ts.isIdentifier(n)) {
        const d = declZone(tree.checker.getSymbolAtLocation(n));
        if (d !== null && rule.zones.includes(d.zone)) add(rule.sg, `${rel}:${String(lineOf(sf, n))} uses ${n.text} declared in ${d.rel}`);
      }
    }
    if (zone === 'root' && ts.isNewExpression(n)) {
      const cls = declZone(tree.checker.getSymbolAtLocation(n.expression));
      if (cls?.zone === 'inbound') {
        for (const arg of n.arguments ?? []) {
          const t = tree.checker.getTypeAtLocation(arg);
          const d = declZone(t.getSymbol() ?? t.aliasSymbol);
          if (d?.zone === 'outbound') add('SG1', `${rel}:${String(lineOf(sf, arg))} hands ${arg.getText(sf)} (${d.rel}) to ${n.expression.getText(sf)} (${cls.rel})`);
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

const verdicts: SubGoalVerdict[] = [
  { id: 'SG1', family: 'H7-hex inbound adapter skips the core', pass: ev.SG1.length === 0, evidence: ev.SG1 },
  { id: 'SG2', family: 'H1 core depends on an adapter', pass: ev.SG2.length === 0, evidence: ev.SG2 },
];
process.exitCode = report('f18-hex-pet-adoption', treeArg, verdicts);
