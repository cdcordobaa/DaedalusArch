/**
 * Shared helpers of the semantic anti-pattern operators AP-* (v1.3 DRAFT; `Docs/operator-catalogue-antipatterns.md`).
 *
 * Everything here reads the ts-morph project of one copy and the parsed spec; nothing reads a detector or judge
 * output (BR-U5a-06). The helpers name the code shapes the operators look for in NestJS/TypeORM code:
 *
 * - **Service class**: a named class of an application-kind layer file that is not a controller, with a constructor
 *   parameter or a `Service` / `UseCase` / `Interactor` / `Handler` name (DTO, command and query classes have neither).
 * - **Injected field**: a constructor parameter property (`private readonly x: T`).
 * - **Parameter rule**: a top-level `if (<cond>) { throw <expr>; }` statement of a method (no `else`) whose identifiers
 *   are only the method's own plain parameters, globals of the default library, or named imports of a bare package
 *   (`BadRequestException` from `@nestjs/common`). It reads no `this`, awaits nothing and calls no project code, so it
 *   can be moved or copied without its class.
 */
import { IndentationText, Node, QuoteKind, Scope, SyntaxKind } from 'ts-morph';
import type { ClassDeclaration, IfStatement, MethodDeclaration, ParameterDeclaration, SourceFile } from 'ts-morph';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PlannedImportUse, ProjectHandle } from '../types.js';
import { isBareSpecifier } from '../stubs.js';
import { cmp, isControllerFile, layerOfFile, namedClasses, projectFiles, relOf } from '../operators/common.js';
import type { SpecView } from '../operators/common.js';

/**
 * Makes the next ts-morph edits follow `sf`'s own style: the quote of its first import specifier (single when it has
 * none) and the indentation of its first indented line (two spaces when none). An inserted line in a foreign style
 * would be a cue that is not the defect.
 */
export function useFileStyle(sf: SourceFile): void {
  const first = sf.getImportDeclarations()[0]?.getModuleSpecifier().getText() ?? "'";
  const lines = sf.getFullText().split('\n');
  const tabs = lines.some((l) => /^\t+[^\s*]/.test(l));
  const widths = lines.map((l) => /^( +)[^\s*]/.exec(l)?.[1]?.length ?? 0).filter((n) => n >= 2);
  const width = widths.length === 0 ? 2 : Math.min(...widths);
  const indentationText = tabs && widths.length === 0 ? IndentationText.Tab : width >= 8 ? IndentationText.EightSpaces : width >= 4 ? IndentationText.FourSpaces : IndentationText.TwoSpaces;
  sf.getProject().manipulationSettings.set({ quoteKind: first.startsWith('"') ? QuoteKind.Double : QuoteKind.Single, indentationText });
}

export function upperFirst(name: string): string {
  return name.length === 0 ? name : name.charAt(0).toUpperCase() + name.slice(1);
}

const SERVICE_NAME = /(?:Service|UseCase|Interactor|Handler)$/;
const DATA_NAME = /(?:Dto|DTO|Command|Query|Event|Input|Output|Request|Response|Entity|Model)$/;

export interface ServiceClass {
  readonly file: string;
  readonly cls: ClassDeclaration;
}

/** Service classes of the application-kind layers, path then declaration order. */
export function serviceClasses(handle: ProjectHandle, view: SpecView): ServiceClass[] {
  const app = new Set(view.binding.applicationLayers);
  const out: ServiceClass[] = [];
  for (const sf of projectFiles(handle)) {
    const rel = relOf(handle, sf);
    const layer = layerOfFile(view, rel);
    if (layer === null || !app.has(layer) || isControllerFile(sf, rel)) continue;
    for (const cls of namedClasses(sf)) {
      const name = cls.getName() ?? '';
      if (DATA_NAME.test(name)) continue;
      const injected = cls.getConstructors().some((c) => c.getParameters().length > 0);
      if (injected || SERVICE_NAME.test(name)) out.push({ file: rel, cls });
    }
  }
  return out;
}

/** Constructor parameter properties of a class (`private readonly repo: Repository<E>`). */
export function injectedFields(cls: ClassDeclaration): ParameterDeclaration[] {
  return cls.getConstructors().flatMap((c) => c.getParameters().filter((p) => p.isParameterProperty() && Node.isIdentifier(p.getNameNode())));
}

/** Public, non-static methods with a body and no overloads (constructors and accessors are not methods here). */
export function publicMethods(cls: ClassDeclaration): MethodDeclaration[] {
  return cls
    .getMethods()
    .filter((m) => !m.isStatic() && m.getBody() !== undefined && m.getOverloads().length === 0 && m.getScope() !== Scope.Private && m.getScope() !== Scope.Protected)
    .filter((m) => Node.isIdentifier(m.getNameNode()));
}

/** Instance methods with a body (any visibility). */
export function bodyMethods(cls: ClassDeclaration): MethodDeclaration[] {
  return cls.getMethods().filter((m) => !m.isStatic() && m.getBody() !== undefined && Node.isIdentifier(m.getNameNode()));
}

/** `this.<field>` accesses inside `method`, document order. */
export function thisAccesses(method: MethodDeclaration, field: string): Node[] {
  return method
    .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .filter((a) => a.getName() === field && a.getExpression().getKind() === SyntaxKind.ThisKeyword);
}

/** True when `node` sits in a nested non-arrow function or class inside `method` (where `this` changes). */
export function inNestedThisScope(node: Node, method: MethodDeclaration): boolean {
  for (let p = node.getParent(); p !== undefined && p !== method; p = p.getParent()) {
    if (Node.isFunctionExpression(p) || Node.isFunctionDeclaration(p) || Node.isClassDeclaration(p) || Node.isClassExpression(p) || Node.isMethodDeclaration(p)) return true;
  }
  return false;
}

/** Names bound by any declaration inside `method` (parameters and locals). */
export function boundNames(method: MethodDeclaration): Set<string> {
  const out = new Set<string>(method.getParameters().map((p) => p.getName()));
  for (const d of method.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) for (const id of d.getNameNode().getDescendantsOfKind(SyntaxKind.Identifier)) out.add(id.getText());
  for (const id of method.getDescendantsOfKind(SyntaxKind.VariableDeclaration).map((d) => d.getNameNode()).filter(Node.isIdentifier)) out.add(id.getText());
  for (const p of method.getDescendantsOfKind(SyntaxKind.Parameter)) out.add(p.getName());
  return out;
}

/** `base`, else `base2`, `base3`, … not in `taken`. */
export function freshIn(taken: ReadonlySet<string>, base: string): string {
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}${String(i)}`)) return `${base}${String(i)}`;
}

/** Top-level bindings of a file: import bindings and declarations, by local name → module specifier ('' if local). */
export function fileBindings(sf: SourceFile): Map<string, string> {
  const out = new Map<string, string>();
  for (const imp of sf.getImportDeclarations()) {
    const mod = imp.getModuleSpecifierValue();
    const def = imp.getDefaultImport();
    if (def !== undefined) out.set(def.getText(), mod);
    const ns = imp.getNamespaceImport();
    if (ns !== undefined) out.set(ns.getText(), mod);
    for (const n of imp.getNamedImports()) out.set(n.getAliasNode()?.getText() ?? n.getName(), mod);
  }
  for (const s of sf.getStatements()) {
    if (Node.isClassDeclaration(s) || Node.isFunctionDeclaration(s) || Node.isInterfaceDeclaration(s) || Node.isTypeAliasDeclaration(s) || Node.isEnumDeclaration(s)) {
      const name = s.getName();
      if (name !== undefined) out.set(name, '');
    } else if (Node.isVariableStatement(s)) {
      for (const d of s.getDeclarations()) for (const id of d.getNameNode().getDescendantsOfKind(SyntaxKind.Identifier)) out.set(id.getText(), '');
      for (const d of s.getDeclarations()) if (Node.isIdentifier(d.getNameNode())) out.set(d.getName(), '');
    }
  }
  return out;
}

/** Local name under which `name` of `module` can be used in `sf`: existing binding, or `undefined` when taken. */
export function namedImportLocal(sf: SourceFile, module: string, name: string): { readonly local: string; readonly present: boolean } | undefined {
  for (const imp of sf.getImportDeclarations()) {
    if (imp.getModuleSpecifierValue() !== module || imp.isTypeOnly()) continue;
    const hit = imp.getNamedImports().find((n) => n.getName() === name && !n.isTypeOnly());
    if (hit !== undefined) return { local: hit.getAliasNode()?.getText() ?? name, present: true };
  }
  return fileBindings(sf).has(name) ? undefined : { local: name, present: false };
}

/** Index of the statement after the last import declaration. */
function afterImports(sf: SourceFile): number {
  let index = 0;
  sf.getStatements().forEach((s, i) => {
    if (Node.isImportDeclaration(s)) index = i + 1;
  });
  return index;
}

/**
 * Makes `name` of `module` usable in `sf` (merging into an existing value import of the module, else a new import
 * declaration after the existing ones) and returns the local name and the 1-based line of the import; `undefined`
 * when another binding already holds the name.
 */
export function ensureNamedImport(sf: SourceFile, module: string, name: string, alias?: string): { readonly local: string; readonly line: number } | undefined {
  useFileStyle(sf);
  const found = alias === undefined ? namedImportLocal(sf, module, name) : fileBindings(sf).has(alias) ? undefined : { local: alias, present: false };
  if (found === undefined) return undefined;
  const existing = sf.getImportDeclarations().find((i) => i.getModuleSpecifierValue() === module && !i.isTypeOnly() && i.getNamespaceImport() === undefined);
  if (found.present && existing !== undefined) return { local: found.local, line: existing.getStartLineNumber() };
  const spec = alias === undefined ? name : { name, alias };
  if (existing !== undefined) {
    existing.addNamedImport(spec);
    return { local: found.local, line: existing.getStartLineNumber() };
  }
  const decl = sf.insertImportDeclaration(afterImports(sf), { moduleSpecifier: module, namedImports: [spec] });
  return { local: found.local, line: decl.getStartLineNumber() };
}

/** Dependency names of the nearest `package.json` files from `root` up (at most four levels; monorepo sub-paths). */
export function declaredDependencies(root: string): Set<string> {
  const out = new Set<string>();
  let dir = root;
  for (let i = 0; i < 4; i++) {
    const file = path.join(dir, 'package.json');
    if (fs.existsSync(file)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
        for (const k of ['dependencies', 'devDependencies', 'peerDependencies']) {
          const deps = pkg[k];
          if (deps !== null && typeof deps === 'object') for (const name of Object.keys(deps)) out.add(name);
        }
      } catch {
        // An unreadable package.json declares nothing.
      }
    }
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return out;
}

/**
 * Does the project use `pkg`: a project file imports it (or a sub-path), `compilerOptions.paths` maps it, or a
 * `package.json` at or above the root declares one of `declared` (default: the package itself)?
 */
export function projectUsesPackage(handle: ProjectHandle, pkg: string, declared: readonly string[] = [pkg]): boolean {
  const paths = handle.project.getCompilerOptions().paths ?? {};
  if (Object.keys(paths).some((k) => k === pkg || k === `${pkg}/*`)) return true;
  const deps = declaredDependencies(handle.root);
  if (declared.some((d) => deps.has(d))) return true;
  return projectFiles(handle).some((sf) => sf.getImportDeclarations().some((i) => {
    const m = i.getModuleSpecifierValue();
    return m === pkg || m.startsWith(`${pkg}/`);
  }));
}

/**
 * A name a moved or copied rule needs in its new file: a named import of a bare package (`BadRequestException` of
 * `@nestjs/common`), or an exported declaration of a project file (`RoleEnum` of `src/roles/roles.enum.ts`, also the
 * rule's own file when it exports the name).
 */
export interface RuleImport {
  /** Bare package specifier; '' for a project file. */
  readonly module: string;
  /** Absolute path of the declaring project file; '' for a package. */
  readonly fileAbs: string;
  readonly name: string;
  /** Local name in the rule's own file. */
  readonly local: string;
  /** Used with `new` (stub form `named-class`). */
  readonly constructed: boolean;
}

export interface ParamRule {
  readonly statement: IfStatement;
  /** Position among the method body's top-level statements. */
  readonly index: number;
  /** Referenced parameters, declaration order. */
  readonly params: readonly ParameterDeclaration[];
  readonly imports: readonly RuleImport[];
}

function isExportedDecl(d: Node): boolean {
  if (Node.isVariableDeclaration(d)) return d.getVariableStatement()?.isExported() === true;
  if (Node.isEnumDeclaration(d) || Node.isFunctionDeclaration(d) || Node.isClassDeclaration(d) || Node.isInterfaceDeclaration(d) || Node.isTypeAliasDeclaration(d)) {
    return d.isExported() && !d.isDefaultExport();
  }
  return false;
}

/**
 * How a referenced identifier can be reproduced in another file: `'global'` (default library), a `RuleImport`, or
 * `undefined` (a local, a default or namespace import, a non-exported declaration, a declaration-file project name).
 */
export function importableName(id: Node, sf: SourceFile): RuleImport | 'global' | undefined {
  const decls = id.getSymbol()?.getDeclarations() ?? [];
  const first = decls[0];
  if (first === undefined) return id.getText() === 'undefined' ? 'global' : undefined;
  const local = id.getText();
  const parent = id.getParent();
  const constructed = Node.isNewExpression(parent) && parent.getExpression() === id;
  if (Node.isImportSpecifier(first) && first.getSourceFile() === sf) {
    const decl = first.getImportDeclaration();
    if (first.isTypeOnly() || decl.isTypeOnly()) return undefined;
    const module = decl.getModuleSpecifierValue();
    if (isBareSpecifier(module)) return { module, fileAbs: '', name: first.getName(), local, constructed };
    const target = decl.getModuleSpecifierSourceFile();
    if (target === undefined || target.isDeclarationFile()) return undefined;
    return { module: '', fileAbs: target.getFilePath(), name: first.getName(), local, constructed };
  }
  if (first.getSourceFile() === sf) {
    return isExportedDecl(first) ? { module: '', fileAbs: sf.getFilePath(), name: local, local, constructed } : undefined;
  }
  if (decls.every((d) => d.getSourceFile().isDeclarationFile() && !Node.isImportSpecifier(d))) return 'global';
  return undefined;
}

/** Is the identifier a name position (property name, member name), not a reference? */
function isNamePosition(id: Node): boolean {
  const p = id.getParent();
  if (p === undefined) return false;
  if (Node.isPropertyAccessExpression(p) && p.getNameNode() === id) return true;
  if (Node.isPropertyAssignment(p) && p.getNameNode() === id) return true;
  if (Node.isQualifiedName(p) && p.getRight() === id) return true;
  return false;
}

function throwOnly(stmt: IfStatement): boolean {
  if (stmt.getElseStatement() !== undefined) return false;
  const then = stmt.getThenStatement();
  const body = Node.isBlock(then) ? then.getStatements() : [then];
  return body.length === 1 && body[0] !== undefined && Node.isThrowStatement(body[0]);
}

/** One parameter rule, or undefined when the statement is not one (see the module comment). */
export function paramRuleOf(method: MethodDeclaration, stmt: IfStatement, index: number): ParamRule | undefined {
  if (!throwOnly(stmt)) return undefined;
  if (stmt.getDescendantsOfKind(SyntaxKind.ThisKeyword).length > 0) return undefined;
  if (stmt.getDescendantsOfKind(SyntaxKind.AwaitExpression).length > 0 || stmt.getDescendantsOfKind(SyntaxKind.YieldExpression).length > 0) return undefined;
  if (stmt.getDescendantsOfKind(SyntaxKind.ArrowFunction).length > 0 || stmt.getDescendantsOfKind(SyntaxKind.FunctionExpression).length > 0) return undefined;
  const own = new Set(method.getParameters());
  const params = new Set<ParameterDeclaration>();
  const imports = new Map<string, RuleImport>();
  const sf = method.getSourceFile();
  for (const id of stmt.getDescendantsOfKind(SyntaxKind.Identifier)) {
    if (isNamePosition(id)) continue;
    const first = id.getSymbol()?.getDeclarations()[0];
    if (first !== undefined && Node.isParameterDeclaration(first) && own.has(first)) {
      if (!Node.isIdentifier(first.getNameNode()) || first.isRestParameter()) return undefined;
      params.add(first);
      continue;
    }
    const how = importableName(id, sf);
    if (how === undefined) return undefined;
    if (how === 'global') continue;
    const prev = imports.get(how.local);
    imports.set(how.local, { ...how, constructed: how.constructed || (prev?.constructed ?? false) });
  }
  if (params.size === 0) return undefined;
  const ordered = method.getParameters().filter((p) => params.has(p));
  return { statement: stmt, index, params: ordered, imports: [...imports.values()].sort((a, b) => cmp(a.local, b.local)) };
}

/** Every parameter rule among a method's top-level statements, body order. */
export function paramRules(method: MethodDeclaration): ParamRule[] {
  const out: ParamRule[] = [];
  (method.getStatements()).forEach((s, i) => {
    if (!Node.isIfStatement(s)) return;
    const r = paramRuleOf(method, s, i);
    if (r !== undefined) out.push(r);
  });
  return out;
}

/** The rule at a site's `(class, method, guard index)`. */
export function paramRuleAt(sf: SourceFile | undefined, cls: string, method: string, index: number): { readonly method: MethodDeclaration; readonly rule: ParamRule } | undefined {
  const m = sf?.getClass(cls)?.getMethod(method);
  if (m === undefined) return undefined;
  const s = m.getStatements()[index];
  if (s === undefined || !Node.isIfStatement(s)) return undefined;
  const rule = paramRuleOf(m, s, index);
  return rule === undefined ? undefined : { method: m, rule };
}

/**
 * Text of a statement with each referenced parameter replaced by `map(name)` (a shorthand property `{ q }` becomes
 * `{ q: <value> }`) and each rule import replaced by `locals(local)`; names absent from both maps are kept.
 */
export function substituteText(stmt: Node, map: ReadonlyMap<string, string>, locals: ReadonlyMap<string, string> = new Map()): string {
  const start = stmt.getStart();
  const text = stmt.getText();
  const edits: { from: number; to: number; text: string }[] = [];
  for (const sh of stmt.getDescendantsOfKind(SyntaxKind.ShorthandPropertyAssignment)) {
    const v = map.get(sh.getName());
    if (v !== undefined && v !== sh.getName()) edits.push({ from: sh.getStart() - start, to: sh.getEnd() - start, text: `${sh.getName()}: ${v}` });
  }
  for (const id of stmt.getDescendantsOfKind(SyntaxKind.Identifier)) {
    if (isNamePosition(id) || Node.isShorthandPropertyAssignment(id.getParent())) continue;
    const v = map.get(id.getText()) ?? locals.get(id.getText());
    if (v !== undefined && v !== id.getText()) edits.push({ from: id.getStart() - start, to: id.getEnd() - start, text: v });
  }
  let out = text;
  for (const e of edits.sort((a, b) => b.from - a.from)) out = out.slice(0, e.from) + e.text + out.slice(e.to);
  return out;
}

/** A side-effect-free argument text that can stand for a parameter in a copied rule. */
export function isPureArgument(arg: Node): boolean {
  if (Node.isIdentifier(arg) || Node.isThisExpression(arg)) return true;
  if (Node.isStringLiteral(arg) || Node.isNumericLiteral(arg) || Node.isNoSubstitutionTemplateLiteral(arg)) return true;
  if (arg.getKind() === SyntaxKind.TrueKeyword || arg.getKind() === SyntaxKind.FalseKeyword || arg.getKind() === SyntaxKind.NullKeyword) return true;
  if (Node.isPropertyAccessExpression(arg)) return !arg.hasQuestionDotToken() && isPureArgument(arg.getExpression());
  return false;
}

/**
 * Names a parameter's type needs in another file (keywords, literals and default-library types need none), or
 * `undefined` when the type cannot be written there (no annotation, a local or non-exported type).
 */
export function typeImports(p: ParameterDeclaration): RuleImport[] | undefined {
  const node = p.getTypeNode();
  if (node === undefined) return undefined;
  const out: RuleImport[] = [];
  for (const ref of [node, ...node.getDescendants()].filter((n) => Node.isTypeReference(n))) {
    let name: Node = ref.getTypeName();
    while (Node.isQualifiedName(name)) name = name.getLeft();
    const how = importableName(name, p.getSourceFile());
    if (how === undefined) return undefined;
    if (how !== 'global') out.push(how);
  }
  return out;
}

/** `module|file name new|plain` entries joined by `;` (site detail; paths relative to the copy root). */
export function encodeImports(imports: readonly RuleImport[], rel: (abs: string) => string): string | undefined {
  const parts: string[] = [];
  for (const i of imports) {
    const target = i.module.length > 0 ? i.module : rel(i.fileAbs);
    if (/[\s;]/.test(target) || /[\s;]/.test(i.name)) return undefined;
    parts.push(`${i.module.length > 0 ? 'pkg' : 'file'} ${target} ${i.name} ${i.constructed ? 'new' : 'plain'}`);
  }
  return [...new Set(parts)].sort(cmp).join(';');
}

export interface EncodedImport {
  readonly kind: 'pkg' | 'file';
  /** Package specifier or copy-relative file path. */
  readonly target: string;
  readonly name: string;
  readonly constructed: boolean;
}

export function decodeImports(text: string | undefined): EncodedImport[] {
  return (text ?? '')
    .split(';')
    .filter((x) => x.length > 0)
    .map((x) => {
      const [kind = '', target = '', name = '', how = ''] = x.split(' ');
      return { kind: kind === 'file' ? ('file' as const) : ('pkg' as const), target, name, constructed: how === 'new' };
    });
}

/** Package imports of an encoded list, as planned import uses of `fromFile` (stub provisioning, BR-U5a-10). */
export function plannedPackageUses(text: string | undefined, fromFile: string): PlannedImportUse[] {
  return decodeImports(text)
    .filter((i) => i.kind === 'pkg')
    .map((i) => ({ specifier: i.target, fromFile, form: i.constructed ? ('named-class' as const) : ('named' as const), name: i.name }));
}

/** File→File edges an encoded list adds from `fromFile` (cycle cap). */
export function plannedFileEdges(text: string | undefined, fromFile: string): { source: string; target: string }[] {
  return [...new Set(decodeImports(text).filter((i) => i.kind === 'file' && i.target !== fromFile).map((i) => i.target))].map((target) => ({ source: fromFile, target }));
}

/** Can every encoded name be bound in `sf` (free, or already imported from the same place)? */
export function importsFree(handle: ProjectHandle, sf: SourceFile, text: string | undefined): boolean {
  const own = relOf(handle, sf);
  return decodeImports(text).every((i) => {
    if (i.kind === 'file' && i.target === own) return true;
    const from = i.kind === 'pkg' ? i.target : specifierOf(handle, sf, i.target);
    return from !== undefined && namedImportLocal(sf, from, i.name) !== undefined;
  });
}

function specifierOf(handle: ProjectHandle, sf: SourceFile, rel: string): string | undefined {
  const target = handle.project.getSourceFile(path.join(handle.root, rel));
  return target === undefined ? undefined : sf.getRelativePathAsModuleSpecifierTo(target);
}

/**
 * Adds the encoded names to `sf` and returns the map from each name to its local name in `sf`; `undefined` when one is
 * taken. Names of `sf` itself need no import.
 */
export function bindImports(handle: ProjectHandle, sf: SourceFile, text: string | undefined): Map<string, string> | undefined {
  const own = relOf(handle, sf);
  const locals = new Map<string, string>();
  for (const i of decodeImports(text)) {
    if (i.kind === 'file' && i.target === own) {
      locals.set(i.name, i.name);
      continue;
    }
    const from = i.kind === 'pkg' ? i.target : specifierOf(handle, sf, i.target);
    const imp = from === undefined ? undefined : ensureNamedImport(sf, from, i.name);
    if (imp === undefined) return undefined;
    locals.set(i.name, imp.local);
  }
  return locals;
}

/** Map from each rule-local name to the imported name (`substituteText` then renames through `bindImports`). */
export function localToImported(imports: readonly RuleImport[]): Map<string, string> {
  return new Map(imports.map((i) => [i.local, i.name]));
}
