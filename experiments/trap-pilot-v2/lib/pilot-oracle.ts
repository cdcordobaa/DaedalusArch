/**
 * TRAP-PILOT-v2 oracle library (hand-written with the pilot tasks, independent of the DaedalusArch instrument; zero
 * calls). Each variant's `oracle.ts` names one sub-goal and one check; this file reads the final tree directly with
 * the TypeScript compiler API (through the PUZZLE-01 `oracle-lib`) and reports the verdict in the PUZZLE-01 format.
 *
 * The core is src/domain/** and src/application/**; adapters are src/adapters/**; the vendor vocabulary is read
 * from the vendor typings the tree carries (src/types/<module>.d.ts, `declare module '<module>'`).
 *
 * Checks (one per pilot trap kind):
 * - literal-compare (P1): a core string literal equal to a vendor literal-type value used in a comparison
 *   (=== !== == !=), a switch case, an array literal (a set of codes to test against), or as a key of an object
 *   literal (a lookup table).
 * - vendor-fields (P2): a core property (interface or class member, constructor parameter property, object literal
 *   key) named like a field of the vendor's data model (all property names in the typings minus `params.generic`).
 * - value-set-copy (P3): a core string set (a union of string literals, an enum, or an array of strings) with exactly
 *   as many members as a vendor literal set of three or more values, which the core branches on (one member used in
 *   a comparison, case or lookup key), and which copies the vendor set: at least half of its members match a vendor
 *   value after normalisation (case, separators), or an adapter maps every vendor value one to one onto it.
 * - error-codes (P4): (a) a core string literal equal to a vendor error code (the literal values of a vendor type
 *   whose name ends in `Code`); (b) a core error class (a class whose `extends` chain names an Error) with a
 *   code-like property (code, errorCode, vendorCode, providerCode, reasonCode) typed as plain `string` or holding a
 *   vendor code; (c) a core property or parameter named like a vendor field that carries a unit (…Sec, …Ms, …Min,
 *   …Cents, …Minor).
 * - structural (P5): a core import of an adapter or the composition root; a runtime (non-type-only) import, require
 *   or import() of the vendor module; a `new` of a class declared by the vendor typings or in src/adapters/**.
 * - transport (P6): in the core, a property or parameter named statusCode, httpStatus, httpCode, headers, header,
 *   responseHeaders, retryAfter, or `status` typed as a number; a string literal naming an HTTP header (the list
 *   below, or any `x-…` name); an integer literal from 100 to 599; a reference to a vendor type that carries a
 *   `status` or `headers` field.
 *
 * Limits (all checks): values passed through `any` / `unknown` and read by computed keys are not seen; codes rebuilt
 * from pieces are not seen; a business number from 100 to 599 in the core is flagged by `transport` and must be
 * hand-read; generic vendor names listed in a variant's `params.generic` are not counted. Every failure on an agent
 * tree is hand-read before it counts.
 */
import ts from 'typescript';
import { importsOf, lineOf, loadTree, report, resolveRelative, type SubGoalVerdict } from '../../puzzle-01/tools/oracle-lib';

export interface PilotOracleSpec {
  readonly puzzle: string;
  readonly vendorModule: string;
  readonly subGoal: { readonly id: string; readonly family: string; readonly check: string; readonly params?: { readonly generic?: string[] } };
}

const isCore = (rel: string): boolean => /^src\/(domain|application)\//.test(rel);
const isAdapter = (rel: string): boolean => /^src\/adapters\//.test(rel);
const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const HEADERS = new Set(['retry-after', 'location', 'content-type', 'cache-control', 'authorization', 'idempotency-key', 'etag', 'if-match', 'accept', 'set-cookie']);
const TRANSPORT_NAMES = new Set(['statusCode', 'httpStatus', 'httpCode', 'headers', 'header', 'responseHeaders', 'retryAfter']);
const CODE_PROPS = /^(code|errorCode|vendorCode|providerCode|reasonCode)$/;
const UNIT_FIELD = /(Sec|Secs|Seconds|Ms|Min|Mins|Cents|Minor)$/;

export function runPilotOracle(spec: PilotOracleSpec, treeArg: string): number {
  const tree = loadTree(treeArg);
  const generic = new Set(spec.subGoal.params?.generic ?? []);
  const vendorFile = (f: string): boolean => f.replace(/\\/g, '/').endsWith(`/src/types/${spec.vendorModule}.d.ts`);
  const relOf = (f: string): string => f.replace(/\\/g, '/').slice(tree.root.replace(/\\/g, '/').length + 1);
  const declaredIn = (s: ts.Symbol | undefined, pred: (file: string) => boolean): boolean => {
    const sym = s !== undefined && (s.flags & ts.SymbolFlags.Alias) !== 0 ? tree.checker.getAliasedSymbol(s) : s;
    return (sym?.declarations ?? []).some((d) => pred(d.getSourceFile().fileName));
  };

  // ── The vendor vocabulary ──
  const literals = new Set<string>();
  const sets: string[][] = [];
  const fields = new Set<string>();
  const codes = new Set<string>();
  const transportTypes = new Set<string>();
  for (const sf of tree.program.getSourceFiles().filter((f) => vendorFile(f.fileName))) {
    const visit = (n: ts.Node): void => {
      if (ts.isLiteralTypeNode(n) && ts.isStringLiteral(n.literal) && !generic.has(n.literal.text)) literals.add(n.literal.text);
      if (ts.isUnionTypeNode(n)) {
        const vals = n.types.filter((t): t is ts.LiteralTypeNode => ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)).map((t) => (t.literal as ts.StringLiteral).text);
        if (vals.length === n.types.length && vals.length >= 3) sets.push(vals);
        if (ts.isTypeAliasDeclaration(n.parent) && /Code$/.test(n.parent.name.text)) for (const v of vals) codes.add(v);
      }
      if ((ts.isPropertySignature(n) || ts.isPropertyDeclaration(n)) && n.name !== undefined && ts.isIdentifier(n.name) && !generic.has(n.name.text)) fields.add(n.name.text);
      if ((ts.isInterfaceDeclaration(n) || ts.isClassDeclaration(n) || ts.isTypeAliasDeclaration(n)) && n.name !== undefined) {
        const text = n.getText(sf);
        if (/\b(status|headers)\s*:/.test(text)) transportTypes.add(n.name.text);
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }

  const ev: string[] = [];
  const seen = new Set<string>();
  const add = (rel: string, n: ts.Node, sf: ts.SourceFile, what: string): void => {
    const key = `${rel}:${String(lineOf(sf, n))} ${what}`;
    if (!seen.has(key)) { seen.add(key); ev.push(key); }
  };
  const check = spec.subGoal.check;
  const core = tree.files.filter(isCore);

  /** A string literal node used as a comparison operand, a case label, an array element or a lookup key. */
  const comparedUse = (n: ts.Node): boolean => {
    const p = n.parent;
    if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(p.operatorToken.kind)) return true;
    if (ts.isCaseClause(p) && p.expression === n) return true;
    if (ts.isArrayLiteralExpression(p)) return true;
    if (ts.isPropertyAssignment(p) && p.name === n) return true;
    return false;
  };
  const keyName = (n: ts.PropertyName | undefined): string | null => (n !== undefined && (ts.isIdentifier(n) || ts.isStringLiteral(n)) ? n.text : null);

  if (check === 'literal-compare') {
    for (const rel of core) {
      const sf = tree.source(rel);
      const visit = (n: ts.Node): void => {
        if (ts.isStringLiteralLike(n) && literals.has(n.text) && comparedUse(n)) add(rel, n, sf, `compares with the vendor value '${n.text}'`);
        if (ts.isPropertyAssignment(n) && ts.isIdentifier(n.name) && literals.has(n.name.text)) add(rel, n, sf, `looks up by the vendor value '${n.name.text}'`);
        ts.forEachChild(n, visit);
      };
      visit(sf);
    }
  }

  if (check === 'vendor-fields') {
    for (const rel of core) {
      const sf = tree.source(rel);
      const visit = (n: ts.Node): void => {
        let name: string | null = null;
        if (ts.isPropertySignature(n) || ts.isPropertyDeclaration(n) || ts.isPropertyAssignment(n)) name = keyName(n.name);
        if (ts.isShorthandPropertyAssignment(n)) name = n.name.text;
        if (ts.isParameter(n) && ts.isIdentifier(n.name) && n.modifiers !== undefined && n.modifiers.length > 0) name = n.name.text;
        if (name !== null && fields.has(name)) add(rel, n, sf, `declares the vendor field name ${name}`);
        ts.forEachChild(n, visit);
      };
      visit(sf);
    }
  }

  if (check === 'value-set-copy') {
    // Core string sets and the branch evidence.
    const candidates: { rel: string; node: ts.Node; sf: ts.SourceFile; vals: string[] }[] = [];
    const branched = new Set<string>();
    for (const rel of core) {
      const sf = tree.source(rel);
      const visit = (n: ts.Node): void => {
        if (ts.isUnionTypeNode(n)) {
          const vals = n.types.filter((t): t is ts.LiteralTypeNode => ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)).map((t) => (t.literal as ts.StringLiteral).text);
          if (vals.length === n.types.length && vals.length >= 3) candidates.push({ rel, node: n, sf, vals });
        }
        if (ts.isEnumDeclaration(n)) candidates.push({ rel, node: n, sf, vals: n.members.map((m) => (m.initializer !== undefined && ts.isStringLiteral(m.initializer) ? m.initializer.text : m.name.getText(sf))) });
        if (ts.isArrayLiteralExpression(n) && n.elements.length >= 3 && n.elements.every((e) => ts.isStringLiteral(e))) candidates.push({ rel, node: n, sf, vals: n.elements.map((e) => (e as ts.StringLiteral).text) });
        if (ts.isStringLiteralLike(n) && comparedUse(n) && !ts.isArrayLiteralExpression(n.parent)) branched.add(n.text);
        if (ts.isPropertyAssignment(n) && ts.isIdentifier(n.name)) branched.add(n.name.text);
        if (ts.isEnumMember(n)) branched.add(n.name.getText(sf));
        ts.forEachChild(n, visit);
      };
      visit(sf);
    }
    // Adapter maps: an object literal whose keys are a whole vendor set and whose values are distinct strings.
    const adapterMaps: string[][] = [];
    for (const rel of tree.files.filter(isAdapter)) {
      const sf = tree.source(rel);
      const visit = (n: ts.Node): void => {
        if (ts.isObjectLiteralExpression(n)) {
          const pairs = n.properties.filter(ts.isPropertyAssignment).map((p) => [keyName(p.name), ts.isStringLiteralLike(p.initializer) ? p.initializer.text : null] as const);
          const keys = pairs.map((p) => p[0]).filter((k): k is string => k !== null);
          for (const s of sets) {
            if (s.every((v) => keys.includes(v))) {
              const vals = s.map((v) => pairs.find((p) => p[0] === v)?.[1] ?? null);
              if (vals.every((v) => v !== null) && new Set(vals).size === s.length) adapterMaps.push(vals as string[]);
            }
          }
        }
        if (ts.isSwitchStatement(n)) {
          const out: [string, string][] = [];
          for (const c of n.caseBlock.clauses) {
            if (!ts.isCaseClause(c) || !ts.isStringLiteralLike(c.expression)) continue;
            const ret = c.statements.find(ts.isReturnStatement);
            if (ret?.expression !== undefined && ts.isStringLiteralLike(ret.expression)) out.push([c.expression.text, ret.expression.text]);
          }
          for (const s of sets) {
            const vals = s.map((v) => out.find((o) => o[0] === v)?.[1] ?? null);
            if (vals.every((v) => v !== null) && new Set(vals).size === s.length) adapterMaps.push(vals as string[]);
          }
        }
        ts.forEachChild(n, visit);
      };
      visit(sf);
    }
    const close = (a: string, b: string): boolean => { const x = norm(a); const y = norm(b); return x === y || (x.length >= 4 && y.length >= 4 && (x.includes(y) || y.includes(x))); };
    for (const c of candidates) {
      for (const s of sets) {
        if (c.vals.length !== s.length) continue;
        if (!c.vals.some((v) => branched.has(v))) continue;
        const matched = c.vals.filter((v) => s.some((w) => close(v, w))).length;
        const mapped = adapterMaps.some((m) => m.every((v) => c.vals.includes(v)));
        if (matched >= Math.ceil(s.length / 2) || mapped) add(c.rel, c.node, c.sf, `keeps the vendor's ${String(s.length)} values one to one (${c.vals.join(', ')})${mapped ? ', mapped one to one by an adapter' : ''}`);
      }
    }
  }

  if (check === 'error-codes') {
    for (const rel of core) {
      const sf = tree.source(rel);
      const isErrorClass = (n: ts.ClassDeclaration): boolean => (n.heritageClauses ?? []).some((h) => h.types.some((t) => {
        let sym = tree.checker.getSymbolAtLocation(t.expression);
        for (let i = 0; i < 6 && sym !== undefined; i++) {
          if (sym.getName() === 'Error') return true;
          const decl = sym.declarations?.[0];
          if (decl === undefined || !ts.isClassDeclaration(decl)) return /Error$/.test(sym.getName());
          const base = decl.heritageClauses?.[0]?.types[0]?.expression;
          sym = base !== undefined ? tree.checker.getSymbolAtLocation(base) : undefined;
          if (sym !== undefined && (sym.flags & ts.SymbolFlags.Alias) !== 0) sym = tree.checker.getAliasedSymbol(sym);
        }
        return false;
      }));
      const wideOrVendor = (n: ts.Node): boolean => {
        const t = tree.checker.getTypeAtLocation(n);
        const parts = t.isUnion() ? t.types : [t];
        return parts.some((p) => (p.flags & ts.TypeFlags.String) !== 0 || (p.isStringLiteral() && codes.has(p.value)));
      };
      const visit = (n: ts.Node): void => {
        if (ts.isStringLiteralLike(n) && codes.has(n.text) && !ts.isImportDeclaration(n.parent)) add(rel, n, sf, `holds the vendor error code '${n.text}'`);
        if (ts.isClassDeclaration(n) && isErrorClass(n)) {
          for (const m of n.members) if (ts.isPropertyDeclaration(m) && keyName(m.name) !== null && CODE_PROPS.test(keyName(m.name)!) && wideOrVendor(m)) add(rel, m, sf, `error ${n.name?.text ?? '?'} carries a code ${keyName(m.name)!}`);
          const ctor = n.members.find(ts.isConstructorDeclaration);
          for (const p of ctor?.parameters ?? []) if (ts.isIdentifier(p.name) && (p.modifiers?.length ?? 0) > 0 && CODE_PROPS.test(p.name.text) && wideOrVendor(p)) add(rel, p, sf, `error ${n.name?.text ?? '?'} carries a code ${p.name.text}`);
        }
        let name: string | null = null;
        if (ts.isPropertySignature(n) || ts.isPropertyDeclaration(n) || ts.isPropertyAssignment(n)) name = keyName(n.name);
        if (ts.isParameter(n) && ts.isIdentifier(n.name)) name = n.name.text;
        if (name !== null && UNIT_FIELD.test(name) && fields.has(name)) add(rel, n, sf, `carries the vendor's unit field ${name}`);
        ts.forEachChild(n, visit);
      };
      visit(sf);
    }
  }

  if (check === 'structural') {
    for (const rel of core) {
      const sf = tree.source(rel);
      for (const i of importsOf(sf)) {
        const target = resolveRelative(rel, i.spec);
        if (target !== null && /^src\/(adapters|config)\//.test(target)) ev.push(`${rel}:${String(i.line)} imports ${i.spec} (an adapter or the composition root)`);
      }
      const visit = (n: ts.Node): void => {
        if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier) && n.moduleSpecifier.text === spec.vendorModule) {
          const c = n.importClause;
          const typeOnly = c !== undefined && (c.isTypeOnly || (c.name === undefined && c.namedBindings !== undefined && ts.isNamedImports(c.namedBindings) && c.namedBindings.elements.every((e) => e.isTypeOnly)));
          if (!typeOnly) add(rel, n, sf, `runtime import of ${spec.vendorModule}`);
          return;
        }
        if (ts.isCallExpression(n) && n.arguments.length > 0 && ts.isStringLiteral(n.arguments[0]!) && n.arguments[0].text === spec.vendorModule
          && (n.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(n.expression) && n.expression.text === 'require'))) add(rel, n, sf, `dynamic load of ${spec.vendorModule}`);
        if (ts.isNewExpression(n)) {
          const sym = tree.checker.getSymbolAtLocation(n.expression);
          if (declaredIn(sym, vendorFile)) add(rel, n, sf, `constructs the vendor class ${n.expression.getText(sf)}`);
          else if (declaredIn(sym, (f) => isAdapter(relOf(f)))) add(rel, n, sf, `constructs the adapter ${n.expression.getText(sf)}`);
        }
        ts.forEachChild(n, visit);
      };
      visit(sf);
    }
  }

  if (check === 'transport') {
    for (const rel of core) {
      const sf = tree.source(rel);
      const visit = (n: ts.Node): void => {
        let name: string | null = null;
        if (ts.isPropertySignature(n) || ts.isPropertyDeclaration(n) || ts.isPropertyAssignment(n)) name = keyName(n.name);
        if (ts.isParameter(n) && ts.isIdentifier(n.name)) name = n.name.text;
        if (name !== null && TRANSPORT_NAMES.has(name)) add(rel, n, sf, `names the transport detail ${name}`);
        if (name === 'status' && (tree.checker.getTypeAtLocation(n).flags & ts.TypeFlags.NumberLike) !== 0) add(rel, n, sf, 'carries a numeric status');
        if (ts.isStringLiteralLike(n) && !ts.isImportDeclaration(n.parent) && (HEADERS.has(n.text.toLowerCase()) || /^x-[a-z0-9-]+$/i.test(n.text))) add(rel, n, sf, `names the HTTP header '${n.text}'`);
        if (ts.isNumericLiteral(n) && /^\d+$/.test(n.text) && Number(n.text) >= 100 && Number(n.text) <= 599) add(rel, n, sf, `holds the status-like number ${n.text}`);
        if (ts.isIdentifier(n) && declaredIn(tree.checker.getSymbolAtLocation(n), vendorFile) && transportTypes.has(n.text)) add(rel, n, sf, `refers to the vendor reply type ${n.text}`);
        ts.forEachChild(n, visit);
      };
      visit(sf);
    }
  }

  if (!['literal-compare', 'vendor-fields', 'value-set-copy', 'error-codes', 'structural', 'transport'].includes(check)) throw new Error(`unknown check ${check}`);
  const verdict: SubGoalVerdict = { id: spec.subGoal.id, family: spec.subGoal.family, pass: ev.length === 0, evidence: ev };
  return report(spec.puzzle, treeArg, [verdict]);
}
