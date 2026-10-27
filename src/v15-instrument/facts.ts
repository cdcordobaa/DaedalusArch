/**
 * v1.5 instrument (Stage 0, 2026-10-26): promoted from `experiments/detect-02/lib/facts.ts`; the logic is unchanged and the
 * prototype stays in place as the record of the exploratory runs.
 *
 * DETECT-02 (v1.5-exp) symbolic facts, zero model calls. Design: `ops/notes/detect-02-design.md` §2.
 *
 * One ts-morph pass with the TypeChecker over the tree's tsconfig computes:
 *   COMMAND, aggregate roots, sinks, WRITE_FOOTPRINT (per instance), OWNS, CONTEXT_WRITE, RULE_SITE,
 *   CONTRACT_EXPOSES (+ the structural mirror), PORT_MECHANISM, CONCRETE_INJECTION, REMOTE_IN_TX.
 * The facts are plain records; `graph.ts` loads them (with the frozen `extractAPG` graph) into the interpreter's
 * `MemoryGraph`, where the rules (`../rules/*.cypher`) read them.
 *
 * The concept rule (DETECT-01 lesson): every test below is by resolved symbol or by type, so `save(a); save(b)`,
 * `saveAll([a, b])`, `Promise.all(xs.map(save))`, a write inside `uow.run(() => …)` and a write reached through a port,
 * an ACL and another context's published object literal all reach the same footprint fact.
 */
import * as path from 'node:path';
import { Node, Project, SyntaxKind } from 'ts-morph';
import type { CallExpression, ClassDeclaration, IfStatement, InterfaceDeclaration, NewExpression, SourceFile, Type } from 'ts-morph';
import { guardShape, isTrivialParamNullCheck, normaliseCondition } from '../apg-enrich/cheap/guards.js';
import type { DetectSpec, Role } from './spec.js';
import { globMatch } from './spec.js';

export const MAX_DEPTH = 4;

export interface RootInfo { readonly name: string; readonly file: string; readonly line: number; readonly context: string | null; readonly declared: boolean; readonly module: string }
export interface FootprintWrite {
  readonly root: string; readonly instance: string; readonly many: boolean;
  readonly file: string; readonly line: number; readonly sink: string; readonly sinkSite: string; readonly via: readonly string[]; readonly inScope: boolean;
}
export interface CommandFact {
  readonly id: string; readonly name: string; readonly file: string; readonly line: number; readonly context: string | null;
  readonly eventHandler: boolean; readonly published: boolean; readonly facade: boolean; readonly writes: readonly FootprintWrite[]; readonly delegatesTo: readonly string[];
}
export interface GuardFact {
  readonly unit: string; readonly file: string; readonly line: number; readonly cond: string; readonly role: Role;
  readonly reason: string; readonly root: string; readonly duplicated: boolean;
}
/** C1 (2026-10-26): a guard outside its owner aggregate that checks a declared set or single invariant. */
export interface InvariantSiteFact {
  readonly invariant: string; readonly kind: string; readonly owner: string; readonly statement: string;
  readonly unit: string; readonly file: string; readonly line: number; readonly cond: string; readonly role: Role;
  readonly matched: readonly string[]; readonly overCollection: string | null;
}
/** CN-01 (2026-10-27): a lock primitive in application or adapter code around aggregate writes (K11). */
export interface LockFact { readonly unit: string; readonly file: string; readonly line: number; readonly lock: string; readonly roots: readonly string[] }
/** CN-01: a domain value computed outside the aggregate from its state and handed back to it (K12). */
export interface CalcFact { readonly unit: string; readonly file: string; readonly line: number; readonly expr: string; readonly root: string }
/** CN-01: an aggregate root that holds another aggregate root's object instead of its id (K16). */
export interface RefFact { readonly root: string; readonly file: string; readonly line: number; readonly member: string; readonly target: string }
export interface ContractFact { readonly contract: string; readonly file: string; readonly line: number; readonly entity: string; readonly entityFile: string; readonly via: string; readonly form: 'type' | 'mirror' }
export interface PortMechFact { readonly port: string; readonly method: string; readonly file: string; readonly line: number; readonly form: 'vendor-type' | 'adapter-type' | 'scope-callback'; readonly detail: string }
export interface InjectionFact { readonly cls: string; readonly file: string; readonly line: number; readonly adapter: string; readonly adapterFile: string; readonly form: 'constructor' | 'property' | 'new' }
export interface RemoteInTxFact { readonly unit: string; readonly file: string; readonly line: number; readonly scope: string; readonly remote: string; readonly remoteFile: string; readonly remoteLine: number; readonly via: readonly string[] }

export interface Facts {
  readonly roots: readonly RootInfo[];
  readonly rootSource: 'spec' | 'fallback' | 'none';
  readonly commands: readonly CommandFact[];
  readonly guards: readonly GuardFact[];
  readonly invariantSites: readonly InvariantSiteFact[];
  readonly locks: readonly LockFact[];
  readonly calcs: readonly CalcFact[];
  readonly refs: readonly RefFact[];
  readonly contracts: readonly ContractFact[];
  readonly portMechanisms: readonly PortMechFact[];
  readonly injections: readonly InjectionFact[];
  readonly remoteInTx: readonly RemoteInTxFact[];
  readonly stats: Record<string, number>;
}

type UnitNode = Node;
interface Unit { readonly id: string; readonly node: UnitNode; readonly name: string; readonly file: string; readonly line: number; readonly params: readonly string[]; readonly owner: string | null }

const MESSAGING_OWNER = /(Outbox|Relay|EventBus|Bus|Publisher|Dispatcher|Queue|Broker|EventStore)$/;
const REMOTE_PORT = /(Gateway|Client|Provider|Notifier|Mailer|Sender|Api|Http|Sdk)$/;
const SCOPE_EXTERNAL = /transaction|^tx$|lock|atomic|unitOfWork|serializable/i;

const rel = (root: string, abs: string): string => path.relative(root, abs).split(path.sep).join('/');

function isLibFile(sf: SourceFile): boolean {
  return /\/typescript\/lib\/lib\.[^/]*\.d\.ts$/.test(sf.getFilePath());
}
/** The external module of a declaration (ambient `declare module 'x'` or a package under node_modules), else null. */
export function externalModuleOf(decl: Node): string | null {
  const sf = decl.getSourceFile();
  if (!sf.isDeclarationFile() || isLibFile(sf)) return null;
  const ambient = decl.getFirstAncestor((a) => Node.isModuleDeclaration(a));
  if (ambient !== undefined && Node.isModuleDeclaration(ambient)) return ambient.getName().replace(/^['"]|['"]$/g, '');
  const m = /\/node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(sf.getFilePath());
  return m ? m[1]! : path.basename(sf.getFilePath());
}

/** Class/interface/alias declarations a type mentions: unions, arrays, readonly arrays, tuples, generics, aliases. */
export function typeDecls(t: Type, out: Set<Node>, depth = 0, seen = new Set<Type>()): void {
  if (depth > 5 || seen.has(t)) return;
  seen.add(t);
  if (t.isUnion()) { for (const u of t.getUnionTypes()) typeDecls(u, out, depth + 1, seen); return; }
  if (t.isIntersection()) { for (const u of t.getIntersectionTypes()) typeDecls(u, out, depth + 1, seen); return; }
  for (const a of t.getAliasTypeArguments()) typeDecls(a, out, depth + 1, seen);
  if (t.isArray()) { const e = t.getArrayElementType(); if (e) typeDecls(e, out, depth + 1, seen); return; }
  if (t.isTuple()) { for (const e of t.getTupleElements()) typeDecls(e, out, depth + 1, seen); return; }
  for (const a of t.getTypeArguments()) typeDecls(a, out, depth + 1, seen);
  const alias = t.getAliasSymbol();
  if (alias) for (const d of alias.getDeclarations()) out.add(d);
  const s = t.getSymbol();
  if (s) for (const d of s.getDeclarations()) if (Node.isClassDeclaration(d) || Node.isInterfaceDeclaration(d) || Node.isTypeAliasDeclaration(d)) out.add(d);
}

/** True when the type is a collection (array, readonly array, Set, Map values, iterable) of something. */
function isCollection(t: Type): boolean {
  if (t.isArray() || t.isTuple()) return true;
  const n = t.getSymbol()?.getName() ?? '';
  return ['ReadonlyArray', 'Array', 'Set', 'ReadonlySet', 'Iterable', 'Map', 'ReadonlyMap'].includes(n);
}

export function computeFacts(tree: string, tsconfig: string, spec: DetectSpec): Facts {
  const root = path.resolve(tree);
  const project = new Project({ tsConfigFilePath: tsconfig, skipAddingFilesFromTsConfig: false });
  const files = project.getSourceFiles().filter((sf) => !sf.isDeclarationFile() && !sf.getFilePath().includes('/node_modules/'));
  const fileOf = (n: Node): string => rel(root, n.getSourceFile().getFilePath());
  const inTree = (n: Node): boolean => { const f = n.getSourceFile(); return !f.isDeclarationFile() && !f.getFilePath().includes('/node_modules/'); };
  const roleOfNode = (n: Node): Role => spec.roleOf(fileOf(n));
  const stats: Record<string, number> = {};
  const bump = (k: string, by = 1): void => { stats[k] = (stats[k] ?? 0) + by; };

  // ── Units ─────────────────────────────────────────────────────────────────────────────────────────────────────
  const units = new Map<Node, Unit>();
  const ownerName = (n: Node): string | null => {
    const c = n.getFirstAncestor((a) => Node.isClassDeclaration(a));
    return c && Node.isClassDeclaration(c) ? c.getName() ?? null : null;
  };
  const paramsOf = (n: Node): string[] =>
    (Node.isMethodDeclaration(n) || Node.isConstructorDeclaration(n) || Node.isFunctionDeclaration(n) || Node.isArrowFunction(n) || Node.isFunctionExpression(n))
      ? n.getParameters().map((p) => p.getName()) : [];
  const addUnit = (n: Node, name: string): void => {
    const file = fileOf(n);
    units.set(n, { id: `${file}#${name}@${n.getStartLineNumber()}`, node: n, name, file, line: n.getStartLineNumber(), params: paramsOf(n), owner: ownerName(n) });
  };
  for (const sf of files) {
    for (const cls of sf.getClasses()) {
      const cn = cls.getName() ?? 'anonymous';
      for (const m of cls.getMethods()) if (m.getBody()) addUnit(m, `${cn}.${m.getName()}`);
      for (const c of cls.getConstructors()) addUnit(c, `${cn}.constructor`);
      for (const p of cls.getProperties()) {
        const init = p.getInitializer();
        if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) addUnit(init, `${cn}.${p.getName()}`);
      }
    }
    for (const f of sf.getFunctions()) if (f.getBody()) addUnit(f, f.getName() ?? 'default');
    sf.forEachDescendant((d) => {
      if (Node.isPropertyAssignment(d)) {
        const init = d.getInitializer();
        if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) addUnit(init, `{}.${d.getName()}`);
      } else if (Node.isMethodDeclaration(d) && Node.isObjectLiteralExpression(d.getParent())) {
        addUnit(d, `{}.${d.getName()}`);
      } else if (Node.isVariableDeclaration(d)) {
        const init = d.getInitializer();
        if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) addUnit(init, d.getName());
      } else if (Node.isFunctionDeclaration(d) && d.getParent() !== sf && d.getBody() && !units.has(d)) {
        addUnit(d, d.getName() ?? 'nested'); // CN-01: a function declared inside another (a facade inside createApp)
      }
    });
  }
  bump('units', units.size);

  /** Descendants of a unit body that belong to it (nested units are their own). */
  const bodyNodes = (u: Unit): Node[] => {
    const out: Node[] = [];
    const walk = (n: Node): void => {
      for (const c of n.getChildren()) {
        if (units.has(c)) continue;
        out.push(c);
        walk(c);
      }
    };
    walk(u.node);
    return out;
  };

  // ── Implementations of interface members: classes (by type) and object literals (by contextual type) ─────────
  const impls = new Map<Node, Node[]>(); // interface member declaration → implementing unit nodes
  const addImpl = (k: Node, v: Node): void => { impls.set(k, [...(impls.get(k) ?? []), v]); };
  const interfaceMembers = (iface: InterfaceDeclaration, name: string): Node[] => {
    const out: Node[] = [];
    const visit = (i: InterfaceDeclaration, seen: Set<Node>): void => {
      if (seen.has(i)) return; seen.add(i);
      for (const m of [...i.getMethods(), ...i.getProperties()]) if (m.getName() === name) out.push(m);
      for (const b of i.getBaseDeclarations()) if (Node.isInterfaceDeclaration(b)) visit(b, seen);
    };
    visit(iface, new Set());
    return out;
  };
  const implementedInterfaces = new Map<ClassDeclaration, InterfaceDeclaration[]>();
  for (const sf of files) {
    for (const cls of sf.getClasses()) {
      const ifs: InterfaceDeclaration[] = [];
      const heritage = [...cls.getImplements()];
      for (const h of heritage) for (const d of h.getType().getSymbol()?.getDeclarations() ?? []) if (Node.isInterfaceDeclaration(d)) ifs.push(d);
      // Abstract base classes: their abstract methods dispatch to the subclass.
      const base = cls.getBaseClass();
      if (base) for (const m of base.getMethods()) if (m.isAbstract()) { const sub = cls.getMethod(m.getName()); if (sub) addImpl(m, sub); }
      implementedInterfaces.set(cls, ifs);
      for (const i of ifs) {
        for (const m of cls.getMethods()) for (const im of interfaceMembers(i, m.getName())) addImpl(im, m);
        for (const p of cls.getProperties()) {
          const init = p.getInitializer();
          if (init && units.has(init)) for (const im of interfaceMembers(i, p.getName())) addImpl(im, init);
        }
      }
    }
    sf.forEachDescendant((d) => {
      if (!Node.isObjectLiteralExpression(d)) return;
      const ct = d.getContextualType() ?? undefined;
      const decls = new Set<Node>();
      if (ct) typeDecls(ct, decls);
      for (const i of decls) {
        if (!Node.isInterfaceDeclaration(i)) continue;
        for (const p of d.getProperties()) {
          let name: string | undefined; let unit: Node | undefined;
          if (Node.isPropertyAssignment(p)) { name = p.getName(); const init = p.getInitializer(); if (init && units.has(init)) unit = init; }
          else if (Node.isMethodDeclaration(p)) { name = p.getName(); unit = p; }
          if (name && unit) for (const im of interfaceMembers(i, name)) addImpl(im, unit);
        }
      }
    });
  }

  // ── Call resolution ─────────────────────────────────────────────────────────────────────────────────────────────
  const declOfCall = (call: CallExpression | NewExpression): Node | undefined => {
    const e = call.getExpression();
    const id = Node.isPropertyAccessExpression(e) ? e.getNameNode() : e;
    let s = id.getSymbol();
    if (s?.isAlias()) s = s.getAliasedSymbol() ?? s;
    const d = s?.getDeclarations()[0];
    if (Node.isNewExpression(call) && d && Node.isClassDeclaration(d)) return d.getConstructors()[0] ?? d;
    return d;
  };
  /** The unit nodes a resolved declaration runs (itself, its initializer, or its implementations). */
  const targetsOf = (d: Node | undefined): Node[] => {
    if (d === undefined) return [];
    if (units.has(d)) return [d];
    if (Node.isPropertyAssignment(d) || Node.isVariableDeclaration(d) || Node.isPropertyDeclaration(d)) {
      const init = d.getInitializer();
      if (init && units.has(init)) return [init];
    }
    const im = impls.get(d);
    if (im) return im.flatMap((x) => (units.has(x) ? [x] : []));
    return [];
  };
  const memberOwner = (d: Node): ClassDeclaration | InterfaceDeclaration | undefined => {
    const o = d.getFirstAncestor((a) => Node.isClassDeclaration(a) || Node.isInterfaceDeclaration(a));
    return o && (Node.isClassDeclaration(o) || Node.isInterfaceDeclaration(o)) ? o : undefined;
  };

  // ── Aggregate roots (spec, else fallback) ───────────────────────────────────────────────────────────────────────
  const rootDecls = new Map<Node, RootInfo>();
  const entityDecls = new Set<Node>();
  let rootSource: Facts['rootSource'] = 'none';
  if (spec.aggregates.length > 0) {
    rootSource = 'spec';
    for (const a of spec.aggregates) {
      const sf = project.getSourceFile(path.join(root, a.root));
      if (!sf) continue;
      const d = sf.getClass(a.name) ?? sf.getInterface(a.name) ?? sf.getClasses()[0];
      if (!d) continue;
      rootDecls.set(d, { name: d.getName() ?? a.name, file: a.root, line: d.getStartLineNumber(), context: a.context, declared: true, module: a.module });
      for (const ie of a.innerEntities) {
        if (ie.endsWith('.ts')) { const f = project.getSourceFile(path.join(root, ie)); for (const x of [...(f?.getClasses() ?? []), ...(f?.getInterfaces() ?? [])]) entityDecls.add(x); continue; }
        for (const f of files) { const x = f.getClass(ie) ?? f.getInterface(ie); if (x && globMatch([a.module], fileOf(x))) entityDecls.add(x); }
      }
    }
  }
  // Identity via a subtype: an interface whose sub-interface or implementing class adds the `id` ("the store adds
  // the id"; the DETECT-01 S1 step-3 adjustment, kept as a dev-time adjustment).
  const identityViaSubtype = new Set<Node>();
  for (const sf of files) {
    for (const i of sf.getInterfaces()) if (i.getProperty('id')) for (const b of i.getBaseDeclarations()) identityViaSubtype.add(b);
  }
  const ownId = (c: ClassDeclaration): boolean => c.getProperty('id') !== undefined || c.getGetAccessor('id') !== undefined
    || c.getConstructors().some((k) => k.getParameters().some((q) => q.getName() === 'id' && q.isParameterProperty()));
  const hasIdentity = (d: Node): boolean => {
    if (identityViaSubtype.has(d)) return true;
    if (Node.isClassDeclaration(d)) {
      if (ownId(d)) return true;
      // R3: identity inherited from an in-tree entity base class (`class Post extends AggregateRoot<P>`, `Entity` holds `_id`).
      for (let b = d.getBaseClass(), i = 0; b !== undefined && i < 5; b = b.getBaseClass(), i++) {
        if (!inTree(b)) break;
        if (ownId(b) || b.getProperty('_id') !== undefined) return true;
      }
      return false;
    }
    if (Node.isInterfaceDeclaration(d)) return d.getProperty('id') !== undefined;
    return false;
  };
  /**
   * R3: an identifier type (its only own state is its identity: `class PostId extends Entity { get id() }`, an
   * interface `{ id }`) is a reference to an aggregate, never an aggregate. Used by root inference only.
   */
  const isIdentifierType = (d: Node): boolean => {
    const isIdName = (n: string): boolean => n === 'id' || n === '_id';
    if (Node.isClassDeclaration(d)) {
      const state = [
        ...d.getProperties().filter((p) => !p.isStatic()).map((p) => p.getName()),
        ...d.getGetAccessors().filter((g) => !g.isStatic()).map((g) => g.getName()),
        ...d.getConstructors().flatMap((k) => k.getParameters().filter((q) => q.isParameterProperty()).map((q) => q.getName())),
      ];
      return state.every(isIdName);
    }
    if (Node.isInterfaceDeclaration(d)) return d.getProperties().every((p) => isIdName(p.getName())) && d.getBaseDeclarations().length === 0;
    return false;
  };

  // Storage owners: a spec `repositories` file, an interface implemented by an adapter class, or an adapter class.
  const storageOwner = (o: ClassDeclaration | InterfaceDeclaration): boolean => {
    const f = fileOf(o);
    if (spec.repositories.length > 0 && globMatch(spec.repositories, f)) return true;
    const r = spec.roleOf(f);
    if (Node.isClassDeclaration(o)) return r === 'adapter';
    if (r === 'port') return true;
    for (const [cls, ifs] of implementedInterfaces) if (ifs.includes(o) && spec.roleOf(fileOf(cls)) === 'adapter') return true;
    return false;
  };
  const hasRootMembers = (o: ClassDeclaration | InterfaceDeclaration): boolean =>
    o.getMethods().some((m) => [...paramTypesOf(m), m.getReturnType()].some((t) => rootsIn(t).length > 0));
  const paramTypesOf = (d: Node): Type[] =>
    (Node.isMethodSignature(d) || Node.isMethodDeclaration(d) || Node.isFunctionDeclaration(d)) ? d.getParameters().map((p) => p.getType()) : [];

  if (rootSource === 'none') {
    // Fallback: identity-bearing domain types that a storage owner's method takes as a parameter.
    for (const sf of files) {
      for (const o of [...sf.getInterfaces(), ...sf.getClasses()]) {
        if (!storageOwner(o)) continue;
        for (const m of o.getMethods()) for (const t of paramTypesOf(m)) {
          const ds = new Set<Node>(); typeDecls(t, ds);
          for (const d of ds) {
            if (!inTree(d) || rootDecls.has(d) || !hasIdentity(d) || isIdentifierType(d)) continue;
            const r = roleOfNode(d);
            if (r !== 'domain' && r !== 'shared-kernel') continue;
            const f = fileOf(d);
            rootDecls.set(d, { name: (d as ClassDeclaration).getName() ?? '?', file: f, line: d.getStartLineNumber(), context: spec.contextOf(f), declared: false, module: `${path.posix.dirname(f)}/**` });
          }
        }
      }
    }
    if (rootDecls.size > 0) rootSource = 'fallback';
  }
  const rootsIn = (t: Type): RootInfo[] => {
    const ds = new Set<Node>(); typeDecls(t, ds);
    return [...ds].flatMap((d) => (rootDecls.has(d) ? [rootDecls.get(d)!] : []));
  };
  const inAggregateModule = (n: Node): RootInfo | undefined => {
    const f = fileOf(n);
    return [...rootDecls.values()].find((r) => globMatch([r.module], f));
  };
  bump('roots', rootDecls.size);

  /**
   * Precision revision R1 (ops/notes/detect-02-precision-note.md §5): the roots an owner *stores*, i.e. loads by
   * identity (some method of it or of an interface it extends returns a single root: `T`, `T | undefined`,
   * `Promise<T | null>`, not a collection). `null` = an owner a spec `repositories` glob declares that loads no root
   * (a declared write-only repository: every root it takes counts, as before R1).
   */
  const storedCache = new Map<Node, Set<string> | null>();
  const storedRoots = (o: ClassDeclaration | InterfaceDeclaration): Set<string> | null => {
    if (storedCache.has(o)) return storedCache.get(o)!;
    const out = new Set<string>();
    const visit = (x: ClassDeclaration | InterfaceDeclaration, seen: Set<Node>): void => {
      if (seen.has(x)) return; seen.add(x);
      for (const m of x.getMethods()) {
        let t = m.getReturnType();
        if (t.getSymbol()?.getName() === 'Promise') t = t.getTypeArguments()[0] ?? t;
        // R3: a tuple return (`[Meeting, number]`: the root and its version) is a single load of each element.
        const parts = (t.isUnion() ? t.getUnionTypes() : [t]).flatMap((p) => (p.isTuple() ? p.getTupleElements() : [p]));
        for (const p of parts) if (!isCollection(p)) for (const r of rootsIn(p)) out.add(r.name);
      }
      const bases: Node[] = Node.isInterfaceDeclaration(x) ? x.getBaseDeclarations() : [...(x.getBaseClass() ? [x.getBaseClass()!] : []), ...(implementedInterfaces.get(x as ClassDeclaration) ?? [])];
      for (const b of bases) if (Node.isInterfaceDeclaration(b) || Node.isClassDeclaration(b)) visit(b, seen);
    };
    visit(o, new Set());
    const res = out.size === 0 && spec.repositories.length > 0 && globMatch(spec.repositories, fileOf(o)) ? null : out;
    storedCache.set(o, res);
    return res;
  };
  /**
   * The roots of a type that this sink declaration writes (R1): the roots its owner stores; and, when the method
   * returns nothing (a write method of a store of some root, e.g. `saveAudited(booking, entries)`), every root it is
   * handed. A method of an owner that stores no root (a question port, an append-only log, a finder) writes none.
   */
  const writtenRoots = (d: Node, t: Type): RootInfo[] => {
    const rs = rootsIn(t);
    if (!(Node.isMethodSignature(d) || Node.isMethodDeclaration(d))) return rs;
    const o = memberOwner(d);
    if (!o || !inTree(o)) return rs;
    const s = storedRoots(o);
    let ret = d.getReturnType();
    if (ret.getSymbol()?.getName() === 'Promise') ret = ret.getTypeArguments()[0] ?? ret;
    const returnsNothing = ret.isVoid() || ret.isUndefined();
    // R3: on a declared repository that loads no root, only its write methods (returning nothing) write; a finder or
    // an existence check (`exists(postId): boolean`) does not.
    if (s === null) return returnsNothing ? rs : [];
    const writeMethod = s.size > 0 && returnsNothing;
    return writeMethod ? rs : rs.filter((r) => s.has(r.name));
  };
  /** A sink: a storage-owner method with a parameter typed by a root it stores, or an external-module call with a root argument. */
  const isSink = (d: Node, call: CallExpression | NewExpression): boolean => {
    if (Node.isMethodSignature(d) || Node.isMethodDeclaration(d)) {
      const o = memberOwner(d);
      // R2: a static method of an in-tree class (a mapper, a factory) holds no storage and is never a sink.
      if (o && inTree(o) && Node.isMethodDeclaration(d) && d.isStatic()) return false;
      if (o && inTree(o) && !rootDecls.has(o) && storageOwner(o) && paramTypesOf(d).some((t) => writtenRoots(d, t).length > 0)) return true;
    }
    if (externalModuleOf(d) !== null) return call.getArguments().some((a) => rootsIn(a.getType()).length > 0);
    return false;
  };
  const isMessagingUnit = (n: Node): boolean => {
    const u = units.get(n);
    if (u?.owner && MESSAGING_OWNER.test(u.owner)) return true;
    return false;
  };
  const isEventType = (t: Type): boolean => {
    const ds = new Set<Node>(); typeDecls(t, ds);
    for (const d of ds) {
      const names = new Set<string>();
      const walk = (x: Node, depth: number): void => {
        if (depth > 4) return;
        if (Node.isClassDeclaration(x) || Node.isInterfaceDeclaration(x) || Node.isTypeAliasDeclaration(x)) names.add(x.getName() ?? '');
        if (Node.isInterfaceDeclaration(x)) for (const b of x.getBaseDeclarations()) walk(b, depth + 1);
        if (Node.isClassDeclaration(x)) {
          const b = x.getBaseClass(); if (b) walk(b, depth + 1);
          for (const i of x.getImplements()) for (const dd of i.getType().getSymbol()?.getDeclarations() ?? []) walk(dd, depth + 1);
        }
      };
      walk(d, 0);
      if (spec.domainEventTypes.some((e) => names.has(e))) return true;
    }
    return false;
  };
  const isEventDecl = (d: Node): boolean => isEventType(d.getType());
  const isEventHandlerUnit = (n: Node): boolean =>
    (Node.isMethodDeclaration(n) || Node.isFunctionDeclaration(n) || Node.isArrowFunction(n) || Node.isFunctionExpression(n))
    && n.getParameters().some((p) => isEventType(p.getType()));

  // ── WRITE_FOOTPRINT ─────────────────────────────────────────────────────────────────────────────────────────────
  const leadingIdent = (e: Node): string => {
    let x: Node = e;
    while (Node.isPropertyAccessExpression(x) || Node.isCallExpression(x) || Node.isNonNullExpression(x) || Node.isParenthesizedExpression(x) || Node.isAsExpression(x)) {
      x = Node.isCallExpression(x) ? x.getExpression() : (x as unknown as { getExpression(): Node }).getExpression();
    }
    return x.getText();
  };
  const instanceKey = (u: Unit, e: Node, bind: Map<string, string>): string => {
    const t = e.getText().replace(/\s+/g, '');
    const lead = leadingIdent(e);
    if (lead === 'this') return `${u.owner ?? u.file}:${t}`;
    const b = bind.get(lead);
    if (b !== undefined) return t === lead ? b : `${b}${t.slice(lead.length)}`;
    return `${u.id}:${t}`;
  };
  /** True when the sink call runs once per element of a root collection (a loop or an iteration callback). */
  const iterated = (call: Node, stop: Node): boolean => {
    for (let a = call.getParent(); a !== undefined && a !== stop; a = a.getParent()) {
      if (Node.isForOfStatement(a) && isCollection(a.getExpression().getType()) && rootsIn(a.getExpression().getType()).length > 0) return true;
      if (Node.isForInStatement(a) || Node.isForStatement(a) || Node.isWhileStatement(a)) return true;
      if (Node.isArrowFunction(a) || Node.isFunctionExpression(a)) {
        const p = a.getParent();
        if (p && Node.isCallExpression(p)) {
          const e = p.getExpression();
          if (Node.isPropertyAccessExpression(e) && ['map', 'forEach', 'flatMap', 'reduce', 'filter'].includes(e.getName())) {
            const recv = e.getExpression().getType();
            if (isCollection(recv) && rootsIn(recv).length > 0) return true;
          }
        }
      }
    }
    return false;
  };
  /** Inside the function argument of a scope call (a PORT_MECHANISM scope method or an external transaction call). */
  const scopeCalls = new Set<Node>(); // filled in the PORT_MECHANISM pass, used by REMOTE_IN_TX and `inScope`
  const insideScope = (n: Node, stop: Node): boolean => {
    for (let a = n.getParent(); a !== undefined && a !== stop; a = a.getParent()) if (scopeCalls.has(a)) return true;
    return false;
  };

  const footprint = (start: Unit): FootprintWrite[] => {
    const out: FootprintWrite[] = [];
    const visit = (u: Unit, bind: Map<string, string>, depth: number, via: string[], seen: Set<Node>): void => {
      if (seen.has(u.node)) return;
      seen.add(u.node);
      for (const n of bodyNodes(u)) {
        if (!Node.isCallExpression(n) && !Node.isNewExpression(n)) continue;
        const d = declOfCall(n);
        if (d === undefined) continue;
        const args = n.getArguments();
        if (isSink(d, n)) {
          const sinkName = `${memberOwner(d)?.getName() ?? externalModuleOf(d) ?? '?'}.${(d as unknown as { getName?: () => string }).getName?.() ?? '?'}`;
          const loop = iterated(n, u.node);
          for (const a of args) {
            const roots = writtenRoots(d, a.getType());
            if (roots.length === 0) continue;
            const base = { file: u.file, line: n.getStartLineNumber(), sink: sinkName, sinkSite: inTree(d) ? `${fileOf(d)}:${d.getStartLineNumber()}` : externalModuleOf(d) ?? '?', via: [...via, u.name], inScope: insideScope(n, u.node) };
            if (Node.isArrayLiteralExpression(a)) {
              for (const el of a.getElements()) {
                const rs = writtenRoots(d, el.getType());
                const r = rs[0] ?? roots[0]!;
                if (Node.isSpreadElement(el)) out.push({ ...base, root: r.name, instance: `${instanceKey(u, el.getExpression(), bind)}[*]`, many: true });
                else out.push({ ...base, root: r.name, instance: instanceKey(u, el, bind), many: loop });
              }
            } else {
              const many = loop || isCollection(a.getType());
              out.push({ ...base, root: roots[0]!.name, instance: instanceKey(u, a, bind), many });
            }
          }
          continue;
        }
        if (depth >= MAX_DEPTH) continue;
        for (const t of targetsOf(d)) {
          if (isMessagingUnit(t) || isEventHandlerUnit(t)) continue;
          const tu = units.get(t)!;
          if (!inTree(t)) continue;
          const nb = new Map<string, string>();
          tu.params.forEach((p, i) => { const a = args[i]; if (a !== undefined) nb.set(p, instanceKey(u, a, bind)); });
          visit(tu, nb, depth + 1, [...via, u.name], seen);
        }
      }
      seen.delete(u.node);
    };
    visit(start, new Map(), 0, [], new Set());
    return out;
  };

  // ── PORT_MECHANISM (also defines the scope methods) ─────────────────────────────────────────────────────────────
  const portMechanisms: PortMechFact[] = [];
  const scopeMethods = new Set<Node>();
  const isPortInterface = (i: InterfaceDeclaration): boolean => {
    const r = roleOfNode(i);
    if (r === 'port') return true;
    // CN-01 K13: an application interface implemented by an adapter class is a port, wherever it lives.
    if (r === 'application') { for (const [cls, ifs] of implementedInterfaces) if (ifs.includes(i) && spec.roleOf(fileOf(cls)) === 'adapter') return true; return false; }
    if (r !== 'domain') return false;
    return storageOwner(i);
  };
  const deepDecls = (t: Type, out: Set<Node>, depth = 0): void => {
    typeDecls(t, out);
    if (depth >= 2) return;
    for (const sig of t.getCallSignatures()) {
      for (const p of sig.getParameters()) { const vd = p.getValueDeclaration(); if (vd) deepDecls(vd.getType(), out, depth + 1); }
      deepDecls(sig.getReturnType(), out, depth + 1);
    }
  };
  for (const sf of files) {
    for (const i of sf.getInterfaces()) {
      if (!isPortInterface(i)) continue;
      for (const m of [...i.getMethods(), ...i.getProperties()]) {
        const ptypes: { t: Type; where: string }[] = Node.isMethodSignature(m)
          ? [...m.getParameters().map((p) => ({ t: p.getType(), where: `parameter ${p.getName()}` })), { t: m.getReturnType(), where: 'return type' }]
          : [{ t: m.getType(), where: 'property type' }];
        const seen = new Set<string>();
        for (const { t, where } of ptypes) {
          const ds = new Set<Node>(); deepDecls(t, ds);
          for (const d of ds) {
            const mod = externalModuleOf(d);
            const name = (d as unknown as { getName?: () => string }).getName?.() ?? '?';
            let form: PortMechFact['form'] | null = null; let detail = '';
            if (mod !== null) { form = 'vendor-type'; detail = `${where} uses ${name} from ${mod}`; }
            else if (inTree(d) && roleOfNode(d) === 'adapter') { form = 'adapter-type'; detail = `${where} uses ${name} declared in ${fileOf(d)}`; }
            if (form && !seen.has(detail)) { seen.add(detail); portMechanisms.push({ port: i.getName(), method: m.getName(), file: fileOf(m), line: m.getStartLineNumber(), form, detail }); }
          }
          // Scope callback: a function-typed parameter whose own parameters include a storage owner (a tx- or
          // lock-bound repository handed to the caller).
          if (where.startsWith('parameter')) {
            for (const sig of t.getCallSignatures()) {
              for (const p of sig.getParameters()) {
                const vd = p.getValueDeclaration(); if (!vd) continue;
                const pd = new Set<Node>(); typeDecls(vd.getType(), pd);
                for (const x of pd) {
                  if ((Node.isInterfaceDeclaration(x) || Node.isClassDeclaration(x)) && inTree(x) && storageOwner(x) && !rootDecls.has(x) && hasRootMembers(x)) {
                    scopeMethods.add(m);
                    const detail2 = `${where} is a callback that receives ${x.getName()} (a scoped repository: a lock or transaction mechanism in the port)`;
                    if (!seen.has(detail2)) { seen.add(detail2); portMechanisms.push({ port: i.getName(), method: m.getName(), file: fileOf(m), line: m.getStartLineNumber(), form: 'scope-callback', detail: detail2 }); }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  // Scope calls: calls to a scope method, or to an external method named like a transaction/lock that takes a callback.
  for (const u of units.values()) {
    for (const n of bodyNodes(u)) {
      if (!Node.isCallExpression(n)) continue;
      const d = declOfCall(n);
      if (d === undefined) continue;
      const hasFn = n.getArguments().some((a) => Node.isArrowFunction(a) || Node.isFunctionExpression(a));
      if (!hasFn) continue;
      if (scopeMethods.has(d)) { scopeCalls.add(n); continue; }
      // CN-01 K07: an in-tree transaction or lock mechanism (owner named like one) taking a callback is a scope.
      const ownr = memberOwner(d);
      if (ownr && inTree(ownr) && /transaction|unitofwork|lock|mutex/i.test(ownr.getName() ?? '')) { scopeCalls.add(n); continue; }
      const nm = (d as unknown as { getName?: () => string }).getName?.() ?? '';
      if (externalModuleOf(d) !== null && SCOPE_EXTERNAL.test(nm)) scopeCalls.add(n);
    }
  }
  bump('scopeCalls', scopeCalls.size);

  // ── COMMANDS ────────────────────────────────────────────────────────────────────────────────────────────────────
  const commands: CommandFact[] = [];
  for (const u of units.values()) {
    const role = spec.roleOf(u.file);
    const n = u.node;
    let isCmd = false;
    if (role === 'application' && Node.isMethodDeclaration(n) && Node.isClassDeclaration(n.getParent())) {
      isCmd = !n.hasModifier(SyntaxKind.PrivateKeyword) && !n.hasModifier(SyntaxKind.ProtectedKeyword) && !n.isStatic();
    }
    const published = role === 'contract' && (Node.isArrowFunction(n) || Node.isFunctionExpression(n) || Node.isMethodDeclaration(n)) && u.name.startsWith('{}.');
    // CN-01 K06: a method of the composition root's app facade (`createApp` returns `{ cancelBooking() { … } }`) is a
    // command too, so a write moved into the facade is still one command's footprint.
    const facade = role === 'composition' && (Node.isArrowFunction(n) || Node.isFunctionExpression(n) || Node.isMethodDeclaration(n) || Node.isFunctionDeclaration(n))
      && (u.name.startsWith('{}.') || (Node.isFunctionDeclaration(n) && n.getParent() !== n.getSourceFile()));
    if (!isCmd && !published && !facade) continue;
    if (u.owner && MESSAGING_OWNER.test(u.owner)) continue;
    const writes = footprint(u);
    const delegatesTo: string[] = [];
    for (const x of bodyNodes(u)) {
      if (!Node.isCallExpression(x)) continue;
      const e = x.getExpression();
      if (Node.isPropertyAccessExpression(e) && e.getExpression().getKind() === SyntaxKind.ThisKeyword) {
        const d = declOfCall(x);
        if (d && Node.isMethodDeclaration(d) && d.getParent() === n.getParent()) delegatesTo.push(`${u.file}#${u.owner}.${d.getName()}`);
      }
    }
    commands.push({
      id: `${u.file}#${u.name}`, name: u.name, file: u.file, line: u.line, context: spec.contextOf(u.file),
      eventHandler: isEventHandlerUnit(n), published, facade, writes, delegatesTo,
    });
  }
  bump('commands', commands.length);

  // ── RULE_SITE ───────────────────────────────────────────────────────────────────────────────────────────────────
  const guards: GuardFact[] = [];
  const domainGuardKeys = new Set<string>();
  const EQUALITY = new Set([SyntaxKind.EqualsEqualsEqualsToken, SyntaxKind.EqualsEqualsToken, SyntaxKind.ExclamationEqualsEqualsToken, SyntaxKind.ExclamationEqualsToken]);
  const RELATIONAL = new Set([SyntaxKind.LessThanToken, SyntaxKind.LessThanEqualsToken, SyntaxKind.GreaterThanToken, SyntaxKind.GreaterThanEqualsToken]);
  const NUMBER_TESTS = new Set(['isInteger', 'isFinite', 'isNaN', 'isSafeInteger']);
  const guardsOf = (u: Unit): IfStatement[] => bodyNodes(u).filter((n): n is IfStatement => Node.isIfStatement(n) && guardShape(n) !== undefined && !isTrivialParamNullCheck(n));
  // CN-01 K09: literals the aggregates' own guards compare state with (`this.status === "refunded"`), per root.
  const domainGuardLiterals = new Map<string, Set<string>>();
  for (const u of units.values()) {
    if (rootDecls.size === 0) break;
    if (!inAggregateModule(u.node) && spec.roleOf(u.file) !== 'domain') continue;
    for (const g of guardsOf(u)) {
      domainGuardKeys.add(normaliseCondition(g.getExpression()));
      const r = inAggregateModule(u.node);
      if (r === undefined) continue;
      for (const b of [g.getExpression(), ...g.getExpression().getDescendants()]) {
        if (!Node.isBinaryExpression(b) || !EQUALITY.has(b.getOperatorToken().getKind())) continue;
        for (const side of [b.getLeft(), b.getRight()]) if (Node.isStringLiteral(side) || Node.isNumericLiteral(side)) {
          const set = domainGuardLiterals.get(r.name) ?? new Set<string>(); set.add(side.getText().replace(/^['"]|['"]$/g, '')); domainGuardLiterals.set(r.name, set);
        }
      }
    }
  }
  const ruleSitesApply = rootDecls.size > 0 || (spec.style !== 'layered' && files.some((f) => spec.roleOf(fileOf(f)) === 'domain'));
  const isErrorClass = (d: Node): boolean => {
    for (let c: ClassDeclaration | undefined = d.getFirstAncestorByKind(SyntaxKind.ClassDeclaration) ?? (Node.isClassDeclaration(d) ? d : undefined), i = 0; c && i < 5; c = c.getBaseClass(), i++) {
      if (/Error$/.test(c.getName() ?? '')) return true;
      if (c.getExtends()?.getText() === 'Error') return true;
    }
    return false;
  };
  for (const u of units.values()) {
    if (!ruleSitesApply) break;
    const role = spec.roleOf(u.file);
    if (role !== 'application' && role !== 'adapter') continue;
    // Values this unit hands to the aggregate: arguments of calls whose target is declared in an aggregate module
    // (a root method, an entity or value object constructor) and is not a storage read.
    const handed = new Map<string, string>(); // identifier → root name
    for (const n of bodyNodes(u)) {
      if (!Node.isCallExpression(n) && !Node.isNewExpression(n)) continue;
      if (n.getFirstAncestorByKind(SyntaxKind.ThrowStatement)) continue; // building the error, not handing a value
      const d = declOfCall(n);
      if (d === undefined || !inTree(d) || isErrorClass(d)) continue;
      const r = inAggregateModule(d) ?? (spec.roleOf(fileOf(d)) === 'domain' ? { name: memberOwner(d)?.getName() ?? 'the domain model' } : undefined);
      if (r === undefined) continue;
      const o = memberOwner(d);
      if (o && storageOwner(o)) {
        const rt = (Node.isMethodSignature(d) || Node.isMethodDeclaration(d)) ? d.getReturnType().getText() : '';
        if (!/^(void|Promise<void>)$/.test(rt)) continue; // a read
      }
      for (const a of n.getArguments()) a.forEachDescendantAsArray().concat([a]).forEach((x) => { if (Node.isIdentifier(x)) handed.set(x.getText(), r.name); });
    }
    for (const g of guardsOf(u)) {
      const cond = g.getExpression();
      let reason = ''; let rootName = '';
      const check = (side: Node): void => {
        if (reason) return;
        if (Node.isPropertyAccessExpression(side) && side.getName() === 'length') return;
        // (a) a read of an aggregate's state: some sub-expression of the operand is root-typed
        for (const x of [side, ...side.getDescendants()]) {
          if (!Node.isIdentifier(x) && !Node.isPropertyAccessExpression(x) && !Node.isCallExpression(x)) continue;
          if (Node.isIdentifier(x) && Node.isPropertyAccessExpression(x.getParent()) && (x.getParent() as Node & { getNameNode(): Node }).getNameNode() === x) continue;
          const rs = rootsIn(x.getType());
          if (rs.length > 0 && !isCollection(x.getType())) { reason = `compares the state of ${rs[0]!.name} (${side.getText()})`; rootName = rs[0]!.name; return; }
        }
        // (b) a value the unit hands to the aggregate
        for (const x of [side, ...side.getDescendants()]) {
          if (Node.isIdentifier(x) && handed.has(x.getText())) { reason = `decides on ${x.getText()}, which is then passed to ${handed.get(x.getText())}`; rootName = handed.get(x.getText())!; return; }
        }
      };
      cond.forEachDescendant((d) => {
        if (Node.isBinaryExpression(d) && RELATIONAL.has(d.getOperatorToken().getKind())) { check(d.getLeft()); check(d.getRight()); }
        if (Node.isCallExpression(d)) {
          const e = d.getExpression();
          if (Node.isPropertyAccessExpression(e) && e.getExpression().getText() === 'Number' && NUMBER_TESTS.has(e.getName())) for (const a of d.getArguments()) check(a);
        }
      });
      if (Node.isBinaryExpression(cond) && RELATIONAL.has(cond.getOperatorToken().getKind())) { check(cond.getLeft()); check(cond.getRight()); }
      let dupLiteral = false;
      if (!reason) {
        // CN-01 K09: an equality on an aggregate's state against a literal that the aggregate's own guard also uses.
        for (const b of [cond, ...cond.getDescendants()]) {
          if (reason || !Node.isBinaryExpression(b) || !EQUALITY.has(b.getOperatorToken().getKind())) continue;
          const [l, rgt] = [b.getLeft(), b.getRight()];
          const lit = [l, rgt].find((x) => Node.isStringLiteral(x) || Node.isNumericLiteral(x));
          const other = lit === l ? rgt : l;
          if (lit === undefined) continue;
          const st = other.getDescendants().concat([other]).map((x) => (Node.isPropertyAccessExpression(x) ? x.getExpression() : Node.isCallExpression(x) && Node.isPropertyAccessExpression(x.getExpression()) ? (x.getExpression() as import('ts-morph').PropertyAccessExpression).getExpression() : undefined)).find((x) => x !== undefined && rootsIn(x.getType()).length > 0 && !isCollection(x.getType()));
          const rs = st ? rootsIn(st.getType()) : [];
          const litText = lit.getText().replace(/^['"]|['"]$/g, '');
          if (rs.length > 0 && domainGuardLiterals.get(rs[0]!.name)?.has(litText) === true) { reason = `repeats ${rs[0]!.name}'s own check (${b.getText()})`; rootName = rs[0]!.name; dupLiteral = true; }
        }
      }
      if (!reason) continue;
      guards.push({
        unit: u.name, file: u.file, line: g.getStartLineNumber(), cond: cond.getText().replace(/\s+/g, ' '), role, reason, root: rootName,
        duplicated: dupLiteral || domainGuardKeys.has(normaliseCondition(cond)),
      });
    }
  }
  bump('ruleSites', guards.length);

  // ── INVARIANT_SITE (C1, declared invariants only) ───────────────────────────────────────────────────────────────
  // A guard matches a declared invariant when the names it reads (its condition, the initialisers of local consts the
  // condition names, and the bodies of same-file functions it calls, one level) include two of the invariant's terms,
  // or one term plus a collection of an `over` type. Guards inside the owner aggregate's module are the right place.
  const invariantSites: InvariantSiteFact[] = [];
  const checked = spec.invariants.filter((v) => v.kind !== 'uniqueness');
  // CN-01 K10: a rejection need not throw. An entry point rejects by returning (a response, a result) or by skipping
  // (continue/break) in its then-branch.
  const rejectsWithoutThrow = (st: IfStatement): boolean => {
    const t = st.getThenStatement();
    const firsts = Node.isBlock(t) ? t.getStatements() : [t];
    return firsts.some((x) => Node.isReturnStatement(x) || Node.isContinueStatement(x) || Node.isBreakStatement(x));
  };
  const invariantGuardsOf = (u: Unit): IfStatement[] => bodyNodes(u).filter((n): n is IfStatement => Node.isIfStatement(n) && (guardShape(n) !== undefined || rejectsWithoutThrow(n)) && !isTrivialParamNullCheck(n));
  for (const u of units.values()) {
    if (checked.length === 0) break;
    const role = spec.roleOf(u.file);
    if (role === 'contract') continue;
    for (const g of invariantGuardsOf(u)) {
      const cond = g.getExpression();
      const reach: Node[] = [cond];
      for (const x of [cond, ...cond.getDescendants()]) {
        if (Node.isIdentifier(x)) {
          const d = x.getSymbol()?.getDeclarations()[0];
          if (d && Node.isVariableDeclaration(d) && d.getSourceFile() === g.getSourceFile()) { const init = d.getInitializer(); if (init) reach.push(init); }
        }
        if (Node.isCallExpression(x)) {
          const d = declOfCall(x);
          if (d && d.getSourceFile() === g.getSourceFile() && (Node.isFunctionDeclaration(d) || Node.isMethodDeclaration(d))) { const b = d.getBody(); if (b) reach.push(b); }
        }
      }
      const names = new Set<string>();
      const types: Type[] = [];
      for (const r of reach) for (const x of [r, ...r.getDescendants()]) {
        if (Node.isIdentifier(x)) names.add(x.getText().toLowerCase());
        if (Node.isIdentifier(x) || Node.isPropertyAccessExpression(x) || Node.isCallExpression(x)) types.push(x.getType());
      }
      // CN-01 K10 owner-first: score every declared invariant; if the guard sits in the owner module of any invariant
      // it matches, it is that owner enforcing it, and nothing is reported. Otherwise only the best match is reported.
      const scored = checked.map((v) => {
        const matched = v.terms.filter((t) => names.has(t.toLowerCase()));
        const over = v.over.find((o) => types.some((t) => isCollection(t) && new RegExp(`\\b${o}\\b`).test(t.getText())));
        return { v, matched, over, hit: matched.length >= 2 || (matched.length >= 1 && over !== undefined) };
      }).filter((x) => x.hit);
      if (scored.some((x) => { const o = spec.aggregates.find((a) => a.name === x.v.owner); return o !== undefined && globMatch([o.module], u.file); })) continue;
      const best = Math.max(0, ...scored.map((x) => x.matched.length));
      for (const { v, matched, over } of scored.filter((x) => x.matched.length === best)) {
        {
          invariantSites.push({
            invariant: v.id, kind: v.kind, owner: v.owner ?? '', statement: v.statement, unit: u.name, file: u.file,
            line: g.getStartLineNumber(), cond: cond.getText().replace(/\s+/g, ' '), role, matched, overCollection: over ?? null,
          });
        }
      }
    }
  }
  bump('invariantSites', invariantSites.length);

  // ── LOCK_AROUND_WRITE (CN-01 K11) ───────────────────────────────────────────────────────────────────────────────
  // An application, adapter or composition unit that calls a lock primitive (a callee named like lock, mutex,
  // exclusive, semaphore, serialise; in-tree or external) and whose footprint writes an aggregate: the lock is
  // standing in for a consistency boundary. A lock around no aggregate write (a cache refresh) is not reported.
  const LOCK_NAME = /lock|mutex|exclusive|semaphore|serializ|serialis/i;
  const locks: LockFact[] = [];
  for (const u of units.values()) {
    if (rootDecls.size === 0) break;
    const role = spec.roleOf(u.file);
    if (role !== 'application' && role !== 'adapter' && role !== 'composition') continue;
    if (u.owner !== null && LOCK_NAME.test(u.owner)) continue; // the lock implementation itself
    const call = bodyNodes(u).find((n): n is CallExpression => {
      if (!Node.isCallExpression(n)) return false;
      const e = n.getExpression();
      const nm = Node.isPropertyAccessExpression(e) ? e.getName() : e.getText();
      if (LOCK_NAME.test(nm) && !/^unlock$/i.test(nm)) return true;
      // the lock may be named by its type only: `this.saleLocks.run(key, () => …)` on a `KeyedLock`
      const d = declOfCall(n); const ow = d ? memberOwner(d) : undefined;
      return ow !== undefined && LOCK_NAME.test(ow.getName() ?? '') && n.getArguments().some((a) => Node.isArrowFunction(a) || Node.isFunctionExpression(a));
    });
    if (call === undefined) continue;
    const roots = [...new Set(footprint(u).map((w) => w.root))].sort();
    if (roots.length === 0) continue;
    const e = call.getExpression();
    const lockOwner = ((): string | undefined => { const d = declOfCall(call); return d ? memberOwner(d)?.getName() : undefined; })();
    locks.push({ unit: u.name, file: u.file, line: call.getStartLineNumber(), lock: `${lockOwner ? `${lockOwner}.` : ''}${Node.isPropertyAccessExpression(e) ? e.getName() : e.getText()}`, roots });
  }
  bump('locks', locks.length);

  // ── CALC_OUTSIDE (CN-01 K12) ────────────────────────────────────────────────────────────────────────────────────
  // In an application unit: arithmetic (or Math.round/floor/ceil/min/max) over an aggregate's state whose result is
  // handed back to an aggregate (an argument of a call declared in an aggregate module, a local passed to one, or an
  // assignment to a root-typed object's property). A value only formatted or returned is not reported.
  const ARITH = new Set([SyntaxKind.PlusToken, SyntaxKind.MinusToken, SyntaxKind.AsteriskToken, SyntaxKind.SlashToken, SyntaxKind.PercentToken]);
  const calcs: CalcFact[] = [];
  const rootState = (x: Node): RootInfo | undefined => {
    for (const y of [x, ...x.getDescendants()]) {
      if (!Node.isPropertyAccessExpression(y) && !Node.isCallExpression(y)) continue;
      const callee = Node.isCallExpression(y) ? y.getExpression() : undefined;
      const base = Node.isPropertyAccessExpression(y) ? y.getExpression() : callee !== undefined && Node.isPropertyAccessExpression(callee) ? callee.getExpression() : undefined;
      if (base === undefined) continue;
      const rs = rootsIn(base.getType());
      if (rs.length > 0 && !isCollection(base.getType())) return rs[0];
    }
    return undefined;
  };
  const toAggregate = (call: CallExpression | NewExpression): boolean => {
    const d = declOfCall(call);
    return d !== undefined && inTree(d) && inAggregateModule(d) !== undefined && !isErrorClass(d);
  };
  for (const u of units.values()) {
    if (rootDecls.size === 0) break;
    if (spec.roleOf(u.file) !== 'application') continue;
    const body = bodyNodes(u);
    const handedLocals = new Set<string>();
    for (const n of body) if ((Node.isCallExpression(n) || Node.isNewExpression(n)) && toAggregate(n)) for (const a of n.getArguments()) if (Node.isIdentifier(a)) handedLocals.add(a.getText());
    const seen = new Set<number>();
    for (const n of body) {
      const isArith = (Node.isBinaryExpression(n) && ARITH.has(n.getOperatorToken().getKind()))
        || (Node.isCallExpression(n) && /^Math\.(round|floor|ceil|min|max)$/.test(n.getExpression().getText()));
      if (!isArith) continue;
      if (n.getType().getText() !== 'number') continue;
      const r = rootState(n);
      if (r === undefined) continue;
      const parent = n.getParent();
      const anc = n.getFirstAncestor((a) => Node.isCallExpression(a) || Node.isNewExpression(a));
      const intoCall = anc !== undefined && (Node.isCallExpression(anc) || Node.isNewExpression(anc)) && toAggregate(anc) && anc.getArguments().some((a) => a === n || a.getDescendants().includes(n));
      const vd = n.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
      const intoLocal = vd !== undefined && handedLocals.has(vd.getName());
      const asg = parent && Node.isBinaryExpression(parent) && parent.getOperatorToken().getKind() === SyntaxKind.EqualsToken && parent.getRight() === n
        && ((l: Node): boolean => Node.isPropertyAccessExpression(l) && rootsIn(l.getExpression().getType()).length > 0)(parent.getLeft());
      if (!intoCall && !intoLocal && !asg) continue;
      const line = n.getStartLineNumber();
      if (seen.has(line)) continue;
      seen.add(line);
      calcs.push({ unit: u.name, file: u.file, line, expr: n.getText().replace(/\s+/g, ' ').slice(0, 160), root: r.name });
    }
  }
  bump('calcs', calcs.length);

  // ── REFERENCES_ROOT (CN-01 K16) ─────────────────────────────────────────────────────────────────────────────────
  // Declared roots only: with inferred roots an inner entity can be taken for a root (precision fixtures p05, p10).
  const refs: RefFact[] = [];
  for (const [d, info] of rootSource === 'spec' ? rootDecls : new Map<Node, RootInfo>()) {
    if (!Node.isClassDeclaration(d) && !Node.isInterfaceDeclaration(d)) continue;
    const members: { name: string; type: Type; line: number }[] = [
      ...d.getProperties().map((p) => ({ name: p.getName(), type: p.getType(), line: p.getStartLineNumber() })),
      ...(Node.isClassDeclaration(d) ? d.getConstructors().flatMap((k) => k.getParameters().filter((q) => q.isParameterProperty()).map((q) => ({ name: q.getName(), type: q.getType(), line: q.getStartLineNumber() }))) : []),
    ];
    for (const m of members) {
      for (const t of rootsIn(m.type)) {
        if (t.name === info.name) continue;
        refs.push({ root: info.name, file: info.file, line: m.line, member: m.name, target: t.name });
      }
    }
  }
  bump('refs', refs.length);

  // ── CONTRACT_EXPOSES ────────────────────────────────────────────────────────────────────────────────────────────
  const contracts: ContractFact[] = [];
  const isEntity = (d: Node): boolean => rootDecls.has(d) || entityDecls.has(d)
    || (inTree(d) && (Node.isClassDeclaration(d) || Node.isInterfaceDeclaration(d)) && inAggregateModule(d) !== undefined
        && !globMatch(spec.repositories, fileOf(d)) && !/\/value-objects\//.test(fileOf(d)) && !isEventDecl(d))
    || (inTree(d) && (Node.isClassDeclaration(d) || Node.isInterfaceDeclaration(d)) && roleOfNode(d) === 'domain' && hasIdentity(d) && !globMatch(spec.repositories, fileOf(d)));
  const entityName = (d: Node): string => (d as ClassDeclaration).getName() ?? '?';
  const exposes = (start: Node, startType: Type, label: string): { entity: Node; via: string } | null => {
    const seen = new Set<Node>();
    const walk = (t: Type, via: string, depth: number): { entity: Node; via: string } | null => {
      if (depth > 3) return null;
      const ds = new Set<Node>(); deepDecls(t, ds);
      for (const d of ds) {
        if (seen.has(d) || d === start) continue;
        seen.add(d);
        if (isEntity(d)) return { entity: d, via };
        // Recurse only through other published types (a contract that wraps a contract), never through ports.
        if (inTree(d) && spec.isPublished(fileOf(d)) && (Node.isInterfaceDeclaration(d) || Node.isTypeAliasDeclaration(d) || Node.isClassDeclaration(d))) {
          const r = walk(d.getType(), `${via} → ${entityName(d)}`, depth + 1);
          if (r) return r;
          if (Node.isInterfaceDeclaration(d) || Node.isClassDeclaration(d)) for (const p of d.getProperties()) { const rr = walk(p.getType(), `${via} → ${entityName(d)}.${p.getName()}`, depth + 1); if (rr) return rr; }
        }
      }
      return null;
    };
    return walk(startType, label, 0);
  };
  for (const sf of files) {
    const f = fileOf(sf);
    if (!spec.isPublished(f)) continue;
    const decls: { node: Node; name: string; members: { name: string; type: Type; line: number }[] }[] = [];
    for (const i of sf.getInterfaces()) decls.push({ node: i, name: i.getName(), members: [...i.getProperties().map((p) => ({ name: p.getName(), type: p.getType(), line: p.getStartLineNumber() })), ...i.getMethods().flatMap((m) => [...m.getParameters().map((p) => ({ name: `${m.getName()}(${p.getName()})`, type: p.getType(), line: m.getStartLineNumber() })), { name: `${m.getName()}()`, type: m.getReturnType(), line: m.getStartLineNumber() }])] });
    for (const a of sf.getTypeAliases()) decls.push({ node: a, name: a.getName(), members: [{ name: '=', type: a.getType(), line: a.getStartLineNumber() }] });
    for (const c of sf.getClasses()) decls.push({ node: c, name: c.getName() ?? '?', members: c.getProperties().filter((p) => !p.hasModifier(SyntaxKind.PrivateKeyword)).map((p) => ({ name: p.getName(), type: p.getType(), line: p.getStartLineNumber() })) });
    for (const fn of sf.getFunctions()) if (fn.isExported()) decls.push({ node: fn, name: fn.getName() ?? 'default', members: [{ name: '()', type: fn.getReturnType(), line: fn.getStartLineNumber() }] });
    for (const d of decls) {
      if (isEntity(d.node)) continue;
      for (const m of d.members) {
        const hit = exposes(d.node, m.type, `${d.name}.${m.name}`);
        if (hit) { contracts.push({ contract: d.name, file: f, line: m.line, entity: entityName(hit.entity), entityFile: fileOf(hit.entity), via: hit.via, form: 'type' }); break; }
      }
    }
    // Re-exports of an entity from a published file (`export { Order } from './domain/order/Order'`).
    for (const ed of sf.getExportDeclarations()) for (const ne of ed.getNamedExports()) {
      let s = ne.getSymbol(); if (s?.isAlias()) s = s.getAliasedSymbol() ?? s;
      for (const d of s?.getDeclarations() ?? []) if (isEntity(d)) contracts.push({ contract: ne.getName(), file: f, line: ed.getStartLineNumber(), entity: entityName(d), entityFile: fileOf(d), via: 're-export', form: 'type' });
    }
  }
  // Mirror: a public domain method returning an anonymous object with exactly a contract type's property names (≥ 3).
  const contractShapes = new Map<string, { name: string; file: string }>();
  for (const sf of files) {
    if (!spec.isPublished(fileOf(sf))) continue;
    for (const i of sf.getInterfaces()) {
      const names = i.getProperties().map((p) => p.getName()).sort();
      if (names.length >= 3) contractShapes.set(names.join(','), { name: i.getName(), file: fileOf(sf) });
    }
  }
  for (const u of units.values()) {
    if (!Node.isMethodDeclaration(u.node) || spec.roleOf(u.file) !== 'domain') continue;
    if (u.node.hasModifier(SyntaxKind.PrivateKeyword)) continue;
    let t = u.node.getReturnType();
    if (t.getSymbol()?.getName() === 'Promise') t = t.getTypeArguments()[0] ?? t;
    if (t.isArray()) t = t.getArrayElementTypeOrThrow();
    if (!t.isObject() || !t.isAnonymous() || t.getCallSignatures().length > 0) continue;
    const key = t.getProperties().map((p) => p.getName()).sort().join(',');
    const c = contractShapes.get(key);
    if (c) contracts.push({ contract: c.name, file: u.file, line: u.line, entity: u.owner ?? '?', entityFile: u.file, via: `${u.name} returns the shape of ${c.name} (${c.file})`, form: 'mirror' });
  }
  bump('contractExposes', contracts.length);

  // ── CONCRETE_INJECTION ──────────────────────────────────────────────────────────────────────────────────────────
  const injections: InjectionFact[] = [];
  const adapterClassesIn = (t: Type): ClassDeclaration[] => {
    const ds = new Set<Node>(); typeDecls(t, ds);
    return [...ds].filter((d): d is ClassDeclaration => Node.isClassDeclaration(d) && inTree(d) && roleOfNode(d) === 'adapter');
  };
  for (const sf of files) {
    for (const cls of sf.getClasses()) {
      const f = fileOf(cls);
      if (spec.roleOf(f) !== 'application') continue;
      for (const c of cls.getConstructors()) for (const p of c.getParameters()) for (const a of adapterClassesIn(p.getType()))
        injections.push({ cls: cls.getName() ?? '?', file: f, line: p.getStartLineNumber(), adapter: a.getName() ?? '?', adapterFile: fileOf(a), form: 'constructor' });
      for (const p of cls.getProperties()) for (const a of adapterClassesIn(p.getType()))
        if (!p.getInitializer() || !Node.isNewExpression(p.getInitializer()!)) injections.push({ cls: cls.getName() ?? '?', file: f, line: p.getStartLineNumber(), adapter: a.getName() ?? '?', adapterFile: fileOf(a), form: 'property' });
      cls.forEachDescendant((d) => {
        if (!Node.isNewExpression(d)) return;
        const decl = d.getExpression().getSymbol();
        const s = decl?.isAlias() ? decl.getAliasedSymbol() : decl;
        for (const x of s?.getDeclarations() ?? []) if (Node.isClassDeclaration(x) && inTree(x) && roleOfNode(x) === 'adapter')
          injections.push({ cls: cls.getName() ?? '?', file: f, line: d.getStartLineNumber(), adapter: x.getName() ?? '?', adapterFile: fileOf(x), form: 'new' });
      });
    }
  }
  bump('concreteInjections', injections.length);

  // ── REMOTE_IN_TX ────────────────────────────────────────────────────────────────────────────────────────────────
  const remoteInTx: RemoteInTxFact[] = [];
  /** External modules a unit reaches (depth-bounded), through ports to their implementations. */
  const externalReach = (start: Node, depth: number, seen: Set<Node>): { mod: string; file: string; line: number; via: string[] }[] => {
    const out: { mod: string; file: string; line: number; via: string[] }[] = [];
    const u = units.get(start);
    if (!u || seen.has(start) || depth > 3) return out;
    seen.add(start);
    for (const n of bodyNodes(u)) {
      if (!Node.isCallExpression(n)) continue;
      const d = declOfCall(n);
      if (d === undefined) continue;
      const mod = externalModuleOf(d);
      if (mod !== null) { out.push({ mod, file: u.file, line: n.getStartLineNumber(), via: [u.name] }); continue; }
      if (Node.isIdentifier(n.getExpression()) && n.getExpression().getText() === 'fetch') { out.push({ mod: 'fetch', file: u.file, line: n.getStartLineNumber(), via: [u.name] }); continue; }
      for (const t of targetsOf(d)) for (const r of externalReach(t, depth + 1, seen)) out.push({ ...r, via: [u.name, ...r.via] });
    }
    return out;
  };
  for (const u of units.values()) {
    for (const n of bodyNodes(u)) {
      if (!scopeCalls.has(n) || !Node.isCallExpression(n)) continue;
      const d = declOfCall(n)!;
      // The scope's own mechanism modules (the DB driver its implementation uses) are not remote calls.
      const own = new Set<string>([externalModuleOf(d) ?? '']);
      for (const t of targetsOf(d)) {
        const tu = units.get(t);
        if (!tu) continue;
        for (const x of bodyNodes(tu)) if (Node.isCallExpression(x)) { const dd = declOfCall(x); const m = dd ? externalModuleOf(dd) : null; if (m) own.add(m); }
      }
      for (const a of n.getArguments()) {
        if (!Node.isArrowFunction(a) && !Node.isFunctionExpression(a)) continue;
        for (const x of a.getDescendants()) {
          if (!Node.isCallExpression(x)) continue;
          const dd = declOfCall(x);
          if (dd === undefined) continue;
          const ow = memberOwner(dd);
          if (ow && inTree(ow) && storageOwner(ow) && hasRootMembers(ow)) continue; // the scoped store itself: local state
          const hits: { mod: string; file: string; line: number; via: string[] }[] = [];
          const m = externalModuleOf(dd);
          if (m !== null) hits.push({ mod: m, file: fileOf(x), line: x.getStartLineNumber(), via: [] });
          else for (const t of targetsOf(dd)) hits.push(...externalReach(t, 1, new Set()));
          // CN-01 K07: a call to an outbound port named like a remote system (not a store) is a remote call, even when
          // its in-tree implementation is a fake.
          if (hits.length === 0 && ow && inTree(ow) && !hasRootMembers(ow) && REMOTE_PORT.test(ow.getName() ?? '')) hits.push({ mod: ow.getName() ?? 'port', file: fileOf(x), line: x.getStartLineNumber(), via: [] });
          for (const h of hits) {
            if (own.has(h.mod)) continue;
            remoteInTx.push({ unit: u.name, file: u.file, line: x.getStartLineNumber(), scope: (d as unknown as { getName?: () => string }).getName?.() ?? '?', remote: h.mod, remoteFile: h.file, remoteLine: h.line, via: h.via });
          }
        }
      }
    }
  }
  bump('remoteInTx', remoteInTx.length);

  return {
    roots: [...rootDecls.values()], rootSource, commands, guards, invariantSites, locks, calcs, refs, contracts, portMechanisms, injections,
    remoteInTx: dedupe(remoteInTx, (r) => `${r.file}:${r.line}:${r.remote}`), stats,
  };
}

function dedupe<T>(xs: readonly T[], key: (x: T) => string): T[] {
  const m = new Map<string, T>();
  for (const x of xs) if (!m.has(key(x))) m.set(key(x), x);
  return [...m.values()];
}
