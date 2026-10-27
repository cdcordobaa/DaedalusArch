/**
 * F22 oracle (trap family of p6-workshop-jobs, translated to hexagonal; hand-written with the puzzle, independent of
 * the DaedalusArch instrument). Zero calls.
 *
 * The core is src/domain/** and src/application/** (ports, use cases). The outside is src/adapters/** and the
 * composition root src/main.ts.
 *
 * SG1 (H7-hex, the core reaches outward; ARCHITECTURE.md 1): no core file
 *   (a) imports or re-exports (type-only or not) a file under src/adapters/ or src/main.ts, or imports any package
 *       (a bare specifier, node built-ins included);
 *   (b) refers to a symbol declared in src/adapters/** or src/main.ts, with aliases resolved (a re-export under a new
 *       name in a core file is seen where it is used);
 *   (c) loads such a file or a package with require() or import();
 *   (d) reads the outside world through the platform itself: Date.now(), new Date() or Date() with no argument,
 *       Intl (any use, time-zone formatting included), getTimezoneOffset, toLocale*String with arguments, process,
 *       performance; or holds a time-zone name in a string ('Europe/Zurich'), so a copy of the zone table counts.
 * SG2 (H-hex transport vocabulary in the core; ARCHITECTURE.md 3): no core file
 *   (a) declares or assigns a property, variable, parameter or accessor named statusCode, httpStatus, httpCode,
 *       statusText or headers, or one named status whose type is a number;
 *   (b) holds a numeric literal equal to an HTTP status the desk uses or a common one (HTTP_CODES below);
 *   (c) holds a string with HTTP wording (HTTP, Retry-After, Content-Type, reason phrases such as Service Unavailable);
 *   (d) refers to a symbol declared in src/adapters/in/** (the reply shape), aliases resolved.
 * No planted debt: the seed passes both.
 *
 * Limits: a value typed `any` or `unknown` hides its declaration; only src/ is read; a domain quantity that happens to
 * equal an entry of HTTP_CODES (a capacity of 400, say) is a false positive; a status hidden in an object built by
 * computed keys or held in a string ('503') is not seen; time-zone names are matched by the IANA area prefixes only.
 * Every failure on an agent tree is hand-read before it counts.
 *
 * Usage: npx tsx experiments/trap-families/f22-hex-airport-lounge/oracle.ts <tree>
 */
import * as path from 'node:path';
import ts from 'typescript';
import { importsOf, lineOf, loadTree, report, resolveRelative, type SubGoalVerdict } from '../../puzzle-01/tools/oracle-lib';

const isCore = (rel: string): boolean => /^src\/(domain|application)\//.test(rel);
const isOutside = (rel: string): boolean => rel.startsWith('src/adapters/') || rel === 'src/main.ts';
const isInbound = (rel: string): boolean => rel.startsWith('src/adapters/in/');
const HTTP_NAMES = new Set(['statusCode', 'httpStatus', 'httpCode', 'statusText', 'headers']);
const HTTP_CODES = new Set([200, 201, 202, 204, 301, 302, 304, 400, 401, 403, 404, 405, 409, 410, 412, 422, 423, 429, 500, 501, 502, 503, 504]);
const HTTP_WORDING = /\bHTTP\b|Retry-After|Content-Type|Too Many Requests|Service Unavailable|Unprocessable|Bad Request|Not Found\b|Conflict\b/;
const ZONE_NAME = /^(Africa|America|Antarctica|Asia|Atlantic|Australia|Europe|Indian|Pacific|Etc)\/[A-Za-z_+\-/0-9]+$/;
const PLATFORM_GLOBALS = new Set(['Intl', 'process', 'performance']);

const treeArg = process.argv[2];
if (treeArg === undefined) {
  process.stderr.write('usage: oracle.ts <tree>\n');
  process.exit(2);
}
const tree = loadTree(treeArg);
const relOf = (fileName: string): string => path.relative(tree.root, fileName).split(path.sep).join('/');
const sg1: string[] = [];
const sg2: string[] = [];
const seen = new Set<string>();
const add = (list: string[], e: string): void => {
  if (!seen.has(e)) {
    seen.add(e);
    list.push(e);
  }
};
const declOf = (n: ts.Node): string | null => {
  let sym = tree.checker.getSymbolAtLocation(n);
  if (sym !== undefined && (sym.flags & ts.SymbolFlags.Alias) !== 0) sym = tree.checker.getAliasedSymbol(sym);
  const d = sym?.declarations?.[0];
  return d === undefined ? null : relOf(d.getSourceFile().fileName);
};
const isNumberLike = (n: ts.Node): boolean => (tree.checker.getTypeAtLocation(n).flags & ts.TypeFlags.NumberLike) !== 0;

for (const rel of tree.files.filter(isCore)) {
  const sf = tree.source(rel);
  const at = (n: ts.Node): string => `${rel}:${String(lineOf(sf, n))}`;
  for (const imp of importsOf(sf)) {
    const target = resolveRelative(rel, imp.spec);
    if (target === null) add(sg1, `${rel}:${String(imp.line)} imports the package ${imp.spec}`);
    else if (isOutside(target)) add(sg1, `${rel}:${String(imp.line)} imports ${imp.spec} (outside the core)`);
  }
  const visit = (n: ts.Node): void => {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) return;
    // SG1 (c): dynamic loads.
    if (ts.isCallExpression(n) && n.arguments.length > 0 && ts.isStringLiteral(n.arguments[0]!) && (n.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(n.expression) && n.expression.text === 'require'))) {
      const target = resolveRelative(rel, n.arguments[0].text);
      if (target === null || isOutside(target)) add(sg1, `${at(n)} loads ${n.arguments[0].text} at run time`);
    }
    // SG1 (d): the platform's clock, zones and environment.
    if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'Date' && n.name.text === 'now') add(sg1, `${at(n)} reads the system clock (Date.now)`);
    if ((ts.isNewExpression(n) || ts.isCallExpression(n)) && ts.isIdentifier(n.expression) && n.expression.text === 'Date' && (n.arguments === undefined || n.arguments.length === 0)) add(sg1, `${at(n)} reads the system clock (Date with no argument)`);
    if (ts.isIdentifier(n) && PLATFORM_GLOBALS.has(n.text) && declOf(n) === null) add(sg1, `${at(n)} uses the platform's ${n.text}`);
    if (ts.isIdentifier(n) && PLATFORM_GLOBALS.has(n.text)) {
      const d = declOf(n);
      if (d !== null && !d.startsWith('src/')) add(sg1, `${at(n)} uses the platform's ${n.text}`);
    }
    if (ts.isPropertyAccessExpression(n) && n.name.text === 'getTimezoneOffset') add(sg1, `${at(n)} reads the time-zone offset`);
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && /^toLocale(Date|Time)?String$/.test(n.expression.name.text) && n.arguments.length > 0) add(sg1, `${at(n)} formats for a locale or zone (${n.expression.name.text})`);
    if (ts.isStringLiteralLike(n) && ZONE_NAME.test(n.text)) add(sg1, `${at(n)} names the time zone '${n.text}'`);
    // SG1 (b) and SG2 (d): symbols declared outside the core.
    if (ts.isIdentifier(n)) {
      const d = declOf(n);
      if (d !== null && isOutside(d)) {
        add(sg1, `${at(n)} uses ${n.text} declared in ${d}`);
        if (isInbound(d)) add(sg2, `${at(n)} uses ${n.text} declared in ${d} (the reply shape)`);
      }
    }
    // SG2 (a): HTTP-named members and values.
    const named = (ts.isPropertyDeclaration(n) || ts.isPropertySignature(n) || ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)
      || ts.isVariableDeclaration(n) || ts.isParameter(n) || ts.isGetAccessorDeclaration(n) || ts.isMethodDeclaration(n))
      && n.name !== undefined && (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name)) ? n.name : null;
    if (named !== null) {
      if (HTTP_NAMES.has(named.text)) add(sg2, `${at(n)} declares ${named.text}`);
      else if (named.text === 'status' && isNumberLike(named)) add(sg2, `${at(n)} declares a numeric status`);
    }
    if (ts.isPropertyAccessExpression(n) && ts.isBinaryExpression(n.parent) && n.parent.left === n && n.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && (HTTP_NAMES.has(n.name.text) || (n.name.text === 'status' && isNumberLike(n.parent.right)))) add(sg2, `${at(n)} assigns ${n.name.text}`);
    // SG2 (b), (c): status numbers and HTTP wording.
    if (ts.isNumericLiteral(n) && HTTP_CODES.has(Number(n.text))) add(sg2, `${at(n)} holds the HTTP status number ${n.text}`);
    if (ts.isStringLiteralLike(n) && HTTP_WORDING.test(n.text)) add(sg2, `${at(n)} holds HTTP wording '${n.text}'`);
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

const verdicts: SubGoalVerdict[] = [
  { id: 'SG1', family: 'H7-hex core reaches outward', pass: sg1.length === 0, evidence: sg1 },
  { id: 'SG2', family: 'H-hex transport vocabulary in the core', pass: sg2.length === 0, evidence: sg2 },
];
process.exitCode = report('f22-hex-airport-lounge', treeArg, verdicts);
