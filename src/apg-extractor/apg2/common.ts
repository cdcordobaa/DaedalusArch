import { Node, SyntaxKind } from 'ts-morph';
import type { Expression, SourceFile } from 'ts-morph';
import type { APGEdge, APGNode } from '../../shared/types/apg.js';
import type { Apg2EdgeType, Apg2NodeType } from '../../shared/types/enums.js';
import type { NodeLookup } from '../types.js';
import { generateEdgeId, generateNodeId, normalizeFilePath } from '../id-generator.js';

/** Shared helpers of the APG v2 passes (`Docs/v1.3/apg2-design.md`). */

export function apg2Node(type: Apg2NodeType, filePath: string, name: string, properties: Record<string, unknown>): APGNode {
  return { id: generateNodeId(type, filePath, name), type, filePath, name, decorators: [], properties };
}

export function apg2Edge(type: Apg2EdgeType, sourceId: string, targetId: string, properties: Record<string, unknown>): APGEdge {
  return { id: generateEdgeId(type, sourceId, targetId), type, sourceId, targetId, properties };
}

/** The project-relative path of a node's source file. */
export function relPath(node: Node, projectRoot: string): string {
  return normalizeFilePath(node.getSourceFile().getFilePath(), projectRoot);
}

/** 1-based line of a node. */
export function lineOf(node: Node): number {
  return node.getStartLineNumber();
}

/**
 * The APG node that owns a piece of code: the nearest enclosing class Method, top-level Function (declaration, or an
 * exported typed arrow function, the two kinds the extractor makes Function nodes of), then the enclosing Class
 * (constructors, field initialisers, accessors), else the File. Nested functions and arrow functions are attributed to
 * the member that contains them.
 */
export function ownerNodeId(node: Node, lookup: NodeLookup, filePath: string): string | undefined {
  for (let cur: Node | undefined = node; cur !== undefined; cur = cur.getParent()) {
    if (Node.isMethodDeclaration(cur)) {
      const cls = cur.getParentIfKind(SyntaxKind.ClassDeclaration);
      if (cls !== undefined) {
        const id = lookup.methodNodes.get(`${`${cls.getName() ?? '<anonymous>'}.${cur.getName()}`.toLowerCase()}@${filePath}`);
        if (id !== undefined) return id;
      }
    } else if (Node.isFunctionDeclaration(cur) && Node.isSourceFile(cur.getParent())) {
      const name = cur.getName();
      const id = name !== undefined ? lookup.functionNodes.get(`${name.toLowerCase()}@${filePath}`) : undefined;
      if (id !== undefined) return id;
    } else if (Node.isVariableDeclaration(cur) && Node.isArrowFunction(cur.getInitializer())) {
      const id = lookup.functionNodes.get(`${cur.getName().toLowerCase()}@${filePath}`);
      if (id !== undefined) return id;
    } else if (Node.isClassDeclaration(cur)) {
      const id = lookup.typeNodes.get(`${(cur.getName() ?? '<anonymous>').toLowerCase()}@${filePath}`);
      if (id !== undefined) return id;
    }
  }
  return lookup.fileNodes.get(filePath);
}

/** `node:fs` → `fs`; `@types/node` → `node`. A deep path keeps its subpath (`fs/promises`). */
export function normalizePackage(specifier: string): string {
  let s = specifier.startsWith('node:') ? specifier.slice(5) : specifier;
  if (s.startsWith('@types/')) s = s.slice(7);
  return s;
}

/** The package root of a specifier: `@scope/name/x` → `@scope/name`; `fs/promises` → `fs`. */
export function packageRoot(specifier: string): string {
  const s = normalizePackage(specifier);
  const parts = s.split('/');
  return s.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? s);
}

/** The package a declaration file belongs to, from its `node_modules/` path; undefined for project and lib files. */
export function packageOfFile(sf: SourceFile): string | undefined {
  const p = sf.getFilePath();
  const i = p.lastIndexOf('/node_modules/');
  if (i < 0) return undefined;
  const [first = '', second = ''] = p.slice(i + '/node_modules/'.length).split('/');
  const name = first.startsWith('@') ? `${first}/${second}` : first;
  return normalizePackage(name);
}

/** True when a symbol's declarations all live outside the project sources (TypeScript lib files or node_modules). */
export function isAmbientGlobal(node: Node): boolean {
  const symbol = node.getSymbol();
  if (symbol === undefined) return true; // unresolved global: treat as the global
  const decls = symbol.getDeclarations();
  if (decls.length === 0) return true;
  return decls.every((d) => {
    const p = d.getSourceFile().getFilePath();
    return p.includes('/node_modules/') || /\/lib\.[^/]*\.d\.ts$/.test(p);
  });
}

export interface Origin {
  /** The module specifier the value comes from, normalised (`node:` prefix removed). */
  readonly pkg: string;
  /** The imported name (or the type / class name the value is an instance of). */
  readonly name: string;
}

/** Leftmost value of an access chain; `this.x` stops at `this.x` (the member is the value of interest). */
export function chainRoot(expr: Node): Node {
  let cur: Node = expr;
  for (;;) {
    if (Node.isPropertyAccessExpression(cur) || Node.isElementAccessExpression(cur)) {
      const inner = cur.getExpression();
      if (inner.getKind() === SyntaxKind.ThisKeyword) return cur;
      cur = inner;
    } else if (Node.isCallExpression(cur) || Node.isNonNullExpression(cur) || Node.isParenthesizedExpression(cur)
      || Node.isAwaitExpression(cur) || Node.isAsExpression(cur)) {
      cur = cur.getExpression();
    } else if (Node.isNewExpression(cur)) {
      cur = cur.getExpression();
    } else {
      return cur;
    }
  }
}

function originOfImportDecl(decl: Node, name: string): Origin | undefined {
  const imp = decl.getFirstAncestorByKind(SyntaxKind.ImportDeclaration);
  if (imp !== undefined) return { pkg: normalizePackage(imp.getModuleSpecifierValue()), name };
  const eq = Node.isImportEqualsDeclaration(decl) ? decl : decl.getFirstAncestorByKind(SyntaxKind.ImportEqualsDeclaration);
  if (eq !== undefined) {
    const ref = eq.getModuleReference();
    if (Node.isExternalModuleReference(ref)) {
      const e = ref.getExpression();
      if (e !== undefined && Node.isStringLiteral(e)) return { pkg: normalizePackage(e.getLiteralValue()), name };
    }
  }
  return undefined;
}

/** Where a type reference name (`Repository<User>`) comes from. */
function originOfTypeNode(typeNode: Node | undefined, depth: number): Origin | undefined {
  if (typeNode === undefined) return undefined;
  if (Node.isTypeReference(typeNode)) {
    const nameNode = typeNode.getTypeName();
    const left = Node.isQualifiedName(nameNode) ? nameNode.getLeft() : nameNode;
    const o = originOfValue(left, depth + 1);
    if (o !== undefined) return { pkg: o.pkg, name: Node.isQualifiedName(nameNode) ? nameNode.getRight().getText() : o.name };
  }
  return undefined;
}

/** Origin through a declaration: an import, or a variable / property / parameter by its type annotation or initializer. */
function originOfDeclaration(decl: Node, depth: number): Origin | undefined {
  if (Node.isImportSpecifier(decl)) return originOfImportDecl(decl, decl.getName());
  if (Node.isImportClause(decl) || Node.isNamespaceImport(decl) || Node.isImportEqualsDeclaration(decl)) {
    return originOfImportDecl(decl, decl.getText().replace(/^\*\s+as\s+/, '').trim());
  }
  if (Node.isVariableDeclaration(decl) || Node.isPropertyDeclaration(decl) || Node.isParameterDeclaration(decl)) {
    const t = originOfTypeNode(decl.getTypeNode(), depth);
    if (t !== undefined) return t;
    const init = decl.getInitializer();
    if (init !== undefined) return originOfValue(init, depth + 1);
  }
  return undefined;
}

/**
 * The package a value comes from, by declarations (not by its resolved type, so it works when the package's types
 * are not installed): an imported binding; a variable, field or (constructor) parameter whose annotation names an
 * imported type, or whose initializer is a `new`, call or access on such a value (`new PrismaClient()`,
 * `kafka.producer()`, `await amqp.connect()`). When the declaration route finds nothing, the resolved type's
 * declaring package is used (`node_modules/<pkg>/…`). Undefined for project values. Depth-bounded.
 */
export function originOfValue(expr: Node, depth = 0): Origin | undefined {
  if (depth > 6) return undefined;
  const root = chainRoot(expr);
  let target: Node | undefined;
  if (Node.isIdentifier(root)) target = root;
  else if (Node.isPropertyAccessExpression(root)) target = root.getNameNode();
  if (target !== undefined) {
    const symbol = target.getSymbol();
    const decls = symbol?.getDeclarations() ?? [];
    for (const d of decls) {
      if (d.getSourceFile() !== expr.getSourceFile() && d.getSourceFile().getFilePath().includes('/node_modules/')) {
        const pkg = packageOfFile(d.getSourceFile());
        if (pkg !== undefined) return { pkg, name: target.getText() };
      }
      const o = originOfDeclaration(d, depth);
      if (o !== undefined) return o;
    }
  }
  try {
    const t = (root as Expression).getType();
    const sym = t.getSymbol() ?? t.getAliasSymbol();
    const d = sym?.getDeclarations()[0];
    if (sym !== undefined && d !== undefined) {
      const pkg = packageOfFile(d.getSourceFile());
      if (pkg !== undefined) return { pkg, name: sym.getName() };
    }
  } catch {
    // lenient: no type
  }
  return undefined;
}

/** The string value of a string literal or no-substitution template; undefined for anything computed. */
export function literalString(node: Node | undefined): string | undefined {
  if (node === undefined) return undefined;
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) return node.getLiteralValue();
  return undefined;
}
