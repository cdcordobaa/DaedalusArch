/**
 * v1.3 correctness checker: what the source code says, read with the TypeScript compiler API.
 *
 * One `ts.Program` per project, from the project's own tsconfig.json (every `.ts` file under the root when there is
 * none). Import and export statements are read from the syntax tree; a specifier is resolved with
 * `ts.resolveModuleName` and the project's compilerOptions; a name is followed through re-exports with the type
 * checker's alias chain. This is the third reading of the code, independent of the extractor and of the graph.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';
import { buildHarnessTsconfig } from '../../../lib/generators/harness-tsconfig.js';

export type RelType = 'IMPORTS' | 'RE_EXPORTS';

export interface ImportFact {
  readonly kind: RelType;
  /** 1-based lines the statement spans. */
  readonly startLine: number;
  readonly endLine: number;
  readonly specifier: string;
  readonly isTypeOnly: boolean;
  /** Project-relative file the specifier resolves to, when it resolves inside the project (not node_modules). */
  readonly resolvedFile?: string;
  /** Package root of a bare specifier that does not resolve to a project file (`@scope/name`, `name`). */
  readonly packageRoot?: string;
  /** Identifiers of the names the statement imports or re-exports (for the alias chain). */
  readonly names: readonly ts.Node[];
  readonly node: ts.Node;
}

export interface TypeRef {
  readonly text: string;
  /** Project-relative files declaring the referenced type, with their declaration kind. */
  readonly declarations: readonly { readonly file: string; readonly kind: 'class' | 'interface' | 'other' }[];
}

export interface ClassFact {
  readonly name: string;
  readonly line: number;
  readonly implementsTypes: readonly TypeRef[];
  readonly ctorParams: readonly { readonly name: string; readonly type?: TypeRef }[];
  readonly methods: readonly { readonly name: string; readonly isStatic: boolean }[];
  /** Class members read for the value-object check (FF-DT03, member-fact template). */
  readonly members: MemberFacts;
}

export interface MemberFacts {
  /** Property declarations and constructor parameter properties. */
  readonly fields: readonly { readonly name: string; readonly isPublic: boolean; readonly isReadonly: boolean; readonly isStatic: boolean }[];
  /** Non-static `set` accessors (any visibility). */
  readonly setAccessors: readonly string[];
  /** Public non-static methods and arrow-function properties whose body assigns a `this.<field>` directly. */
  readonly mutators: readonly string[];
}

const hasMod = (n: ts.Node, k: ts.SyntaxKind): boolean =>
  (ts.canHaveModifiers(n) ? ts.getModifiers(n) ?? [] : []).some((m) => m.kind === k);

function isPublicMember(n: ts.Node, name: string): boolean {
  return !name.startsWith('#') && !hasMod(n, ts.SyntaxKind.PrivateKeyword) && !hasMod(n, ts.SyntaxKind.ProtectedKeyword);
}

/** `this.x`, `this['x']` (parenthesised or not); not `this.x.y`. */
function isThisField(e: ts.Node): boolean {
  let t = e;
  while (ts.isParenthesizedExpression(t)) t = t.expression;
  if (ts.isPropertyAccessExpression(t)) return t.expression.kind === ts.SyntaxKind.ThisKeyword;
  if (ts.isElementAccessExpression(t)) return t.expression.kind === ts.SyntaxKind.ThisKeyword && ts.isStringLiteralLike(t.argumentExpression);
  return false;
}

function hasThisTarget(lhs: ts.Node): boolean {
  if (isThisField(lhs)) return true;
  if (ts.isArrayLiteralExpression(lhs) || ts.isObjectLiteralExpression(lhs)) {
    let found = false;
    const walk = (n: ts.Node): void => { if (found) return; if (isThisField(n)) { found = true; return; } ts.forEachChild(n, walk); };
    ts.forEachChild(lhs, walk);
    return found;
  }
  return false;
}

/** True when the body assigns a `this` field (`=`, compound assignment, `++`/`--`, `delete`), arrow functions included. */
function assignsThisField(body: ts.Node | undefined): boolean {
  if (body === undefined) return false;
  let found = false;
  const walk = (n: ts.Node): void => {
    if (found) return;
    if (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isClassLike(n) || ts.isMethodDeclaration(n)
      || ts.isAccessor(n) || ts.isConstructorDeclaration(n)) return;
    if (ts.isBinaryExpression(n) && n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && n.operatorToken.kind <= ts.SyntaxKind.LastAssignment
      && hasThisTarget(n.left)) { found = true; return; }
    if ((ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n))
      && (n.operator === ts.SyntaxKind.PlusPlusToken || n.operator === ts.SyntaxKind.MinusMinusToken) && isThisField(n.operand)) { found = true; return; }
    if (ts.isDeleteExpression(n) && isThisField(n.expression)) { found = true; return; }
    ts.forEachChild(n, walk);
  };
  ts.forEachChild(body, walk);
  return found;
}

function memberFactsOf(node: ts.ClassDeclaration, sf: ts.SourceFile): MemberFacts {
  const fields: { name: string; isPublic: boolean; isReadonly: boolean; isStatic: boolean }[] = [];
  const setAccessors: string[] = [];
  const mutators: string[] = [];
  for (const m of node.members) {
    const name = m.name !== undefined ? m.name.getText(sf) : '';
    const isStatic = hasMod(m, ts.SyntaxKind.StaticKeyword);
    if (ts.isPropertyDeclaration(m)) {
      fields.push({ name, isPublic: isPublicMember(m, name), isReadonly: hasMod(m, ts.SyntaxKind.ReadonlyKeyword), isStatic });
      if (!isStatic && m.initializer !== undefined && ts.isArrowFunction(m.initializer) && isPublicMember(m, name) && assignsThisField(m.initializer.body)) mutators.push(name);
    } else if (ts.isConstructorDeclaration(m)) {
      for (const p of m.parameters) {
        if (!ts.isParameterPropertyDeclaration(p, m)) continue;
        const pn = p.name.getText(sf);
        fields.push({ name: pn, isPublic: isPublicMember(p, pn), isReadonly: hasMod(p, ts.SyntaxKind.ReadonlyKeyword), isStatic: false });
      }
    } else if (ts.isSetAccessorDeclaration(m)) {
      if (!isStatic) setAccessors.push(name);
    } else if (ts.isMethodDeclaration(m)) {
      if (!isStatic && isPublicMember(m, name) && assignsThisField(m.body)) mutators.push(name);
    }
  }
  return { fields, setAccessors, mutators };
}

const toPosix = (p: string): string => p.split(path.sep).join('/');

/** `@scope/name/sub` -> `@scope/name`; `name/sub` -> `name`; `node:fs` -> `node:fs`. */
export function packageRootOf(specifier: string): string {
  if (specifier.startsWith('node:')) return specifier;
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? specifier);
}

const isRelative = (s: string): boolean => s.startsWith('./') || s.startsWith('../') || s === '.' || s === '..' || s.startsWith('/');

function listTsFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx|mts|cts)$/.test(e.name)) out.push(p);
    }
  };
  walk(root);
  return out;
}

export class SourceFacts {
  readonly root: string;
  private readonly program: ts.Program;
  private readonly checker: ts.TypeChecker;
  private readonly options: ts.CompilerOptions;
  private readonly importCache = new Map<string, ImportFact[]>();

  /**
   * `tsconfig: 'adr-032'` reads the project with the pinned per-run tsconfig of the E1 cells (generator-protocol §3,
   * ADR-032; the tree's own tsconfig.json is ignored), as the extractor did.
   */
  constructor(projectRoot: string, opts: { readonly tsconfig?: 'own' | 'adr-032' } = {}) {
    this.root = path.resolve(projectRoot);
    const configPath = path.join(this.root, 'tsconfig.json');
    let rootNames: string[];
    if (opts.tsconfig === 'adr-032') {
      const parsed = ts.parseJsonConfigFileContent(buildHarnessTsconfig(this.root), ts.sys, this.root);
      this.options = { ...parsed.options, noEmit: true };
      rootNames = parsed.fileNames.length > 0 ? parsed.fileNames : listTsFiles(this.root);
    } else if (fs.existsSync(configPath)) {
      const config = ts.readConfigFile(configPath, (p) => ts.sys.readFile(p));
      const parsed = ts.parseJsonConfigFileContent(config.config ?? {}, ts.sys, this.root);
      this.options = { ...parsed.options, noEmit: true };
      rootNames = parsed.fileNames.length > 0 ? parsed.fileNames : listTsFiles(this.root);
    } else {
      this.options = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, noEmit: true, allowJs: false };
      rootNames = listTsFiles(this.root);
    }
    this.program = ts.createProgram({ rootNames, options: this.options });
    this.checker = this.program.getTypeChecker();
  }

  rel(abs: string): string {
    return toPosix(path.relative(this.root, abs));
  }

  exists(file: string): boolean {
    return fs.existsSync(path.join(this.root, file));
  }

  /** Project-relative file inside the project (not under node_modules), else undefined. */
  private projectFile(abs: string): string | undefined {
    const r = this.rel(abs);
    if (r.startsWith('..') || path.isAbsolute(r) || r.split('/').includes('node_modules')) return undefined;
    return r;
  }

  sourceFile(file: string): ts.SourceFile | undefined {
    const abs = path.join(this.root, file);
    const inProgram = this.program.getSourceFile(abs);
    if (inProgram !== undefined) return inProgram;
    if (!fs.existsSync(abs)) return undefined;
    return ts.createSourceFile(abs, fs.readFileSync(abs, 'utf8'), ts.ScriptTarget.Latest, true);
  }

  private lineOf(sf: ts.SourceFile, pos: number): number {
    return sf.getLineAndCharacterOfPosition(pos).line + 1;
  }

  resolve(specifier: string, fromFile: string): { resolvedFile?: string; packageRoot?: string } {
    const r = ts.resolveModuleName(specifier, path.join(this.root, fromFile), this.options, ts.sys).resolvedModule;
    const inside = r !== undefined ? this.projectFile(r.resolvedFileName) : undefined;
    if (inside !== undefined) return { resolvedFile: inside };
    if (!isRelative(specifier)) return { packageRoot: packageRootOf(specifier) };
    return {};
  }

  /** Every import, export-from, import-equals, `import()` and `require()` statement of a file. */
  imports(file: string): ImportFact[] {
    const cached = this.importCache.get(file);
    if (cached !== undefined) return cached;
    const sf = this.sourceFile(file);
    const out: ImportFact[] = [];
    if (sf === undefined) {
      this.importCache.set(file, out);
      return out;
    }
    const push = (node: ts.Node, kind: RelType, specNode: ts.Expression | undefined, isTypeOnly: boolean, names: ts.Node[]): void => {
      if (specNode === undefined || !ts.isStringLiteralLike(specNode)) return;
      out.push({
        kind, startLine: this.lineOf(sf, node.getStart(sf)), endLine: this.lineOf(sf, node.getEnd()),
        specifier: specNode.text, isTypeOnly, names, node, ...this.resolve(specNode.text, file),
      });
    };
    const visit = (node: ts.Node): void => {
      if (ts.isImportDeclaration(node)) {
        const names: ts.Node[] = [];
        const c = node.importClause;
        if (c?.name !== undefined) names.push(c.name);
        const b = c?.namedBindings;
        if (b !== undefined && ts.isNamedImports(b)) for (const e of b.elements) names.push(e.name);
        if (b !== undefined && ts.isNamespaceImport(b)) names.push(b.name);
        push(node, 'IMPORTS', node.moduleSpecifier, c?.phaseModifier === ts.SyntaxKind.TypeKeyword, names);
      } else if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined) {
        const names: ts.Node[] = [];
        const ec = node.exportClause;
        if (ec !== undefined && ts.isNamedExports(ec)) for (const e of ec.elements) names.push(e.name);
        push(node, 'RE_EXPORTS', node.moduleSpecifier, node.isTypeOnly, names);
      } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
        push(node, 'IMPORTS', node.moduleReference.expression, node.isTypeOnly, [node.name]);
      } else if (ts.isCallExpression(node) && node.arguments.length === 1
        && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
        push(node, 'IMPORTS', node.arguments[0], false, []);
      } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
        push(node, 'IMPORTS', node.argument.literal, true, []);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
    this.importCache.set(file, out);
    return out;
  }

  /** Statements covering one of `lines` (any statement when `lines` is empty). */
  importsAt(file: string, lines: readonly number[]): ImportFact[] {
    const all = this.imports(file);
    return lines.length === 0 ? all : all.filter((f) => lines.some((l) => l >= f.startLine && l <= f.endLine));
  }

  private declarationFiles(sym: ts.Symbol | undefined): string[] {
    if (sym === undefined) return [];
    const target = (sym.flags & ts.SymbolFlags.Alias) !== 0 ? this.checker.getAliasedSymbol(sym) : sym;
    const files = (target.declarations ?? []).map((d) => this.projectFile(d.getSourceFile().fileName)).filter((f): f is string => f !== undefined);
    return [...new Set(files)];
  }

  /** Files declaring the names a statement imports or re-exports (through barrels); `export *` uses the module's exports. */
  declaringFiles(fact: ImportFact): string[] {
    const files = new Set<string>();
    for (const id of fact.names) for (const f of this.declarationFiles(this.checker.getSymbolAtLocation(id))) files.add(f);
    if (fact.names.length === 0 && ts.isExportDeclaration(fact.node) && fact.node.moduleSpecifier !== undefined) {
      const mod = this.checker.getSymbolAtLocation(fact.node.moduleSpecifier);
      if (mod !== undefined) for (const e of this.checker.getExportsOfModule(mod)) for (const f of this.declarationFiles(e)) files.add(f);
    }
    return [...files].sort();
  }

  /**
   * Package roots a statement's names come from, following the alias chain one hop at a time (so a name re-exported
   * by a project barrel from a package is attributed to the package even when node_modules is absent).
   */
  packagesReached(fact: ImportFact): string[] {
    const out = new Set<string>();
    if (fact.packageRoot !== undefined) out.add(fact.packageRoot);
    for (const id of fact.names) {
      let sym = this.checker.getSymbolAtLocation(id);
      for (let hop = 0; hop < 10 && sym !== undefined && (sym.flags & ts.SymbolFlags.Alias) !== 0; hop += 1) {
        for (const d of sym.declarations ?? []) {
          const spec = moduleSpecifierOf(d);
          if (spec !== undefined && !isRelative(spec)) {
            const sf = d.getSourceFile();
            const r = this.resolve(spec, this.rel(sf.fileName));
            if (r.packageRoot !== undefined) out.add(r.packageRoot);
          }
        }
        sym = this.checker.getImmediateAliasedSymbol(sym);
      }
    }
    return [...out].sort();
  }

  private typeRef(node: ts.TypeNode | undefined): TypeRef | undefined {
    if (node === undefined) return undefined;
    const nameNode = ts.isTypeReferenceNode(node) ? node.typeName
      : ts.isExpressionWithTypeArguments(node) ? node.expression : undefined;
    if (nameNode === undefined) return { text: node.getText(), declarations: [] };
    const id = ts.isQualifiedName(nameNode) ? nameNode.right : ts.isPropertyAccessExpression(nameNode) ? nameNode.name : nameNode;
    const sym = this.checker.getSymbolAtLocation(id);
    const target = sym !== undefined && (sym.flags & ts.SymbolFlags.Alias) !== 0 ? this.checker.getAliasedSymbol(sym) : sym;
    const declarations = (target?.declarations ?? []).flatMap((d) => {
      const file = this.projectFile(d.getSourceFile().fileName);
      if (file === undefined) return [];
      const kind = ts.isClassDeclaration(d) ? 'class' as const : ts.isInterfaceDeclaration(d) ? 'interface' as const : 'other' as const;
      return [{ file, kind }];
    });
    return { text: ts.isIdentifier(id) ? id.text : id.getText(), declarations };
  }

  classes(file: string): ClassFact[] {
    const sf = this.sourceFile(file);
    if (sf === undefined) return [];
    const out: ClassFact[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isClassDeclaration(node) && node.name !== undefined) {
        const implementsTypes = (node.heritageClauses ?? [])
          .filter((h) => h.token === ts.SyntaxKind.ImplementsKeyword)
          .flatMap((h) => h.types.map((t) => this.typeRef(t)).filter((t): t is TypeRef => t !== undefined));
        const ctor = node.members.find(ts.isConstructorDeclaration);
        const ctorParams = (ctor?.parameters ?? []).map((p) => {
          const type = this.typeRef(p.type);
          return { name: p.name.getText(sf), ...(type !== undefined && { type }) };
        });
        const methods = node.members
          .filter((m): m is ts.MethodDeclaration | ts.SetAccessorDeclaration => ts.isMethodDeclaration(m) || ts.isSetAccessorDeclaration(m))
          .map((m) => ({
            name: m.name.getText(sf),
            isStatic: (ts.getCombinedModifierFlags(m) & ts.ModifierFlags.Static) !== 0,
          }));
        out.push({ name: node.name.text, line: this.lineOf(sf, node.getStart(sf)), implementsTypes, ctorParams, methods, members: memberFactsOf(node, sf) });
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
    return out;
  }

  /** Names of the classes and interfaces a file declares. */
  declaredTypes(file: string): string[] {
    const sf = this.sourceFile(file);
    if (sf === undefined) return [];
    return sf.statements
      .filter((s): s is ts.ClassDeclaration | ts.InterfaceDeclaration => ts.isClassDeclaration(s) || ts.isInterfaceDeclaration(s))
      .map((s) => s.name?.text ?? '')
      .filter((n) => n !== '');
  }
}

function moduleSpecifierOf(d: ts.Declaration): string | undefined {
  const n = ts.findAncestor(d, (x): x is ts.ImportDeclaration | ts.ExportDeclaration | ts.ImportEqualsDeclaration =>
    ts.isImportDeclaration(x) || ts.isExportDeclaration(x) || ts.isImportEqualsDeclaration(x));
  if (n === undefined) return undefined;
  if (ts.isImportEqualsDeclaration(n)) {
    return ts.isExternalModuleReference(n.moduleReference) && ts.isStringLiteralLike(n.moduleReference.expression) ? n.moduleReference.expression.text : undefined;
  }
  const spec = n.moduleSpecifier;
  return spec !== undefined && ts.isStringLiteralLike(spec) ? spec.text : undefined;
}

/** One `SourceFacts` per project root. */
/** Keeps the most recent `max` projects (one `ts.Program` each; 65 E1 programs do not fit in one heap). */
export class SourceFactsCache {
  private readonly cache = new Map<string, SourceFacts>();
  constructor(private readonly max = 4) {}
  get(root: string, tsconfig: 'own' | 'adr-032' = 'own'): SourceFacts {
    const key = `${tsconfig}\u0000${path.resolve(root)}`;
    let f = this.cache.get(key);
    if (f === undefined) {
      f = new SourceFacts(root, { tsconfig });
      if (this.cache.size >= this.max) {
        const oldest = this.cache.keys().next().value;
        if (oldest !== undefined) this.cache.delete(oldest);
      }
    } else {
      this.cache.delete(key);
    }
    this.cache.set(key, f);
    return f;
  }
}
