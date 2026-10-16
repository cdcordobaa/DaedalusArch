/**
 * Batch 2, shared: the resolved unit-level call graph used by error flow, reachability and test topology.
 *
 * A UNIT is a body that runs: a class method or accessor (APG Method node `Class.method` when the APG has it), a class
 * constructor together with its field initialisers, an arrow-function class property, a top-level function (APG
 * Function node), or the top-level statements of a file (`file:` unit, the module body). A unit's edges come from its
 * body, nested callbacks included (they run on its behalf):
 *
 * - `call`: a call whose callee resolves (type checker, aliases followed) to a unit. A call on an interface method
 *   resolves to the method of every class that implements the interface: by an `implements` clause (direct or through
 *   a base class), or, when no class declares it, structurally (a class that has a method of every name the interface
 *   declares). A call on a class method also resolves to the overrides in its subclasses. These are the "CALLS through
 *   interfaces to their implementations" the APG CALLS edge does not have (it targets class MethodDeclarations only).
 * - `new`: a `new C()` of a project class: the constructor unit of C.
 * - `ref`: a method or function used as a value (`app.get('/', handler)`, `this.m.bind(this)`), treated as reached;
 *   and every other project declaration an identifier resolves to (`refDecls`, used for module reachability).
 *
 * Every edge records whether the site lies inside the `try` block of a `try … catch` of the same unit (`inTry`), for
 * exception propagation. Resolution is per site; computed once per context.
 */
import { Node, SyntaxKind } from 'ts-morph';
import type { ClassDeclaration, InterfaceDeclaration, SourceFile } from 'ts-morph';
import type { CheapContext } from './context.js';
import { classesOf } from './context.js';
import { resolvedDeclaration } from './behaviour.js';
import type { Evidence } from './types.js';

export type UnitKind = 'method' | 'constructor' | 'property-function' | 'function' | 'module';

export interface CgUnit {
  /** The APG node id (Method / Function), else a namespaced synthetic id (`unit:<file>#<name>`). */
  readonly id: string;
  readonly apgId: string | undefined;
  readonly kind: UnitKind;
  readonly file: string;
  readonly className: string | undefined;
  /** Method, function or `constructor` name; `<module>` for a file unit. */
  readonly name: string;
  /** The nodes whose descendants are the unit's code (a body, field initialisers, top-level statements). */
  readonly scopes: readonly Node[];
  readonly decl: Node;
  readonly evidence: Evidence;
}

export interface CgEdge {
  readonly kind: 'call' | 'new' | 'ref';
  readonly target: string;
  readonly line: number;
  /** The site lies in the try block of a try … catch of the same unit. */
  readonly inTry: boolean;
  /** The callee resolved through an interface method signature (to an implementation). */
  readonly viaInterface: string | undefined;
}

export interface CallGraph {
  readonly units: ReadonlyMap<string, CgUnit>;
  readonly out: ReadonlyMap<string, readonly CgEdge[]>;
  /** Project declarations (any kind) an identifier of the unit resolves to: `file|name` keys. */
  readonly refDecls: ReadonlyMap<string, ReadonlySet<string>>;
  /** The unit a declaration node belongs to (method, constructor, function), for callers that resolve on their own. */
  unitOfDeclaration(decl: Node): string | undefined;
  /** Resolve the units a callee expression or a `new` target denotes. */
  resolve(expr: Node, isNew: boolean): { readonly targets: readonly string[]; readonly viaInterface: string | undefined };
  /** The innermost unit containing a node, if any. */
  unitAt(node: Node): string | undefined;
}

const CACHE = new WeakMap<CheapContext, CallGraph>();

const isFunctionLike = (n: Node | undefined): boolean => n !== undefined && (Node.isArrowFunction(n) || Node.isFunctionExpression(n));

/** The top-level statements of a file that run at load time (not declarations of functions, classes or types). */
export function moduleStatements(sf: SourceFile): Node[] {
  const out: Node[] = [];
  for (const st of sf.getStatements()) {
    if (Node.isFunctionDeclaration(st) || Node.isClassDeclaration(st) || Node.isInterfaceDeclaration(st) || Node.isTypeAliasDeclaration(st) || Node.isImportDeclaration(st) || Node.isModuleDeclaration(st)) continue;
    if (Node.isExportDeclaration(st) || Node.isEnumDeclaration(st)) continue;
    if (Node.isVariableStatement(st)) {
      for (const d of st.getDeclarations()) {
        const init = d.getInitializer();
        if (init !== undefined && !isFunctionLike(init)) out.push(init);
      }
      continue;
    }
    out.push(st);
  }
  return out;
}

/** Node identity across ts-morph's wrapper types (their static types need not overlap). */
export function same(a: Node, b: Node): boolean {
  return a === b;
}

function isCalleeOf(n: Node): boolean {
  const p = n.getParent();
  return p !== undefined && Node.isCallExpression(p) && same(p.getExpression(), n);
}

/** The declaration key `file|name` used by `refDecls`. */
export function declKey(file: string, name: string): string {
  return `${file}|${name}`;
}

export function callGraph(ctx: CheapContext): CallGraph {
  const hit = CACHE.get(ctx);
  if (hit !== undefined) return hit;
  const units = new Map<string, CgUnit>();
  const byDecl = new Map<Node, string>();
  const classByName = new Map<string, { file: string; cls: ClassDeclaration }[]>();
  const projectFiles = new Set(ctx.sources.map((s) => s.file));

  const addUnit = (u: CgUnit, ...decls: Node[]): void => {
    units.set(u.id, u);
    for (const d of decls) byDecl.set(d, u.id);
  };
  for (const { file, sf } of ctx.sources) {
    for (const cls of classesOf(sf)) {
      const cn = cls.getName() ?? '<anonymous>';
      classByName.set(cn, [...(classByName.get(cn) ?? []), { file, cls }]);
      for (const m of [...cls.getMethods(), ...cls.getGetAccessors(), ...cls.getSetAccessors()]) {
        const body = m.getBody();
        const apgId = Node.isMethodDeclaration(m) ? ctx.nodeId('Method', file, `${cn}.${m.getName()}`) : undefined;
        const id = apgId ?? `unit:${file}#${cn}.${m.getName()}${Node.isMethodDeclaration(m) ? '' : `:${Node.isGetAccessorDeclaration(m) ? 'get' : 'set'}`}`;
        if (units.has(id)) continue; // overload signatures share the implementation
        addUnit({ id, apgId, kind: 'method', file, className: cn, name: m.getName(), scopes: body === undefined ? [] : [body], decl: m, evidence: ctx.evidence(m) }, m);
      }
      const ctor = cls.getConstructors().find((c) => c.getBody() !== undefined) ?? cls.getConstructors()[0];
      const inits = cls.getProperties().filter((p) => !p.isStatic()).map((p) => p.getInitializer()).filter((i) => i !== undefined && !isFunctionLike(i)) as Node[];
      const ctorId = `unit:${file}#${cn}.constructor`;
      addUnit({ id: ctorId, apgId: undefined, kind: 'constructor', file, className: cn, name: 'constructor', scopes: [...(ctor?.getBody() !== undefined ? [ctor.getBodyOrThrow()] : []), ...inits, ...(ctor?.getParameters() ?? [])] as Node[], decl: ctor ?? cls, evidence: ctx.evidence(ctor ?? cls) }, ...(ctor !== undefined ? [ctor] : []));
      for (const p of cls.getProperties()) {
        const init = p.getInitializer();
        if (!isFunctionLike(init) || init === undefined) continue;
        const id = `unit:${file}#${cn}.${p.getName()}`;
        addUnit({ id, apgId: undefined, kind: 'property-function', file, className: cn, name: p.getName(), scopes: [init], decl: p, evidence: ctx.evidence(p) }, p, init);
      }
    }
    for (const f of sf.getFunctions()) {
      const n = f.getName();
      if (n === undefined) continue;
      const apgId = ctx.nodeId('Function', file, n);
      const id = apgId ?? `unit:${file}#${n}`;
      if (units.has(id)) {
        byDecl.set(f, id);
        continue;
      }
      const body = f.getBody();
      addUnit({ id, apgId, kind: 'function', file, className: undefined, name: n, scopes: body === undefined ? [] : [body], decl: f, evidence: ctx.evidence(f) }, f);
    }
    for (const v of sf.getVariableDeclarations()) {
      const init = v.getInitializer();
      if (!isFunctionLike(init) || init === undefined) continue;
      const apgId = ctx.nodeId('Function', file, v.getName());
      const id = apgId ?? `unit:${file}#${v.getName()}`;
      addUnit({ id, apgId, kind: 'function', file, className: undefined, name: v.getName(), scopes: [init], decl: v, evidence: ctx.evidence(v) }, v, init);
    }
    const mod = moduleStatements(sf);
    addUnit({ id: `file:${file}`, apgId: undefined, kind: 'module', file, className: undefined, name: '<module>', scopes: mod, decl: sf, evidence: { file, startLine: 1, endLine: sf.getEndLineNumber() } });
  }

  // Implementations of interfaces: by `implements` (direct or inherited), else structurally.
  const implsCache = new Map<InterfaceDeclaration, ClassDeclaration[]>();
  const allClasses = [...classByName.values()].flat();
  const implementsIface = (cls: ClassDeclaration, iface: InterfaceDeclaration): boolean => {
    for (let c: ClassDeclaration | undefined = cls, depth = 0; c !== undefined && depth < 6; c = c.getBaseClass(), depth++) {
      for (const h of c.getImplements()) {
        const d = resolvedDeclaration(h.getExpression());
        if (d === iface) return true;
        if (d !== undefined && Node.isInterfaceDeclaration(d) && d.getExtends().some((e) => resolvedDeclaration(e.getExpression()) === iface)) return true;
      }
    }
    return false;
  };
  const implementationsOf = (iface: InterfaceDeclaration): ClassDeclaration[] => {
    const cached = implsCache.get(iface);
    if (cached !== undefined) return cached;
    let out = allClasses.filter((c) => implementsIface(c.cls, iface)).map((c) => c.cls);
    if (out.length === 0) {
      const names = iface.getMethods().map((m) => m.getName());
      if (names.length > 0) out = allClasses.filter((c) => names.every((n) => c.cls.getInstanceMethod(n) !== undefined)).map((c) => c.cls);
    }
    implsCache.set(iface, out);
    return out;
  };
  const subclassesOf = (cls: ClassDeclaration): ClassDeclaration[] => allClasses.filter((c) => {
    for (let b = c.cls.getBaseClass(), depth = 0; b !== undefined && depth < 6; b = b.getBaseClass(), depth++) if (b === cls) return true;
    return false;
  }).map((c) => c.cls);
  const methodUnit = (cls: ClassDeclaration, name: string): string | undefined => {
    for (let c: ClassDeclaration | undefined = cls, depth = 0; c !== undefined && depth < 6; c = c.getBaseClass(), depth++) {
      const m = c.getInstanceMethod(name) ?? c.getStaticMethod(name);
      if (m !== undefined) return byDecl.get(m);
      const p = c.getProperty(name);
      if (p !== undefined && byDecl.has(p)) return byDecl.get(p);
    }
    return undefined;
  };
  const ctorUnit = (cls: ClassDeclaration): string | undefined => {
    const file = ctx.rel(cls.getSourceFile());
    return units.has(`unit:${file}#${cls.getName() ?? ''}.constructor`) ? `unit:${file}#${cls.getName() ?? ''}.constructor` : undefined;
  };

  const resolve = (expr: Node, isNew: boolean): { targets: string[]; viaInterface: string | undefined } => {
    let decl: Node | undefined;
    try {
      decl = resolvedDeclaration(expr);
    } catch {
      decl = undefined;
    }
    if (decl === undefined || !projectFiles.has(ctx.rel(decl.getSourceFile()))) return { targets: [], viaInterface: undefined };
    if (isNew) {
      if (Node.isClassDeclaration(decl)) {
        const t = ctorUnit(decl);
        return { targets: t === undefined ? [] : [t], viaInterface: undefined };
      }
      return { targets: [], viaInterface: undefined };
    }
    if (Node.isMethodSignature(decl) || Node.isPropertySignature(decl)) {
      const iface = decl.getParentIfKind(SyntaxKind.InterfaceDeclaration);
      if (iface === undefined) return { targets: [], viaInterface: undefined };
      const name = Node.isMethodSignature(decl) ? decl.getName() : decl.getName();
      const targets = implementationsOf(iface).map((c) => methodUnit(c, name)).filter((x): x is string => x !== undefined);
      return { targets: [...new Set(targets)], viaInterface: `${ctx.rel(iface.getSourceFile())}|${iface.getName()}` };
    }
    const own = byDecl.get(decl);
    if (Node.isMethodDeclaration(decl)) {
      const cls = decl.getParentIfKind(SyntaxKind.ClassDeclaration);
      const targets = own === undefined ? [] : [own];
      if (cls !== undefined) for (const sub of subclassesOf(cls)) {
        const o = sub.getInstanceMethod(decl.getName());
        const u = o === undefined ? undefined : byDecl.get(o);
        if (u !== undefined) targets.push(u);
      }
      return { targets, viaInterface: undefined };
    }
    if (Node.isVariableDeclaration(decl) || Node.isFunctionDeclaration(decl) || Node.isPropertyDeclaration(decl)) return { targets: own === undefined ? [] : [own], viaInterface: undefined };
    return { targets: [], viaInterface: undefined };
  };

  const out = new Map<string, CgEdge[]>();
  const refDecls = new Map<string, Set<string>>();
  for (const u of units.values()) {
    const edges: CgEdge[] = [];
    const refs = new Set<string>();
    const seen = new Set<string>();
    const inTry = (n: Node, scope: Node): boolean => {
      for (let p = n.getParent(); p !== undefined && p !== scope; p = p.getParent()) {
        const gp = p.getParent();
        if (gp !== undefined && Node.isTryStatement(gp) && gp.getTryBlock() === p && gp.getCatchClause() !== undefined) return true;
      }
      return false;
    };
    const push = (kind: CgEdge['kind'], site: Node, scope: Node, r: { targets: readonly string[]; viaInterface: string | undefined }): void => {
      for (const t of r.targets) {
        if (t === u.id) continue;
        const e: CgEdge = { kind, target: t, line: site.getStartLineNumber(), inTry: inTry(site, scope), viaInterface: r.viaInterface };
        const k = `${kind}|${t}|${String(e.line)}|${String(e.inTry)}`;
        if (seen.has(k)) continue;
        seen.add(k);
        edges.push(e);
      }
    };
    for (const scope of u.scopes) {
      const visit = (n: Node): void => {
        if (Node.isCallExpression(n)) {
          push('call', n, scope, resolve(n.getExpression(), false));
        } else if (Node.isNewExpression(n)) {
          push('new', n, scope, resolve(n.getExpression(), true));
        } else if (Node.isIdentifier(n)) {
          const parent = n.getParent();
          const isCallee = ((Node.isCallExpression(parent) && same(parent.getExpression(), n)) || (Node.isPropertyAccessExpression(parent) && same(parent.getNameNode(), n) && isCalleeOf(parent)));
          const isNewTarget = Node.isNewExpression(parent) && same(parent.getExpression(), n);
          let decl: Node | undefined;
          try {
            decl = resolvedDeclaration(n);
          } catch {
            decl = undefined;
          }
          if (decl !== undefined) {
            const df = ctx.rel(decl.getSourceFile());
            if (projectFiles.has(df)) {
              const dn = (decl as Node & { getName?: () => string | undefined }).getName?.() ?? n.getText();
              refs.add(declKey(df, dn));
              const owner = decl.getFirstAncestor((a) => Node.isClassDeclaration(a) || Node.isInterfaceDeclaration(a));
              if (owner !== undefined) refs.add(declKey(df, (owner as ClassDeclaration).getName() ?? ''));
              if (!isCallee && !isNewTarget && n.getFirstAncestor((a) => Node.isTypeNode(a)) === undefined && (Node.isMethodDeclaration(decl) || Node.isFunctionDeclaration(decl) || (Node.isVariableDeclaration(decl) && isFunctionLike(decl.getInitializer())) || (Node.isPropertyDeclaration(decl) && isFunctionLike(decl.getInitializer())))) {
                push('ref', n, scope, resolve(n, false));
              }
            }
          }
        }
        n.forEachChild(visit);
      };
      visit(scope);
    }
    out.set(u.id, edges);
    refDecls.set(u.id, refs);
  }

  const unitAt = (node: Node): string | undefined => {
    for (let p: Node | undefined = node; p !== undefined; p = p.getParent()) {
      const id = byDecl.get(p);
      if (id !== undefined) return id;
      if (Node.isClassDeclaration(p)) return `unit:${ctx.rel(p.getSourceFile())}#${p.getName() ?? ''}.constructor`;
      if (Node.isSourceFile(p)) return `file:${ctx.rel(p)}`;
    }
    return undefined;
  };
  const g: CallGraph = { units, out, refDecls, unitOfDeclaration: (d) => byDecl.get(d), resolve, unitAt };
  CACHE.set(ctx, g);
  return g;
}
