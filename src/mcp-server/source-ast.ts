/**
 * Syntax facts of one TypeScript/JavaScript source text for the MCP v2 fast checks (`check_file`, `check_diff`): the
 * imports with their bound names, re-exports, top-level declarations, classes (heritage, constructor parameters,
 * methods and their signatures, member facts) and calls. Parsed with ts-morph on an in-memory file system, with no
 * type checker and no module resolution, so one file costs a few milliseconds and partial text (the added lines of a
 * diff) still parses as far as it goes. Pure apart from the shared in-memory project, whose file is removed again.
 *
 * Type names are read from annotations only: an inferred return type is invisible here (a documented limit of the
 * fast path, `Docs/v1.3/mcp-v2.md`).
 */
import { Node, Project, Scope, SyntaxKind } from 'ts-morph';
import type { ClassDeclaration, ParameterDeclaration, SourceFile, TypeNode } from 'ts-morph';
import { extractClassMemberFacts } from '../apg-extractor/member-facts.js';
import type { ClassMemberFacts } from '../apg-extractor/member-facts.js';

export interface AstImportName {
  /** The exported name read from the module (`default` for a default import, `*` for a namespace import). */
  readonly imported: string;
  /** The local binding. */
  readonly local: string;
}

export interface AstImport {
  readonly specifier: string;
  readonly line: number;
  /** `reexport` for `export ... from`; the other kinds as in `source-scan.ts`. */
  readonly kind: 'static' | 'type' | 'side-effect' | 'require' | 'dynamic' | 'reexport';
  readonly names: readonly AstImportName[];
  /** `export * from` (every name). */
  readonly all: boolean;
}

export interface AstParam {
  readonly name: string;
  readonly line: number;
  /** Identifiers named by the type annotation (type references and their type arguments); `import:<pkg>.<Name>` for an inline `import('pkg').Name`. */
  readonly typeNames: readonly string[];
  /** A constructor parameter property (`private readonly x: T`). */
  readonly property: boolean;
}

export interface AstMethod {
  readonly name: string;
  readonly line: number;
  readonly isStatic: boolean;
  readonly visibility: 'public' | 'protected' | 'private';
  readonly params: readonly AstParam[];
  readonly returnTypeNames: readonly string[];
  /** The return annotation is absent (an inferred type the fast path cannot read). */
  readonly returnInferred: boolean;
}

export interface AstClass {
  readonly name: string;
  readonly line: number;
  readonly endLine: number;
  readonly exported: boolean;
  readonly decorators: readonly string[];
  readonly implementsNames: readonly string[];
  readonly extendsName: string | null;
  readonly ctorParams: readonly AstParam[];
  readonly methods: readonly AstMethod[];
  /** Field name to the identifiers of its type annotation (properties and parameter properties). */
  readonly fieldTypes: Readonly<Record<string, readonly string[]>>;
  readonly memberFacts: ClassMemberFacts;
}

export interface AstFunction {
  readonly name: string;
  readonly line: number;
  readonly exported: boolean;
  readonly params: readonly AstParam[];
  readonly returnTypeNames: readonly string[];
}

export interface AstCall {
  /** Identifier chain from the root: `axios.get(` → [axios, get]; `this.repo.find(` → [this, repo, find]. */
  readonly chain: readonly string[];
  readonly line: number;
  readonly isNew: boolean;
  readonly argCount: number;
  /** The enclosing class, when the call is inside one. */
  readonly className: string | null;
  /** Inside a decorator (`@Column()`): declares, performs nothing. */
  readonly inDecorator: boolean;
}

export interface AstPropertyRead {
  /** `process.env`, `process.argv`, ... as [process, env]. */
  readonly chain: readonly string[];
  readonly line: number;
  readonly className: string | null;
}

export interface AstFile {
  readonly imports: readonly AstImport[];
  /** Top-level names this file declares itself (class, interface, function, type, enum, variable). */
  readonly declares: readonly string[];
  readonly classes: readonly AstClass[];
  readonly functions: readonly AstFunction[];
  readonly calls: readonly AstCall[];
  readonly propertyReads: readonly AstPropertyRead[];
  /** Syntax errors were found (partial text): facts may be incomplete. */
  readonly partial: boolean;
}

let shared: Project | undefined;
let counter = 0;

function project(): Project {
  shared ??= new Project({
    useInMemoryFileSystem: true,
    skipLoadingLibFiles: true,
    skipFileDependencyResolution: true,
    compilerOptions: { allowJs: true, noResolve: true },
  });
  return shared;
}

const lineOf = (n: Node): number => n.getStartLineNumber();

/** Identifiers named in a type annotation, depth-first (type references, qualified names' first segment, type args). */
export function typeNamesOf(type: TypeNode | undefined): string[] {
  if (type === undefined) return [];
  const out: string[] = [];
  const push = (s: string): void => {
    if (!out.includes(s)) out.push(s);
  };
  const visit = (n: Node): void => {
    if (Node.isImportTypeNode(n)) {
      const arg = n.getArgument();
      const literal = Node.isLiteralTypeNode(arg) ? arg.getLiteral() : undefined;
      const pkg = literal !== undefined && Node.isStringLiteral(literal) ? literal.getLiteralValue() : '';
      const q = n.getQualifier();
      push(`import:${pkg}.${q === undefined ? 'default' : q.getText()}`);
      for (const t of n.getTypeArguments()) visit(t);
      return;
    }
    if (Node.isTypeReference(n)) {
      const tn = n.getTypeName();
      push(Node.isQualifiedName(tn) ? tn.getText().split('.')[0] ?? tn.getText() : tn.getText());
      for (const t of n.getTypeArguments()) visit(t);
      return;
    }
    if (Node.isExpressionWithTypeArguments(n)) {
      push(n.getExpression().getText().split('.')[0] ?? '');
      for (const t of n.getTypeArguments()) visit(t);
      return;
    }
    n.forEachChild(visit);
  };
  visit(type);
  return out;
}

function visibilityOf(member: { getScope(): Scope | undefined; getName(): string }): 'public' | 'protected' | 'private' {
  if (member.getName().startsWith('#')) return 'private';
  const s = member.getScope();
  return s === Scope.Private ? 'private' : s === Scope.Protected ? 'protected' : 'public';
}

function paramOf(p: ParameterDeclaration): AstParam {
  return { name: p.getName(), line: lineOf(p), typeNames: typeNamesOf(p.getTypeNode()), property: p.isParameterProperty() };
}

function classOf(cls: ClassDeclaration): AstClass {
  const ctor = cls.getConstructors()[0];
  const fieldTypes: Record<string, readonly string[]> = {};
  for (const p of cls.getProperties()) fieldTypes[p.getName()] = typeNamesOf(p.getTypeNode());
  for (const p of ctor?.getParameters() ?? []) if (p.isParameterProperty()) fieldTypes[p.getName()] = typeNamesOf(p.getTypeNode());
  const ext = cls.getExtends();
  return {
    name: cls.getName() ?? 'default',
    line: lineOf(cls.getNameNode() ?? cls),
    endLine: cls.getEndLineNumber(),
    exported: cls.isExported(),
    decorators: cls.getDecorators().map((d) => d.getName()),
    implementsNames: cls.getImplements().map((i) => i.getExpression().getText().split('.').pop() ?? ''),
    extendsName: ext === undefined ? null : ext.getExpression().getText().split('.').pop() ?? null,
    ctorParams: (ctor?.getParameters() ?? []).map(paramOf),
    methods: cls.getMethods().map((m) => ({
      name: m.getName(),
      line: lineOf(m),
      isStatic: m.isStatic(),
      visibility: visibilityOf(m),
      params: m.getParameters().map(paramOf),
      returnTypeNames: typeNamesOf(m.getReturnTypeNode()),
      returnInferred: m.getReturnTypeNode() === undefined,
    })),
    fieldTypes,
    memberFacts: extractClassMemberFacts(cls),
  };
}

function chainOf(expr: Node): string[] | undefined {
  if (Node.isIdentifier(expr)) return [expr.getText()];
  if (expr.getKind() === SyntaxKind.ThisKeyword) return ['this'];
  if (Node.isPropertyAccessExpression(expr)) {
    const head = chainOf(expr.getExpression());
    return head === undefined ? undefined : [...head, expr.getName()];
  }
  if (Node.isParenthesizedExpression(expr) || Node.isNonNullExpression(expr) || Node.isAwaitExpression(expr)) {
    return chainOf(expr.getExpression());
  }
  if (Node.isCallExpression(expr)) return chainOf(expr.getExpression());
  return undefined;
}

function enclosingClass(n: Node): string | null {
  const cls = n.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);
  return cls?.getName() ?? null;
}

function importsOf(sf: SourceFile): AstImport[] {
  const out: AstImport[] = [];
  for (const d of sf.getImportDeclarations()) {
    const names: AstImportName[] = [];
    const def = d.getDefaultImport();
    if (def !== undefined) names.push({ imported: 'default', local: def.getText() });
    const ns = d.getNamespaceImport();
    if (ns !== undefined) names.push({ imported: '*', local: ns.getText() });
    for (const n of d.getNamedImports()) names.push({ imported: n.getName(), local: n.getAliasNode()?.getText() ?? n.getName() });
    const typeOnly = d.isTypeOnly();
    out.push({
      specifier: d.getModuleSpecifierValue(),
      line: lineOf(d),
      kind: names.length === 0 ? 'side-effect' : typeOnly ? 'type' : 'static',
      names,
      all: false,
    });
  }
  for (const d of sf.getExportDeclarations()) {
    const spec = d.getModuleSpecifierValue();
    if (spec === undefined) continue;
    const names = d.getNamedExports().map((n) => ({ imported: n.getName(), local: n.getAliasNode()?.getText() ?? n.getName() }));
    out.push({ specifier: spec, line: lineOf(d), kind: 'reexport', names, all: names.length === 0 });
  }
  for (const d of sf.getDescendantsOfKind(SyntaxKind.ImportEqualsDeclaration)) {
    const ref = d.getModuleReference();
    if (Node.isExternalModuleReference(ref)) {
      const e = ref.getExpression();
      if (e !== undefined && Node.isStringLiteral(e)) out.push({ specifier: e.getLiteralValue(), line: lineOf(d), kind: 'static', names: [{ imported: '*', local: d.getName() }], all: false });
    }
  }
  for (const c of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const callee = c.getExpression();
    const [arg] = c.getArguments();
    if (arg === undefined || !(Node.isStringLiteral(arg) || Node.isNoSubstitutionTemplateLiteral(arg))) continue;
    if (callee.getKind() === SyntaxKind.ImportKeyword) out.push({ specifier: arg.getLiteralValue(), line: lineOf(c), kind: 'dynamic', names: [], all: false });
    else if (Node.isIdentifier(callee) && callee.getText() === 'require' && c.getFirstAncestorByKind(SyntaxKind.ExternalModuleReference) === undefined) {
      out.push({ specifier: arg.getLiteralValue(), line: lineOf(c), kind: 'require', names: [], all: false });
    }
  }
  return out.sort((a, b) => a.line - b.line);
}

function declaresOf(sf: SourceFile): string[] {
  const out: string[] = [];
  for (const s of sf.getStatements()) {
    if (Node.isClassDeclaration(s) || Node.isInterfaceDeclaration(s) || Node.isFunctionDeclaration(s) || Node.isTypeAliasDeclaration(s) || Node.isEnumDeclaration(s)) {
      const n = s.getName();
      if (n !== undefined) out.push(n);
    } else if (Node.isVariableStatement(s)) {
      for (const d of s.getDeclarations()) out.push(d.getName());
    }
  }
  return out;
}

function functionsOf(sf: SourceFile): AstFunction[] {
  const out: AstFunction[] = [];
  for (const f of sf.getFunctions()) {
    out.push({
      name: f.getName() ?? 'default',
      line: lineOf(f),
      exported: f.isExported(),
      params: f.getParameters().map(paramOf),
      returnTypeNames: typeNamesOf(f.getReturnTypeNode()),
    });
  }
  for (const v of sf.getVariableStatements()) {
    for (const d of v.getDeclarations()) {
      const init = d.getInitializer();
      if (init === undefined || !(Node.isArrowFunction(init) || Node.isFunctionExpression(init))) continue;
      out.push({
        name: d.getName(),
        line: lineOf(d),
        exported: v.isExported(),
        params: init.getParameters().map(paramOf),
        returnTypeNames: typeNamesOf(init.getReturnTypeNode()),
      });
    }
  }
  return out;
}

/** Parses `text` as file `fileName` (the extension decides TS or JS) and returns its facts. */
export function parseSource(text: string, fileName = 'file.ts'): AstFile {
  const p = project();
  counter++;
  const ext = /\.(?:[cm]?[jt]sx?)$/.exec(fileName)?.[0] ?? '.ts';
  const sf = p.createSourceFile(`/mcp-${String(counter)}${ext}`, text, { overwrite: true });
  try {
    const calls: AstCall[] = [];
    // Document order: calls and `new` expressions interleaved as written.
    const nodes = sf.getDescendants().filter((n) => Node.isCallExpression(n) || Node.isNewExpression(n));
    for (const c of nodes) {
      if (!Node.isCallExpression(c) && !Node.isNewExpression(c)) continue;
      const chain = chainOf(c.getExpression());
      if (chain === undefined) continue;
      calls.push({
        chain,
        line: lineOf(c),
        isNew: Node.isNewExpression(c),
        argCount: c.getArguments().length,
        className: enclosingClass(c),
        inDecorator: c.getFirstAncestorByKind(SyntaxKind.Decorator) !== undefined,
      });
    }
    const propertyReads: AstPropertyRead[] = [];
    for (const pa of sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)) {
      const e = pa.getExpression();
      if (Node.isIdentifier(e) && e.getText() === 'process') propertyReads.push({ chain: ['process', pa.getName()], line: lineOf(pa), className: enclosingClass(pa) });
    }
    const diagnostics = (sf.compilerNode as unknown as { parseDiagnostics?: readonly unknown[] }).parseDiagnostics ?? [];
    const partial = diagnostics.length > 0;
    return {
      imports: importsOf(sf),
      declares: declaresOf(sf),
      classes: sf.getClasses().map(classOf),
      functions: functionsOf(sf),
      calls,
      propertyReads,
      partial,
    };
  } finally {
    p.removeSourceFile(sf);
  }
}
