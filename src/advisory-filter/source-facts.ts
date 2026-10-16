/**
 * Source facts for the advisory post-filters (v1.3 advisory-noise proposal, Docs/DiagnosticRuns/v1.3-advisory-noise-2026-10-16.md).
 *
 * One syntactic pass over a single file with the TypeScript compiler API (no type checker, no program): the facts
 * the options read are local to the file, so a filter decision never depends on how the project was extracted.
 *
 * "Logic" is any statement that computes or decides: control flow, a nested function, a call outside a constructor's
 * `super(...)`, or an assignment other than `this.x = <parameter or literal>`. A file has no logic when it declares only
 * types, re-exports, enums, constant data, or classes whose members are fields and a constructor of that shape (DTOs,
 * error subclasses).
 */
import { ts } from 'ts-morph';

/** One import or re-export of the file. */
export interface ImportFact {
  readonly specifier: string;
  /** `import type { … }`, `export type { … } from`, or every named binding is `type`-qualified. */
  readonly typeOnly: boolean;
  /** `export … from` (a RE_EXPORTS edge, not an IMPORTS edge). */
  readonly reExport: boolean;
}

/** One class of the file, as the SRP / ISP proxies count it. */
export interface MemberFacts {
  readonly name: string;
  readonly kind: 'class' | 'interface';
  /** Method-like members excluded by the framework-member option, by name (accessors, lifecycle hooks, `toJSON`, …). */
  readonly excludedMethods: readonly string[];
  /** Constructor parameter type names (the DI dependencies), as written. */
  readonly constructorParamTypes: readonly string[];
}

export interface SourceFacts {
  /** Only type-level declarations: interfaces, type aliases, `declare`, imports and type re-exports. */
  readonly typesOnly: boolean;
  /** Only imports and re-exports (`export … from`, `export { … }`). */
  readonly barrel: boolean;
  /** No runtime logic (see the module comment). Implied by `typesOnly` and `barrel`. */
  readonly noLogic: boolean;
  /** No control flow and no nested function anywhere, and every function body has at most two statements. */
  readonly noBranching: boolean;
  /** A control-flow statement or conditional expression anywhere (short-circuit operators do not count). */
  readonly controlFlow: boolean;
  /** At least one top-level class declaration. */
  readonly declaresClass: boolean;
  /** Identifiers used in `new X(…)` expressions anywhere in the file. */
  readonly instantiated: readonly string[];
  /** Local binding name to import specifier, for value imports. */
  readonly importedNames: Readonly<Record<string, string>>;
  readonly imports: readonly ImportFact[];
  readonly members: readonly MemberFacts[];
  /** A `@generated` / "auto-generated" / "do not edit" marker in the first comment block. */
  readonly generatedMarker: boolean;
}

/** Lifecycle hooks and serialisation members that frameworks or the runtime require, not a responsibility of the class. */
export const FRAMEWORK_METHOD_NAMES: readonly string[] = Object.freeze([
  'onModuleInit', 'onModuleDestroy', 'onApplicationBootstrap', 'onApplicationShutdown', 'beforeApplicationShutdown',
  'ngOnInit', 'ngOnDestroy', 'ngOnChanges', 'ngAfterViewInit', 'ngAfterContentInit', 'ngDoCheck',
  'componentDidMount', 'componentWillUnmount', 'componentDidUpdate', 'render',
  'toJSON', 'toString', 'valueOf', 'equals', 'hashCode', 'clone',
]);

/** Constructor-injected framework services that are infrastructure plumbing, not a collaborator (SRP proxy only). */
export const FRAMEWORK_DEPENDENCY_TYPES: readonly string[] = Object.freeze(['Logger', 'ConfigService', 'ModuleRef', 'Reflector']);

const CONTROL_FLOW = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.IfStatement, ts.SyntaxKind.SwitchStatement, ts.SyntaxKind.ForStatement, ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.ForOfStatement, ts.SyntaxKind.WhileStatement, ts.SyntaxKind.DoStatement, ts.SyntaxKind.TryStatement,
  ts.SyntaxKind.ThrowStatement, ts.SyntaxKind.ConditionalExpression,
]);
const SHORT_CIRCUIT = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken,
]);

function isFunctionLike(n: ts.Node): boolean {
  return ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n)
    || ts.isGetAccessorDeclaration(n) || ts.isSetAccessorDeclaration(n) || ts.isConstructorDeclaration(n);
}

function hasModifier(n: ts.Node, kind: ts.SyntaxKind): boolean {
  return ts.canHaveModifiers(n) && (ts.getModifiers(n) ?? []).some((m) => m.kind === kind);
}

/** True when `node` (or anything under it) branches: control flow or a short-circuit operator. */
function branches(node: ts.Node): boolean {
  let found = false;
  const visit = (n: ts.Node): void => {
    if (found) return;
    if (CONTROL_FLOW.has(n.kind)) { found = true; return; }
    if (ts.isBinaryExpression(n) && SHORT_CIRCUIT.has(n.operatorToken.kind)) { found = true; return; }
    n.forEachChild(visit);
  };
  visit(node);
  return found;
}

/** True when `node` (or anything under it) holds a control-flow statement or a conditional expression. */
function hasControlFlow(node: ts.Node): boolean {
  let found = false;
  const visit = (n: ts.Node): void => {
    if (found) return;
    if (CONTROL_FLOW.has(n.kind)) { found = true; return; }
    n.forEachChild(visit);
  };
  visit(node);
  return found;
}

/** True when `node` contains a nested function or class expression. */
function nestsFunction(node: ts.Node): boolean {
  let found = false;
  const visit = (n: ts.Node): void => {
    if (found) return;
    if (ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isClassExpression(n)) { found = true; return; }
    n.forEachChild(visit);
  };
  node.forEachChild(visit);
  return found;
}

/** True when `node` contains a call (other than the allowed `super(...)` statement, checked by the caller). */
function calls(node: ts.Node): boolean {
  let found = false;
  const visit = (n: ts.Node): void => {
    if (found) return;
    if (ts.isCallExpression(n) || ts.isTaggedTemplateExpression(n) || ts.isAwaitExpression(n)) { found = true; return; }
    n.forEachChild(visit);
  };
  visit(node);
  return found;
}

/** A data initializer: no branching, no nested function, no call (`new X()` and literals are fine). */
function isDataExpression(e: ts.Expression | undefined): boolean {
  return e === undefined || (!branches(e) && !nestsFunction(e) && !ts.isArrowFunction(e) && !ts.isFunctionExpression(e) && !calls(e));
}

/** A constructor with only `super(<data>)` and `this.x = <data>` statements. */
function isTrivialConstructor(c: ts.ConstructorDeclaration): boolean {
  for (const s of c.body?.statements ?? []) {
    if (!ts.isExpressionStatement(s)) return false;
    const e = s.expression;
    if (ts.isCallExpression(e) && e.expression.kind === ts.SyntaxKind.SuperKeyword) {
      if (!e.arguments.every((a) => isDataExpression(a))) return false;
      continue;
    }
    if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && ts.isPropertyAccessExpression(e.left) && e.left.expression.kind === ts.SyntaxKind.ThisKeyword
      && isDataExpression(e.right)) continue;
    return false;
  }
  return true;
}

/** A class with only fields (data initializers) and a trivial constructor: a DTO, a record, an error subclass. */
function isDataClass(c: ts.ClassDeclaration): boolean {
  for (const m of c.members) {
    if (ts.isPropertyDeclaration(m)) {
      if (!isDataExpression(m.initializer)) return false;
      continue;
    }
    if (ts.isConstructorDeclaration(m)) {
      if (!isTrivialConstructor(m)) return false;
      continue;
    }
    if (ts.isIndexSignatureDeclaration(m) || ts.isSemicolonClassElement(m)) continue;
    return false;
  }
  return true;
}

function isTypeLevel(s: ts.Statement): boolean {
  return ts.isInterfaceDeclaration(s) || ts.isTypeAliasDeclaration(s) || ts.isImportDeclaration(s)
    || ts.isImportEqualsDeclaration(s) || hasModifier(s, ts.SyntaxKind.DeclareKeyword)
    || (ts.isExportDeclaration(s) && (s.isTypeOnly || s.moduleSpecifier !== undefined || s.exportClause !== undefined));
}

function isReExport(s: ts.Statement): boolean {
  return ts.isImportDeclaration(s) || ts.isExportDeclaration(s) || (ts.isExportAssignment(s) && ts.isIdentifier(s.expression));
}

/** A top-level statement with no runtime logic. */
function isNoLogicStatement(s: ts.Statement): boolean {
  if (isTypeLevel(s) || isReExport(s)) return true;
  if (ts.isEnumDeclaration(s)) return true;
  if (ts.isClassDeclaration(s)) return isDataClass(s);
  if (ts.isVariableStatement(s)) return s.declarationList.declarations.every((d) => isDataExpression(d.initializer));
  if (ts.isEmptyStatement(s)) return true;
  return false;
}

/** Every function body in `root` has at most two statements; the caller has checked there is no branching. */
function shortBodies(root: ts.Node): boolean {
  let ok = true;
  const visit = (n: ts.Node): void => {
    if (!ok) return;
    if (isFunctionLike(n)) {
      const body = (n as ts.FunctionLikeDeclarationBase).body;
      if (body !== undefined && ts.isBlock(body) && body.statements.length > 2) { ok = false; return; }
    }
    n.forEachChild(visit);
  };
  visit(root);
  return ok;
}

/** No nested function (callbacks, arrow properties) inside any function body. */
function noNestedFunctionsInBodies(root: ts.Node): boolean {
  let ok = true;
  const visit = (n: ts.Node, inBody: boolean): void => {
    if (!ok) return;
    if ((ts.isArrowFunction(n) || ts.isFunctionExpression(n)) && inBody) { ok = false; return; }
    const entering = isFunctionLike(n);
    n.forEachChild((c) => { visit(c, inBody || entering); });
  };
  visit(root, false);
  return ok;
}

function importFacts(sf: ts.SourceFile): { imports: ImportFact[]; importedNames: Record<string, string> } {
  const imports: ImportFact[] = [];
  const importedNames: Record<string, string> = {};
  for (const s of sf.statements) {
    if (ts.isImportDeclaration(s) && ts.isStringLiteral(s.moduleSpecifier)) {
      const spec = s.moduleSpecifier.text;
      const clause = s.importClause;
      let typeOnly = clause?.isTypeOnly === true;
      if (clause !== undefined && !typeOnly) {
        const named = clause.namedBindings;
        const allNamedTyped = named !== undefined && ts.isNamedImports(named) && named.elements.length > 0
          && named.elements.every((e) => e.isTypeOnly);
        typeOnly = clause.name === undefined && allNamedTyped;
        if (clause.name !== undefined) importedNames[clause.name.text] = spec;
        if (named !== undefined && ts.isNamedImports(named)) {
          for (const e of named.elements) if (!e.isTypeOnly) importedNames[e.name.text] = spec;
        }
        if (named !== undefined && ts.isNamespaceImport(named)) importedNames[named.name.text] = spec;
      }
      imports.push({ specifier: spec, typeOnly, reExport: false });
    } else if (ts.isExportDeclaration(s) && s.moduleSpecifier !== undefined && ts.isStringLiteral(s.moduleSpecifier)) {
      imports.push({ specifier: s.moduleSpecifier.text, typeOnly: s.isTypeOnly, reExport: true });
    }
  }
  return { imports, importedNames };
}

function memberFacts(sf: ts.SourceFile): MemberFacts[] {
  const out: MemberFacts[] = [];
  const visit = (n: ts.Node): void => {
    if (ts.isClassDeclaration(n) && n.name !== undefined) {
      const excluded: string[] = [];
      let ctorTypes: string[] = [];
      for (const m of n.members) {
        const name = m.name !== undefined && (ts.isIdentifier(m.name) || ts.isStringLiteral(m.name)) ? m.name.text : '';
        if (ts.isGetAccessorDeclaration(m) || ts.isSetAccessorDeclaration(m)) excluded.push(`${name} (accessor)`);
        else if (ts.isMethodDeclaration(m) && FRAMEWORK_METHOD_NAMES.includes(name)) excluded.push(name);
        else if (ts.isConstructorDeclaration(m)) ctorTypes = m.parameters.map((p) => p.type?.getText(sf) ?? '');
      }
      out.push({ name: n.name.text, kind: 'class', excludedMethods: excluded, constructorParamTypes: ctorTypes });
    } else if (ts.isInterfaceDeclaration(n)) {
      const excluded: string[] = [];
      for (const m of n.members) {
        const name = m.name !== undefined && (ts.isIdentifier(m.name) || ts.isStringLiteral(m.name)) ? m.name.text : '';
        if (ts.isGetAccessor(m) || ts.isSetAccessor(m)) excluded.push(`${name} (accessor)`);
        else if (ts.isMethodSignature(m) && FRAMEWORK_METHOD_NAMES.includes(name)) excluded.push(name);
      }
      out.push({ name: n.name.text, kind: 'interface', excludedMethods: excluded, constructorParamTypes: [] });
    }
    n.forEachChild(visit);
  };
  visit(sf);
  return out;
}

function instantiated(sf: ts.SourceFile): string[] {
  const names = new Set<string>();
  const visit = (n: ts.Node): void => {
    if (ts.isNewExpression(n) && ts.isIdentifier(n.expression)) names.add(n.expression.text);
    n.forEachChild(visit);
  };
  visit(sf);
  return [...names].sort();
}

const GENERATED = /@generated\b|auto-?generated|do not edit/i;

/** The facts of one TypeScript source text. `fileName` only selects TS / TSX parsing. */
export function sourceFacts(text: string, fileName = 'file.ts'): SourceFacts {
  const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind);
  const statements = [...sf.statements];
  const typesOnly = statements.every(isTypeLevel);
  const barrel = statements.length > 0 && statements.every(isReExport);
  const noLogic = typesOnly || barrel || statements.every(isNoLogicStatement);
  const noBranching = noLogic || (!branches(sf) && noNestedFunctionsInBodies(sf) && shortBodies(sf));
  const { imports, importedNames } = importFacts(sf);
  const head = text.slice(0, 600);
  return {
    typesOnly,
    barrel,
    noLogic,
    noBranching,
    controlFlow: hasControlFlow(sf),
    declaresClass: statements.some((s) => ts.isClassDeclaration(s)),
    instantiated: instantiated(sf),
    importedNames,
    imports,
    members: memberFacts(sf),
    generatedMarker: GENERATED.test(head),
  };
}
