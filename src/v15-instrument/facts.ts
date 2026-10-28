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
import { categoryOfModule } from '../apg-enrich/cheap/behaviour.js';
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
/** HCAL-01 (2026-10-27): an adapter that imports another adapter package (H03). */
export interface AdapterImportFact { readonly file: string; readonly line: number; readonly specifier: string; readonly target: string; readonly fromPkg: string; readonly toPkg: string }
/** HCAL-01: a transport concept (an HTTP status code, an HTTP or SQL error type) in domain, application or port code (H07). */
export interface RepoMultiFact { readonly file: string; readonly line: number; readonly repo: string; readonly method: string; readonly root: string; readonly form: 'two-params' | 'collection' }
export interface DomainTechFact { readonly file: string; readonly line: number; readonly module: string; readonly category: string }
export interface LocatorFact { readonly file: string; readonly line: number; readonly role: Role; readonly form: 'container-call' | 'static-instance' | 'via-helper'; readonly detail: string }
export interface CoreIoFact { readonly file: string; readonly line: number; readonly role: Role; readonly form: 'io-import' | 'io-global'; readonly detail: string }
export interface EntityOutFact { readonly file: string; readonly line: number; readonly handler: string; readonly entity: string; readonly entityFile: string; readonly form: 'returns' | 'accepts' | 'responds' }
/** CN-04 (2026-10-28): a conditional in an adapter that decides a business rule on domain state (H06). */
export interface AdapterRuleFact { readonly file: string; readonly line: number; readonly unit: string; readonly cond: string; readonly reads: string; readonly effect: string }
/** CN-04: a core type whose string-literal values or field names are copied from one vendor SDK type (H11). */
export interface MirrorFact { readonly file: string; readonly line: number; readonly role: Role; readonly core: string; readonly vendor: string; readonly module: string; readonly form: 'values' | 'names'; readonly detail: string }
export interface TransportFact { readonly file: string; readonly line: number; readonly role: Role; readonly form: 'status-code' | 'transport-type' | 'transport-import'; readonly detail: string }
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
  readonly adapterImports: readonly AdapterImportFact[];
  readonly transports: readonly TransportFact[];
  readonly domainTech: readonly DomainTechFact[];
  readonly locators: readonly LocatorFact[];
  readonly coreIo: readonly CoreIoFact[];
  readonly entityOut: readonly EntityOutFact[];
  readonly adapterRules: readonly AdapterRuleFact[];
  readonly mirrors: readonly MirrorFact[];
  readonly repoMulti: readonly RepoMultiFact[];
  readonly contracts: readonly ContractFact[];
  readonly portMechanisms: readonly PortMechFact[];
  readonly injections: readonly InjectionFact[];
  readonly remoteInTx: readonly RemoteInTxFact[];
  readonly stats: Record<string, number>;
}

type UnitNode = Node;
interface Unit { readonly id: string; readonly node: UnitNode; readonly name: string; readonly file: string; readonly line: number; readonly params: readonly string[]; readonly owner: string | null }

const MESSAGING_OWNER = /(Outbox|Relay|EventBus|Bus|Publisher|Dispatcher|Queue|Broker|EventStore)$/;
const DB_HANDLE = /(Transaction|Tx|Connection|Session|QueryRunner|EntityManager|Cursor|Pool)(Handle)?$/;
const SK_HANDLE = /(Transaction|Tx|Connection)(Handle|Context)?$/;
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
    // CN-02b K13: an application interface with methods is an out-port by its shape, even before any adapter implements it.
    if (r === 'application') { for (const [cls, ifs] of implementedInterfaces) if (ifs.includes(i) && spec.roleOf(fileOf(cls)) === 'adapter') return true; return i.getMethods().length > 0; }
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
        // HCAL-01 H04: a name imported from a third-party package and used in the signature is a vendor type, even when
        // its declaration cannot be resolved (a shim outside the project, a missing @types package).
        {
          const sig = m.getText();
          for (const imp of i.getSourceFile().getImportDeclarations()) {
            const spec_ = imp.getModuleSpecifierValue();
            if (spec_.startsWith('.') || spec_.startsWith('/') || spec_.startsWith('node:')) continue;
            for (const nm of [...imp.getNamedImports().map((x) => x.getAliasNode()?.getText() ?? x.getName()), imp.getDefaultImport()?.getText() ?? '', imp.getNamespaceImport()?.getText() ?? ''].filter(Boolean)) {
              if (!new RegExp(`\\b${nm}\\b`).test(sig)) continue;
              const detail = `signature uses ${nm} from ${spec_}`;
              if (!portMechanisms.some((x) => x.port === i.getName() && x.method === m.getName() && x.detail.includes(` ${nm} from ${spec_}`))) portMechanisms.push({ port: i.getName(), method: m.getName(), file: fileOf(m), line: m.getStartLineNumber(), form: 'vendor-type', detail });
            }
          }
        }
        // HCAL-01 H04: a persistence mechanism handle named in the signature (a transaction, connection, session, query
        // runner or entity manager type that is not a domain type) leaks the adapter's mechanism into the port.
        for (const { t, where } of ptypes) {
          const ds0 = new Set<Node>(); deepDecls(t, ds0);
          for (const d of ds0) {
            const name = (d as unknown as { getName?: () => string }).getName?.() ?? '';
            // CN-02b K13: a transaction or connection handle is a mechanism even when the shared kernel declares it.
            if (!DB_HANDLE.test(name) || !inTree(d) || roleOfNode(d) === 'domain' || (roleOfNode(d) === 'shared-kernel' && !SK_HANDLE.test(name))) continue;
            const detail = `${where} uses ${name}, a persistence mechanism handle`;
            if (!portMechanisms.some((x) => x.port === i.getName() && x.method === m.getName() && x.detail === detail)) portMechanisms.push({ port: i.getName(), method: m.getName(), file: fileOf(m), line: m.getStartLineNumber(), form: 'adapter-type', detail });
          }
        }
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
  // CN-02: an entry point also rejects by returning a value (an error result); a bare `return;` or `return undefined`
  // is a skip, not a rejection.
  const rejectsWithValue = (st: IfStatement): boolean => {
    const t = st.getThenStatement();
    return (Node.isBlock(t) ? t.getStatements() : [t]).some((x) => {
      if (!Node.isReturnStatement(x)) return false;
      const e = x.getExpression();
      return e !== undefined && !(Node.isIdentifier(e) && e.getText() === 'undefined');
    });
  };
  const decisionGuardsOf = (u: Unit): IfStatement[] => bodyNodes(u).filter((n): n is IfStatement => Node.isIfStatement(n) && (guardShape(n) !== undefined || rejectsWithValue(n)) && !isTrivialParamNullCheck(n));
  const REPO_NAME = /(Repository|Repo|Store|Dao)$/;
  const isRepositoryClass = (o: ClassDeclaration | InterfaceDeclaration): boolean => {
    if (spec.repositories.length > 0 && globMatch(spec.repositories, fileOf(o))) return true;
    if (REPO_NAME.test(o.getName() ?? '')) return true;
    return Node.isClassDeclaration(o) && o.getImplements().some((i) => REPO_NAME.test(i.getExpression().getText()));
  };
  const isStorageCall = (c: CallExpression): boolean => { const d = declOfCall(c); const o = d ? memberOwner(d) : undefined; return o !== undefined && storageOwner(o); };
  // CN-02 K08–K10: a member read on an aggregate instance (`policy.isActive()`, `invoice.lineItems().length`,
  // `property.unitsView().some(…)`), outside the arguments of a storage call (a repository lookup is how a store-enforced
  // uniqueness is checked) and not the bare instance (an existence check on a loaded root).
  // A condition over two different aggregate instances (`from.currency !== to.currency`) spans aggregates: it cannot
  // live inside one of them, so it is not reported.
  const rootStateRead = (cond: Node): { root: string; text: string } | undefined => {
    const instances = new Set(cond.getDescendants().filter((x) => Node.isPropertyAccessExpression(x)).map((x) => (x as import('ts-morph').PropertyAccessExpression).getExpression())
      .filter((b) => Node.isIdentifier(b) && rootsIn(b.getType()).length > 0 && !isCollection(b.getType())).map((b) => b.getText()));
    if (instances.size > 1) return undefined;
    for (const x of [cond, ...cond.getDescendants()]) {
      if (!Node.isPropertyAccessExpression(x)) continue;
      const base = x.getExpression();
      if (base.getKind() === SyntaxKind.ThisKeyword) continue;
      // an element of a set of aggregates (`open.some((o) => o.total…)`) is a check across instances
      if (Node.isIdentifier(base) && base.getSymbol()?.getDeclarations().some((d) => Node.isParameterDeclaration(d) && (Node.isArrowFunction(d.getParent()) || Node.isFunctionExpression(d.getParent()))) === true) continue;
      const rs = rootsIn(base.getType());
      if (rs.length === 0 || isCollection(base.getType())) continue;
      const inStorageArg = x.getAncestors().some((an) => Node.isCallExpression(an) && isStorageCall(an) && an.getArguments().some((g) => g === x || g.getDescendants().includes(x)));
      if (inStorageArg) continue;
      const top = Node.isCallExpression(x.getParent()) && (x.getParent() as CallExpression).getExpression() === x ? x.getParent()! : x;
      return { root: rs[0]!.name, text: top.getText().replace(/\s+/g, ' ').slice(0, 80) };
    }
    return undefined;
  };
  // Units whose write footprint reaches an aggregate: calling one hands it the arguments (an adapter calling a command).
  const writerRoots = (d: Node): string[] => { const w = units.get(d); return w ? [...new Set(footprint(w).map((f) => f.root))] : []; };
  // Locals and parameters an expression reads, one level through local initialisers (`total` ← `lines.reduce(…)`).
  const sourcesOf = (x: Node, depth = 0): Set<string> => {
    const out = new Set<string>();
    for (const y of [x, ...x.getDescendants()]) {
      if (!Node.isIdentifier(y)) continue;
      if (Node.isPropertyAccessExpression(y.getParent()) && (y.getParent() as Node & { getNameNode(): Node }).getNameNode() === y) continue;
      const d = y.getSymbol()?.getDeclarations()[0];
      if (d === undefined || d.getSourceFile() !== x.getSourceFile()) continue;
      if (Node.isParameterDeclaration(d)) out.add(y.getText());
      else if (Node.isVariableDeclaration(d)) {
        out.add(y.getText());
        const init = d.getInitializer();
        if (init && depth < 2) for (const z of sourcesOf(init, depth + 1)) out.add(z);
      }
    }
    return out;
  };
  for (const u of units.values()) {
    if (!ruleSitesApply) break;
    const role = spec.roleOf(u.file);
    if (role !== 'application' && role !== 'adapter') continue;
    // CN-02: a repository's own check (store-enforced uniqueness on save) is the store's job, not a decision.
    { const o = memberOwner(u.node); if (o && isRepositoryClass(o)) continue; }
    // Values this unit hands to the aggregate: identifiers inside the arguments of calls whose target is declared in an
    // aggregate module (a root method, an entity or value object constructor) and is not a storage read, or is a unit
    // that writes an aggregate (CN-02). Each is kept with the call target, for the duplicated-rule check.
    const handed = new Map<string, string>(); // identifier → root name
    const handedTo = new Map<string, Node[]>(); // identifier → aggregate-module callee declarations
    for (const n of bodyNodes(u)) {
      if (!Node.isCallExpression(n) && !Node.isNewExpression(n)) continue;
      if (n.getFirstAncestorByKind(SyntaxKind.ThrowStatement)) continue; // building the error, not handing a value
      const d = declOfCall(n);
      if (d === undefined || !inTree(d) || isErrorClass(d)) continue;
      const r = inAggregateModule(d) ?? (spec.roleOf(fileOf(d)) === 'domain' ? { name: memberOwner(d)?.getName() ?? 'the domain model' } : undefined)
        ?? ((): { name: string } | undefined => { const w = writerRoots(d); return w.length > 0 ? { name: w[0]! } : undefined; })();
      if (r === undefined) continue;
      const o = memberOwner(d);
      if (o && storageOwner(o)) {
        const rt = (Node.isMethodSignature(d) || Node.isMethodDeclaration(d)) ? d.getReturnType().getText() : '';
        if (!/^(void|Promise<void>)$/.test(rt)) continue; // a read
      }
      for (const a of n.getArguments()) for (const id of sourcesOf(a)) {
        handed.set(id, r.name);
        if (inAggregateModule(d) !== undefined || spec.roleOf(fileOf(d)) === 'domain') handedTo.set(id, [...(handedTo.get(id) ?? []), d]);
      }
    }
    for (const g of decisionGuardsOf(u)) {
      const cond = g.getExpression();
      const throws = guardShape(g) !== undefined;
      let reason = ''; let rootName = '';
      const check = (side: Node): void => {
        if (reason) return;
        if (Node.isPropertyAccessExpression(side) && side.getName() === 'length' && rootsIn(side.getExpression().getType()).length === 0 && rootStateRead(side) === undefined) return;
        // (a) a read of an aggregate's state: some sub-expression of the operand is root-typed
        for (const x of [side, ...side.getDescendants()]) {
          if (!Node.isIdentifier(x) && !Node.isPropertyAccessExpression(x) && !Node.isCallExpression(x)) continue;
          if (Node.isIdentifier(x) && Node.isPropertyAccessExpression(x.getParent()) && (x.getParent() as Node & { getNameNode(): Node }).getNameNode() === x) continue;
          const rs = rootsIn(x.getType());
          if (rs.length > 0 && !isCollection(x.getType())) { reason = `compares the state of ${rs[0]!.name} (${side.getText()})`; rootName = rs[0]!.name; return; }
        }
        // (b) a value the unit hands to the aggregate (directly, or a local computed from one)
        for (const id of sourcesOf(side)) {
          if (handed.has(id)) { reason = `decides on ${side.getText().replace(/\s+/g, ' ').slice(0, 60)}, which is then passed to ${handed.get(id)}`; rootName = handed.get(id)!; return; }
        }
      };
      if (throws) {
        cond.forEachDescendant((d) => {
          if (Node.isBinaryExpression(d) && RELATIONAL.has(d.getOperatorToken().getKind())) { check(d.getLeft()); check(d.getRight()); }
          if (Node.isCallExpression(d)) {
            const e = d.getExpression();
            if (Node.isPropertyAccessExpression(e) && e.getExpression().getText() === 'Number' && NUMBER_TESTS.has(e.getName())) for (const a of d.getArguments()) check(a);
          }
        });
        if (Node.isBinaryExpression(cond) && RELATIONAL.has(cond.getOperatorToken().getKind())) { check(cond.getLeft()); check(cond.getRight()); }
      }
      // (c) CN-02: any other read of an aggregate's state decides the outcome (a predicate, a collection test, a
      // comparison method), thrown or returned as an error result.
      // Declared roots only, as for R-REF: with inferred roots (a Hexagonal tree) an entity's own query is not a boundary.
      const declared = rootSource === 'spec';
      if (!reason && declared) { const r = rootStateRead(cond); if (r) { reason = `decides on the state of ${r.root} (${r.text})`; rootName = r.root; } }
      // (d) CN-02 check-then-act in an adapter: a relational test of a value it then hands to a command, against a
      // value it read (`if (cents > view.remainingCents) return error; … reserveCoverage(id, cents)`).
      if (!reason && declared && role === 'adapter') {
        for (const b of [cond, ...cond.getDescendants()]) {
          if (reason || !Node.isBinaryExpression(b) || !RELATIONAL.has(b.getOperatorToken().getKind())) continue;
          for (const [mine, other] of [[b.getLeft(), b.getRight()], [b.getRight(), b.getLeft()]] as const) {
            const h = [...sourcesOf(mine)].find((id) => handed.has(id));
            const read = Node.isPropertyAccessExpression(other) || Node.isCallExpression(other) || [...sourcesOf(other)].some((id) => { const dd = other.getSourceFile().getDescendantsOfKind(SyntaxKind.VariableDeclaration).find((v) => v.getName() === id); return dd?.getInitializer()?.getDescendantsOfKind(SyntaxKind.CallExpression).length !== undefined && (dd?.getInitializer()?.getDescendantsOfKind(SyntaxKind.CallExpression).length ?? 0) > 0 || Node.isCallExpression(dd?.getInitializer() ?? b); });
            if (h !== undefined && read && !Node.isNumericLiteral(other)) { reason = `checks ${b.getText().replace(/\s+/g, ' ')} before handing ${h} to ${handed.get(h)}`; rootName = handed.get(h)!; break; }
          }
        }
      }
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
      // (e) CN-02 K09: an input rule repeated: the condition (or one of its && / || operands), with names abstracted,
      // equals a guard of the aggregate method or constructor this unit hands the same value to.
      if (!reason && declared) {
        const parts = [cond, ...cond.getDescendants().filter((x) => Node.isBinaryExpression(x) && [SyntaxKind.AmpersandAmpersandToken, SyntaxKind.BarBarToken].includes(x.getOperatorToken().getKind())).flatMap((x) => [(x as import('ts-morph').BinaryExpression).getLeft(), (x as import('ts-morph').BinaryExpression).getRight()])];
        for (const part of parts) {
          if (reason) break;
          const key = normaliseCondition(part);
          for (const id of sourcesOf(part)) {
            const callee = (handedTo.get(id) ?? []).find((d) => (d.getDescendantsOfKind(SyntaxKind.IfStatement)).some((ig) => guardShape(ig) !== undefined && [ig.getExpression(), ...ig.getExpression().getDescendants()].some((c) => normaliseCondition(c) === key)));
            if (callee) { const o = memberOwner(callee)?.getName() ?? 'the aggregate'; reason = `repeats ${o}'s own check on ${id} (${part.getText().replace(/\s+/g, ' ')})`; rootName = o; dupLiteral = true; break; }
          }
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
  const rootState = (x: Node, depth = 0): RootInfo | undefined => {
    for (const y of [x, ...x.getDescendants()]) {
      // CN-02 K12: through a local read from the aggregate (`const current = payout.amount(); … current.cents`)
      if (Node.isIdentifier(y) && depth < 2) {
        const d = y.getSymbol()?.getDeclarations()[0];
        const init = d && Node.isVariableDeclaration(d) && d.getSourceFile() === x.getSourceFile() ? d.getInitializer() : undefined;
        const r = init ? rootState(init, depth + 1) : undefined;
        if (r) return r;
      }
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
    // CN-02 K12: a local is handed when it appears anywhere in an aggregate call's arguments (`Money.of(cents)`).
    for (const n of body) if ((Node.isCallExpression(n) || Node.isNewExpression(n)) && toAggregate(n)) for (const a of n.getArguments()) for (const x of [a, ...a.getDescendants()]) if (Node.isIdentifier(x)) handedLocals.add(x.getText());
    const seen = new Set<number>();
    for (const n of body) {
      const isArith = (Node.isBinaryExpression(n) && ARITH.has(n.getOperatorToken().getKind()))
        || (Node.isCallExpression(n) && /^Math\.(round|floor|ceil|min|max)$/.test(n.getExpression().getText()));
      if (!isArith) continue;
      if (n.getType().getText() !== 'number') continue;
      const r = rootState(n);
      if (r === undefined) continue;
      const parent = n.getParent();
      // any enclosing call into the aggregate, through wrappers (`claim.apply(Money.of(Math.floor(…)))`)
      const intoCall = n.getAncestors().some((anc) => (Node.isCallExpression(anc) || Node.isNewExpression(anc)) && toAggregate(anc) && anc.getArguments().some((a) => a === n || a.getDescendants().includes(n)));
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

  // ── ADAPTER_IMPORTS (HCAL-01 H03) ───────────────────────────────────────────────────────────────────────────────
  // The adapter package of a file is the folder right under an adapters/in, adapters/out, adapters or infrastructure
  // folder (`src/adapters/in/http/…` → `src/adapters/in/http`). An adapter file that imports a file of another
  // adapter package couples two adapters that should only meet through ports, wired in the composition root.
  const ADAPTER_PKG = /^(.*?(?:adapters\/(?:in|out|inbound|outbound)|adapters|infrastructure)\/[^/]+)\//;
  const adapterImports: AdapterImportFact[] = [];
  for (const sf of files) {
    const f = fileOf(sf);
    if (spec.roleOf(f) !== 'adapter') continue;
    const from = ADAPTER_PKG.exec(f)?.[1];
    if (from === undefined) continue;
    // CN-03 H03: a type-only import couples the two adapters as much as a value import does.
    for (const imp of sf.getImportDeclarations()) {
      const tsf = imp.getModuleSpecifierSourceFile();
      if (tsf === undefined || !inTree(tsf)) continue;
      const t = fileOf(tsf);
      if (spec.roleOf(t) !== 'adapter') continue;
      const to = ADAPTER_PKG.exec(t)?.[1];
      if (to === undefined || to === from) continue;
      adapterImports.push({ file: f, line: imp.getStartLineNumber(), specifier: imp.getModuleSpecifierValue(), target: t, fromPkg: from, toPkg: to });
    }
  }
  bump('adapterImports', adapterImports.length);

  // ── USES_TRANSPORT (HCAL-01 H07) ────────────────────────────────────────────────────────────────────────────────
  // ── REPO_PERSISTS_MANY (CN-02 K04) ──────────────────────────────────────────────────────────────────────────────
  // A repository (class or interface) write method whose signature takes two or more aggregate-root instances, or a
  // collection of them: one call persists several aggregates. Declared roots only; reads (non-void returns) excluded.
  const repoMulti: RepoMultiFact[] = [];
  // A batch the spec declares (an R-D4 allowance on a command) covers the repository methods that command calls.
  const allowedBatchCalls = new Set<string>();
  for (const u of units.values()) {
    const method = u.name.includes('.') ? u.name.slice(u.name.lastIndexOf('.') + 1) : u.name;
    if (!spec.allow.some((a) => a.rule === 'R-D4' && (a.command === `${u.file}#${method}` || a.command === `${u.file}#*` || a.command === `${u.file}#${u.name}`))) continue;
    for (const n of bodyNodes(u)) if (Node.isCallExpression(n) && Node.isPropertyAccessExpression(n.getExpression())) allowedBatchCalls.add((n.getExpression() as import('ts-morph').PropertyAccessExpression).getName());
  }
  // Repository methods some application, adapter or composition unit calls: a generic, unused saveAll is no violation.
  const calledRepoMethods = new Set<string>();
  for (const u of units.values()) {
    const role = spec.roleOf(u.file);
    if (role !== 'application' && role !== 'adapter' && role !== 'composition') continue;
    for (const n of bodyNodes(u)) {
      if (!Node.isCallExpression(n)) continue;
      const d = declOfCall(n); const o = d ? memberOwner(d) : undefined;
      if (o && isRepositoryClass(o) && Node.isPropertyAccessExpression(n.getExpression())) calledRepoMethods.add((n.getExpression() as import('ts-morph').PropertyAccessExpression).getName());
    }
  }
  for (const sf of files) {
    if (rootSource !== 'spec') break;
    for (const o of [...sf.getClasses(), ...sf.getInterfaces()]) {
      if (!isRepositoryClass(o)) continue;
      for (const m of o.getMethods()) {
        if (!/^(void|Promise<void>)$/.test(m.getReturnType().getText())) continue;
        if (allowedBatchCalls.has(m.getName())) continue;
        const ps = m.getParameters().map((p) => ({ t: p.getType(), many: isCollection(p.getType()), rs: rootsIn(p.getType()) })).filter((p) => p.rs.length > 0);
        const single = ps.filter((p) => !p.many);
        const coll = ps.find((p) => p.many);
        const form = single.length >= 2 ? 'two-params' : coll !== undefined ? 'collection' : undefined;
        if (form === undefined) continue;
        // two root parameters (`saveBoth(a, b)`) is the design itself; a collection batch only once a command uses it
        if (form === 'collection' && !calledRepoMethods.has(m.getName())) continue;
        repoMulti.push({ file: fileOf(sf), line: m.getStartLineNumber(), repo: o.getName() ?? 'anonymous', method: m.getName(), root: (single[0] ?? coll)!.rs[0]!.name, form });
      }
    }
  }
  bump('repoMulti', repoMulti.length);

  // ── DOMAIN_IMPORTS_TECH (CN-02 K02) ─────────────────────────────────────────────────────────────────────────────
  // A domain file (by layer, or inside a declared aggregate module) imports an I/O package: a database driver or ORM,
  // an HTTP client, mail, file system, messaging or a web framework (the shared I/O classifier of apg-enrich).
  const domainTech: DomainTechFact[] = [];
  for (const sf of files) {
    const f = fileOf(sf);
    if (spec.roleOf(f) !== 'domain' && inAggregateModule(sf) === undefined) continue;
    for (const imp of sf.getImportDeclarations()) {
      if (imp.isTypeOnly()) continue;
      const mod = imp.getModuleSpecifierValue();
      if (mod.startsWith('.') || mod.startsWith('/')) continue;
      const category = categoryOfModule(mod.replace(/^node:/, ''));
      if (category !== null) domainTech.push({ file: f, line: imp.getStartLineNumber(), module: mod, category });
    }
  }
  bump('domainTech', domainTech.length);

  const STATUS_KEY = /^(status|statusCode|httpStatus|httpCode)$/i;
  const TRANSPORT_TYPE = /(Http\w*(Error|Exception|Status)|HttpStatus|StatusCode|Sql\w*Error|QueryFailed\w*)$/;
  // CN-03 H07: a field or parameter named for an HTTP status, and packages whose subject is HTTP errors or statuses.
  const HTTP_STATUS_NAME = /^(httpStatus|httpStatusCode|statusCode|httpCode)$/i;
  const HTTP_ERROR_PKG = /^(http-errors|http-status|http-status-codes|@hapi\/boom|boom)$/;
  const transports: TransportFact[] = [];
  const isHttpCode = (n: Node): boolean => Node.isNumericLiteral(n) && Number(n.getText()) >= 100 && Number(n.getText()) <= 599 && Number.isInteger(Number(n.getText()));
  for (const sf of files) {
    const f = fileOf(sf);
    const role = spec.roleOf(f);
    if (role !== 'domain' && role !== 'application' && role !== 'port') continue;
    const seen = new Set<string>();
    const add = (line: number, form: TransportFact['form'], detail: string): void => { const k = `${String(line)}|${detail}`; if (!seen.has(k)) { seen.add(k); transports.push({ file: f, line, role, form, detail }); } };
    sf.forEachDescendant((n) => {
      if (Node.isPropertyAssignment(n) && STATUS_KEY.test(n.getName()) && n.getInitializer() !== undefined && isHttpCode(n.getInitializer()!)) add(n.getStartLineNumber(), 'status-code', `${n.getName()}: ${n.getInitializer()!.getText()}`);
      if (Node.isNewExpression(n) && TRANSPORT_TYPE.test(n.getExpression().getText())) add(n.getStartLineNumber(), 'transport-type', `new ${n.getExpression().getText()}(…)`);
      if (Node.isClassDeclaration(n) && TRANSPORT_TYPE.test(n.getName() ?? '')) add(n.getStartLineNumber(), 'transport-type', `class ${n.getName() ?? ''}`);
      if ((Node.isParameterDeclaration(n) || Node.isPropertyDeclaration(n) || Node.isPropertySignature(n)) && Node.isIdentifier(n.getNameNode())) {
        const init = n.getInitializer();
        if (HTTP_STATUS_NAME.test(n.getName()) || (STATUS_KEY.test(n.getName()) && init !== undefined && isHttpCode(init))) add(n.getStartLineNumber(), 'status-code', `field ${n.getName()}`);
      }
    });
    for (const imp of sf.getImportDeclarations()) {
      const mod = imp.getModuleSpecifierValue();
      if (HTTP_ERROR_PKG.test(mod) || categoryOfModule(mod) === 'transport') add(imp.getStartLineNumber(), 'transport-import', `import from '${mod}'`);
    }
  }
  bump('transports', transports.length);

  // ── LOCATES (CN-03 H08) ─────────────────────────────────────────────────────────────────────────────────────────
  // Code outside the composition root pulls a dependency at run time: a container, injector or locator lookup
  // (`container.get(…)`, `moduleRef.resolve(…)`), a registry lookup by class, token or type argument, or a static
  // singleton accessor of an adapter (`SmtpMailer.getInstance()`). A Map, or a registry keyed by run-time data, is not.
  const LOCATOR_RECV = /(container|injector|locator|serviceProvider|moduleRef|ioc)$/i;
  const REGISTRY_RECV = /(registry|serviceRegistry)$/i;
  const LOCATOR_TYPE = /(Container|Injector|Locator|ServiceProvider|ModuleRef|Registry)$/;
  const LOCATOR_METHOD = /^(get|resolve|getService|getRequiredService|make|lookup|locate|inject|require)$/;
  const MAP_TYPE = /^(Map|ReadonlyMap|WeakMap|Set|ReadonlySet)$/;
  const locators: LocatorFact[] = [];
  const lookupCalls: [CallExpression, string][] = [];
  const declsOf = (n: Node): Node[] => { let sym = n.getSymbol(); if (sym?.isAlias()) sym = sym.getAliasedSymbol() ?? sym; return sym?.getDeclarations() ?? []; };
  const isTokenArg = (a: Node): boolean => {
    if (Node.isIdentifier(a)) {
      const d = declsOf(a)[0];
      if (d !== undefined && (Node.isClassDeclaration(d) || Node.isInterfaceDeclaration(d))) return true;
      return /^[A-Z][A-Z0-9_]+$/.test(a.getText()) || /TOKEN$|Token$/.test(a.getText());
    }
    return Node.isCallExpression(a) && a.getExpression().getText() === 'Symbol';
  };
  for (const sf of files) {
    const f = fileOf(sf);
    const role = spec.roleOf(f);
    if (role === 'composition' || role === 'other') continue;
    sf.forEachDescendant((n) => {
      if (!Node.isCallExpression(n)) return;
      const callee = n.getExpression();
      if (!Node.isPropertyAccessExpression(callee)) return;
      const method = callee.getName();
      const recv = callee.getExpression();
      const recvName = Node.isPropertyAccessExpression(recv) ? recv.getName() : recv.getText();
      const recvType = recv.getType();
      const typeName = recvType.getSymbol()?.getName() ?? '';
      if (MAP_TYPE.test(typeName)) return;
      // A static accessor of an adapter class, called from another file.
      if (/^(getInstance|instance|shared|default)$/.test(method) && Node.isIdentifier(recv)) {
        const d = declsOf(recv).find((x) => Node.isClassDeclaration(x));
        if (d !== undefined && inTree(d) && roleOfNode(d) === 'adapter' && fileOf(d) !== f) { locators.push({ file: f, line: n.getStartLineNumber(), role, form: 'static-instance', detail: `${recv.getText()}.${method}()` }); lookupCalls.push([n, `${recv.getText()}.${method}()`]); }
        return;
      }
      if (!LOCATOR_METHOD.test(method)) return;
      const container = LOCATOR_RECV.test(recvName) || (LOCATOR_TYPE.test(typeName) && !REGISTRY_RECV.test(typeName));
      const registry = REGISTRY_RECV.test(recvName) || /Registry$/.test(typeName);
      if (!container && !registry) return;
      // A registry is a locator only when it is asked for a type: a class or token argument, or a type argument.
      const first = n.getArguments()[0];
      if (!container && !(n.getTypeArguments().length > 0 || (first !== undefined && isTokenArg(first)))) return;
      // A container's own implementation (`this.get` inside a Container class) is not a lookup.
      if (Node.isThisExpression(recv)) return;
      locators.push({ file: f, line: n.getStartLineNumber(), role, form: 'container-call', detail: `${recv.getText()}.${method}(${first?.getText() ?? ''})` });
      lookupCalls.push([n, `${recv.getText()}.${method}(${first?.getText() ?? ''})`]);
    });
  }
  // CN-04 H08: one level of call. A function or method whose body holds one of the lookups above is a locator helper
  // (`resolve(CLOCK)` wrapping `registry.get(CLOCK)`); a call to it outside the composition root is reported at the
  // caller too. Only direct calls of the helper count: a call through a port reaches an adapter, not a helper.
  const FN_LIKE = (x: Node): boolean => Node.isFunctionDeclaration(x) || Node.isMethodDeclaration(x) || Node.isArrowFunction(x) || Node.isFunctionExpression(x) || Node.isGetAccessorDeclaration(x);
  const helpers = new Map<Node, string>();
  for (const [call, detail] of lookupCalls) { const fn = call.getFirstAncestor(FN_LIKE); if (fn !== undefined && !helpers.has(fn)) helpers.set(fn, detail); }
  const helperOf = (d: Node | undefined): Node | undefined => {
    if (d === undefined) return undefined;
    if (helpers.has(d)) return d;
    if (Node.isVariableDeclaration(d) || Node.isPropertyDeclaration(d) || Node.isPropertyAssignment(d)) { const init = d.getInitializer(); if (init !== undefined && helpers.has(init)) return init; }
    return undefined;
  };
  const lookupLines = new Set(locators.map((x) => `${x.file}:${String(x.line)}`));
  for (const sf of files) {
    const f = fileOf(sf);
    const role = spec.roleOf(f);
    if (role === 'composition' || role === 'other') continue;
    sf.forEachDescendant((n) => {
      if (!Node.isCallExpression(n)) return;
      const h = helperOf(declOfCall(n));
      if (h === undefined || n.getAncestors().includes(h)) return;
      const key = `${f}:${String(n.getStartLineNumber())}`;
      if (lookupLines.has(key)) return;
      lookupLines.add(key);
      locators.push({ file: f, line: n.getStartLineNumber(), role, form: 'via-helper', detail: `${n.getExpression().getText()}(…), which runs ${helpers.get(h)!} (${fileOf(h)}:${String(h.getStartLineNumber())})` });
    });
  }
  bump('locators', locators.length);

  // ── CORE_IO (CN-03 H09) ─────────────────────────────────────────────────────────────────────────────────────────
  // Domain, application or port code reaches the outside world without a port: a value import of an I/O package (the
  // shared classifier plus process, socket and cloud SDK packages), a dynamic `require`/`import` of one, `fetch`,
  // `process.env`, or a browser/runtime I/O global. Web frameworks are R-TRANSPORT's (H07), not this rule's.
  const EXTRA_IO = /^(child_process|net|tls|dgram|dns|http2|ws|socket\.io-client|ssh2|ftp|basic-ftp|mqtt|nats|memcached|aws-sdk|@aws-sdk\/.+|@google-cloud\/.+|@azure\/.+|firebase-admin|stripe|twilio)$/;
  const ioOf = (mod: string): string | null => {
    const m = mod.replace(/^node:/, '');
    const c = categoryOfModule(m);
    if (c !== null && c !== 'transport') return c;
    if (/^fs\//.test(m)) return 'fs';
    return EXTRA_IO.test(m) ? 'io' : null;
  };
  const coreIo: CoreIoFact[] = [];
  const isGlobal = (id: Node): boolean => { const d = id.getSymbol()?.getDeclarations()[0]; return d === undefined || !inTree(d); };
  for (const sf of files) {
    const f = fileOf(sf);
    const role = spec.roleOf(f);
    if (role !== 'domain' && role !== 'application' && role !== 'port') continue;
    for (const imp of sf.getImportDeclarations()) {
      if (imp.isTypeOnly()) continue;
      const mod = imp.getModuleSpecifierValue();
      if (mod.startsWith('.') || mod.startsWith('/')) continue;
      const c = ioOf(mod);
      if (c !== null) coreIo.push({ file: f, line: imp.getStartLineNumber(), role, form: 'io-import', detail: `import from '${mod}' (${c})` });
    }
    sf.forEachDescendant((n) => {
      if (Node.isCallExpression(n)) {
        const e = n.getExpression();
        const a = n.getArguments()[0];
        if ((e.getText() === 'require' || e.getKind() === SyntaxKind.ImportKeyword) && a !== undefined && Node.isStringLiteral(a) && ioOf(a.getLiteralValue()) !== null) coreIo.push({ file: f, line: n.getStartLineNumber(), role, form: 'io-import', detail: `${e.getText()}('${a.getLiteralValue()}')` });
        else if (Node.isIdentifier(e) && e.getText() === 'fetch' && isGlobal(e)) coreIo.push({ file: f, line: n.getStartLineNumber(), role, form: 'io-global', detail: 'fetch(…)' });
        else if (Node.isPropertyAccessExpression(e) && e.getText() === 'globalThis.fetch') coreIo.push({ file: f, line: n.getStartLineNumber(), role, form: 'io-global', detail: 'globalThis.fetch(…)' });
      }
      if (Node.isPropertyAccessExpression(n) && n.getName() === 'env' && n.getExpression().getText() === 'process' && isGlobal(n.getExpression())) coreIo.push({ file: f, line: n.getStartLineNumber(), role, form: 'io-global', detail: 'process.env' });
      if (Node.isNewExpression(n) && /^(XMLHttpRequest|WebSocket|EventSource)$/.test(n.getExpression().getText()) && isGlobal(n.getExpression())) coreIo.push({ file: f, line: n.getStartLineNumber(), role, form: 'io-global', detail: `new ${n.getExpression().getText()}(…)` });
    });
  }
  bump('coreIo', coreIo.length);

  // ── ENTITY_OUT (CN-03 H10) ──────────────────────────────────────────────────────────────────────────────────────
  // An inbound adapter's handler uses a domain entity as its transport shape: a public handler returns it (directly,
  // in a Promise, an array or an object literal's property, by type or by a return statement), takes it as a
  // parameter, or passes it to a response
  // writer (`res.json(order)`). Private helpers and mappers (`toDto(order)`) are the translation itself. Entities are
  // classes or declared roots and inner entities.
  const INBOUND = /(^|\/)adapters\/(in|inbound|driving|primary)\/|(^|\/)(api|controllers?|web|rest|graphql)\//;
  const OUTBOUND = /(^|\/)adapters\/(out|outbound|driven|secondary)\//;
  const MAPPER_NAME = /^(to|map|from|present|serialize|render|format)[A-Z_]|^(to|map)$/;
  const RESPONDER = /^(json|send|end|write|status|code|body|ok|created|reply)$/;
  const entityOut: EntityOutFact[] = [];
  const entityIn = (t: Type): Node | undefined => {
    const ds = new Set<Node>();
    typeDecls(t, ds);
    for (const d of [...ds]) if (Node.isInterfaceDeclaration(d) && !inTree(d)) ds.delete(d);
    // one level into an anonymous object type (`{ body: Order }`)
    if (t.isObject() && t.isAnonymous() && t.getCallSignatures().length === 0) for (const p of t.getProperties()) { const vd = p.getValueDeclaration(); if (vd) typeDecls(vd.getType(), ds); }
    // an entity class or a declared root or inner entity; a domain read-model interface (`JobView`) is a DTO
    return [...ds].find((d) => isEntity(d) && (Node.isClassDeclaration(d) || rootDecls.has(d) || entityDecls.has(d)));
  };
  for (const sf of files) {
    const f = fileOf(sf);
    if (spec.roleOf(f) !== 'adapter' || !INBOUND.test(f) || OUTBOUND.test(f)) continue;
    const handlers: { name: string; node: Node; params: import('ts-morph').ParameterDeclaration[]; ret: Type; line: number; method: boolean }[] = [];
    for (const c of sf.getClasses()) {
      if (/(Mapper|Presenter|Serializer)$/.test(c.getName() ?? '')) continue;
      for (const m of c.getMethods()) {
        if (m.hasModifier(SyntaxKind.PrivateKeyword) || m.hasModifier(SyntaxKind.ProtectedKeyword) || m.getName().startsWith('#') || MAPPER_NAME.test(m.getName())) continue;
        handlers.push({ name: `${c.getName() ?? '?'}.${m.getName()}`, node: m, params: m.getParameters(), ret: m.getReturnType(), line: m.getStartLineNumber(), method: true });
      }
    }
    for (const fn of sf.getFunctions()) if (fn.isExported() && !MAPPER_NAME.test(fn.getName() ?? '')) handlers.push({ name: fn.getName() ?? 'default', node: fn, params: fn.getParameters(), ret: fn.getReturnType(), line: fn.getStartLineNumber(), method: false });
    for (const h of handlers) {
      const seen = new Set<string>();
      const add = (line: number, d: Node, form: EntityOutFact['form']): void => { const k = `${form}|${entityName(d)}`; if (!seen.has(k)) { seen.add(k); entityOut.push({ file: f, line, handler: h.name, entity: entityName(d), entityFile: fileOf(d), form }); } };
      let rt = h.ret; if (rt.getSymbol()?.getName() === 'Promise') rt = rt.getTypeArguments()[0] ?? rt;
      const r = entityIn(rt); if (r) add(h.line, r, 'returns');
      // a request typed as the entity: handler methods only; a free function taking the entity is a helper over it
      if (h.method) for (const p of h.params) { const d = entityIn(p.getType()); if (d) add(p.getStartLineNumber(), d, 'accepts'); }
      h.node.forEachDescendant((n) => {
        // `return { status: 200, body: meter }` under a declared response type that hides the entity
        if (Node.isReturnStatement(n)) { const ex = n.getExpression(); const d = ex ? entityIn(ex.getType()) : undefined; if (d) add(n.getStartLineNumber(), d, 'returns'); return; }
        if (!Node.isCallExpression(n)) return;
        const e = n.getExpression();
        if (!Node.isPropertyAccessExpression(e) || !RESPONDER.test(e.getName())) return;
        for (const a of n.getArguments()) { const d = entityIn(a.getType()); if (d) add(n.getStartLineNumber(), d, 'responds'); }
      });
    }
  }
  bump('entityOut', entityOut.length);

  // ── ADAPTER_DECIDES (CN-04 H06) ─────────────────────────────────────────────────────────────────────────────────
  // A conditional (if, ternary, switch) in an adapter that decides on domain state: its condition reads a property,
  // getter or predicate of a type declared in a domain file (in a comparison, a predicate call, a boolean flag), or
  // compares a domain-typed value with a constant; and a branch throws or builds a domain error, returns a business
  // result (a literal, an object, a new value), changes domain state, or computes an amount. Not reported: transport
  // validation (typeof, presence, parse, regex and Number tests read request data, not domain state), identity and
  // version reads (a store's own uniqueness and concurrency checks), conditionals in a catch clause (error
  // translation), and a branch that only maps an equality on a decided state to an HTTP status.
  const adapterRules: AdapterRuleFact[] = [];
  const ARITH_OPS = new Set([SyntaxKind.PlusToken, SyntaxKind.MinusToken, SyntaxKind.AsteriskToken, SyntaxKind.SlashToken, SyntaxKind.PercentToken]);
  const ARITH_ASSIGN = new Set([SyntaxKind.PlusEqualsToken, SyntaxKind.MinusEqualsToken, SyntaxKind.AsteriskEqualsToken, SyntaxKind.SlashEqualsToken]);
  const COMPARE = new Set([...EQUALITY, ...RELATIONAL]);
  const MECHANISM_FIELD = /^(_?id|\w+Id|version|revision|etag|createdAt|updatedAt)$/;
  const VALIDATION_CALL = /^(test|match|isNaN|isFinite|isInteger|isSafeInteger|parse\w*|isArray)$/;
  /** The in-tree domain declaration (class, interface, alias, enum; not an error class) a type names, if any. */
  const domainDeclOf = (t: Type): Node | undefined => {
    const ds = new Set<Node>();
    for (const d of t.getAliasSymbol()?.getDeclarations() ?? []) ds.add(d);
    for (const d of t.getSymbol()?.getDeclarations() ?? []) if (Node.isEnumDeclaration(d) || Node.isEnumMember(d)) ds.add(Node.isEnumMember(d) ? d.getParentOrThrow() : d);
    if (!t.isUnion()) typeDecls(t, ds);
    return [...ds].find((d) => inTree(d) && roleOfNode(d) === 'domain' && (Node.isClassDeclaration(d) || Node.isInterfaceDeclaration(d) || Node.isTypeAliasDeclaration(d) || Node.isEnumDeclaration(d)) && !isErrorClass(d));
  };
  const isNullish = (x: Node): boolean => Node.isNullLiteral(x) || (Node.isIdentifier(x) && x.getText() === 'undefined');
  const isConstant = (x: Node): boolean => {
    if (Node.isStringLiteral(x) || Node.isNumericLiteral(x) || Node.isNoSubstitutionTemplateLiteral(x) || Node.isTrueLiteral(x) || Node.isFalseLiteral(x)) return true;
    if (Node.isPrefixUnaryExpression(x)) return Node.isNumericLiteral(x.getOperand());
    if (Node.isPropertyAccessExpression(x)) return (x.getNameNode().getSymbol()?.getDeclarations() ?? []).some((d) => Node.isEnumMember(d));
    if (Node.isIdentifier(x) && /^[A-Z][A-Z0-9_]+$/.test(x.getText())) { const d = x.getSymbol()?.getDeclarations()[0]; const init = d !== undefined && Node.isVariableDeclaration(d) ? d.getInitializer() : undefined; return init !== undefined && (Node.isNumericLiteral(init) || Node.isStringLiteral(init)); }
    return false;
  };
  const calleeName = (c: CallExpression): string => { const e = c.getExpression(); return Node.isPropertyAccessExpression(e) ? e.getName() : e.getText(); };
  /** A domain-state read in a condition (its text), or undefined: see the section comment for what counts. */
  const domainRead = (cond: Node): string | undefined => {
    const inside = new Set(cond.getDescendants());
    const validation = (x: Node): boolean => x.getAncestors().some((a) => inside.has(a) && (Node.isTypeOfExpression(a) || (Node.isCallExpression(a) && VALIDATION_CALL.test(calleeName(a)))));
    for (const x of [cond, ...cond.getDescendants()]) {
      if (validation(x)) continue;
      // (a) a comparison of a domain-typed value with a constant (`status === LoanStatus.Overdue`, `tier === 'gold'`)
      if (Node.isBinaryExpression(x) && COMPARE.has(x.getOperatorToken().getKind())) {
        for (const [a, b] of [[x.getLeft(), x.getRight()], [x.getRight(), x.getLeft()]] as const) {
          if (!isConstant(b) || isNullish(b) || Node.isThisExpression(a)) continue;
          if (Node.isPropertyAccessExpression(a) && MECHANISM_FIELD.test(a.getName())) continue;
          if (domainDeclOf(a.getType()) !== undefined) return a.getText().replace(/\s+/g, ' ').slice(0, 80);
        }
      }
      // (b) a property, getter or predicate of a domain object
      if (!Node.isPropertyAccessExpression(x)) continue;
      const base = x.getExpression();
      if (Node.isThisExpression(base) || isCollection(base.getType()) || MECHANISM_FIELD.test(x.getName())) continue;
      const bd = domainDeclOf(base.getType());
      if (bd === undefined || Node.isEnumDeclaration(bd)) continue;
      const p = x.getParent();
      const called = p !== undefined && Node.isCallExpression(p) && p.getExpression() === x;
      const top: Node = called ? p! : x;
      const up = top.getParent();
      // compared with something other than null or undefined, used in arithmetic, or a boolean (a flag or a
      // predicate); a bare optional value in a truthiness test is a presence check
      const compared = up !== undefined && Node.isBinaryExpression(up) && COMPARE.has(up.getOperatorToken().getKind()) && !isNullish(up.getLeft() === top ? up.getRight() : up.getLeft());
      const arith = up !== undefined && Node.isBinaryExpression(up) && ARITH_OPS.has(up.getOperatorToken().getKind());
      const flag = top.getType().isBoolean() || top.getType().isBooleanLiteral();
      if (compared || arith || flag) return top.getText().replace(/\s+/g, ' ').slice(0, 80);
    }
    return undefined;
  };
  const isDomainError = (d: Node | undefined): boolean => d !== undefined && inTree(d) && roleOfNode(d) === 'domain' && isErrorClass(d);
  const isHttpResponse = (e: Node): boolean => {
    if (Node.isObjectLiteralExpression(e)) return e.getProperties().some((p) => Node.isPropertyAssignment(p) && STATUS_KEY.test(p.getName()) && p.getInitializer() !== undefined && isHttpCode(p.getInitializer()!));
    return [...(Node.isCallExpression(e) ? [e] : []), ...e.getDescendantsOfKind(SyntaxKind.CallExpression)].some((c) => /^(status|code|sendStatus)$/.test(calleeName(c)) && c.getArguments().some((a) => isHttpCode(a)));
  };
  const short = (n: Node): string => n.getText().replace(/\s+/g, ' ').slice(0, 60);
  /** What a branch does that a business rule does, or undefined. `stmt` false: an expression branch (a ternary arm). */
  const branchEffect = (branch: Node, stmt: boolean): { effect: string; http: boolean } | undefined => {
    const nodes = [branch, ...branch.getDescendants()];
    for (const n of nodes) {
      if (!Node.isNewExpression(n) && !Node.isCallExpression(n)) continue;
      const d = declOfCall(n);
      if (d === undefined) continue;
      // a domain error built here (`new LoanTooLongError()`, `LoanError.tooLong()`)
      const cls = Node.isClassDeclaration(d) ? d : (d.getFirstAncestorByKind(SyntaxKind.ClassDeclaration) ?? memberOwner(d));
      if (isDomainError(cls)) return { effect: `raises ${short(n)}`, http: false };
    }
    for (const n of nodes) {
      // changes domain state: a void method of a domain class, or an assignment to a domain object's property
      if (Node.isCallExpression(n) && Node.isPropertyAccessExpression(n.getExpression())) {
        const d = declOfCall(n);
        const o = d !== undefined ? memberOwner(d) : undefined;
        if (d !== undefined && Node.isMethodDeclaration(d) && !d.isStatic() && o !== undefined && Node.isClassDeclaration(o) && inTree(o) && roleOfNode(o) === 'domain' && !isErrorClass(o)) {
          let rt = d.getReturnType(); if (rt.getSymbol()?.getName() === 'Promise') rt = rt.getTypeArguments()[0] ?? rt;
          if (rt.isVoid()) return { effect: `changes state: ${short(n)}`, http: false };
        }
      }
      if (Node.isBinaryExpression(n) && (n.getOperatorToken().getKind() === SyntaxKind.EqualsToken || ARITH_ASSIGN.has(n.getOperatorToken().getKind()))) {
        const l = n.getLeft();
        if (Node.isPropertyAccessExpression(l) && !Node.isThisExpression(l.getExpression()) && domainDeclOf(l.getExpression().getType()) !== undefined) return { effect: `changes state: ${short(n)}`, http: false };
      }
      // computes an amount
      if ((Node.isBinaryExpression(n) && (ARITH_OPS.has(n.getOperatorToken().getKind()) || ARITH_ASSIGN.has(n.getOperatorToken().getKind())) && n.getType().isNumber())
        || (Node.isCallExpression(n) && /^Math\.(round|floor|ceil|min|max)$/.test(n.getExpression().getText()))) return { effect: `computes ${short(n)}`, http: false };
    }
    if (!stmt) return undefined;
    // returns early with a business result: a literal, an object or array, a new value, or a failure result
    for (const s of Node.isBlock(branch) ? branch.getStatements() : [branch]) {
      if (!Node.isReturnStatement(s)) continue;
      let e = s.getExpression();
      while (e !== undefined && (Node.isAwaitExpression(e) || Node.isParenthesizedExpression(e) || Node.isAsExpression(e))) e = e.getExpression();
      if (e === undefined || isNullish(e)) continue;
      const http = isHttpResponse(e);
      const result = http || Node.isStringLiteral(e) || Node.isNoSubstitutionTemplateLiteral(e) || Node.isTemplateExpression(e) || Node.isNumericLiteral(e) || Node.isTrueLiteral(e) || Node.isFalseLiteral(e)
        || Node.isObjectLiteralExpression(e) || Node.isArrayLiteralExpression(e) || Node.isNewExpression(e)
        || (Node.isCallExpression(e) && /^(fail|failure|err|error|reject|rejected|declined|denied|refused)$/.test(calleeName(e)));
      if (result) return { effect: `returns ${short(e)}`, http };
    }
    return undefined;
  };
  const unitName = (n: Node): string => {
    const fn = n.getFirstAncestor((a) => units.has(a));
    return fn !== undefined ? units.get(fn)!.name : '(module)';
  };
  for (const sf of files) {
    const f = fileOf(sf);
    if (spec.roleOf(f) !== 'adapter') continue;
    const seen = new Set<number>();
    sf.forEachDescendant((n) => {
      let cond: Node | undefined; let branches: [Node, boolean][] = [];
      if (Node.isIfStatement(n)) { const el = n.getElseStatement(); cond = n.getExpression(); branches = [[n.getThenStatement(), true], ...(el !== undefined && !Node.isIfStatement(el) ? [[el, true] as [Node, boolean]] : [])]; }
      else if (Node.isConditionalExpression(n)) { cond = n.getCondition(); branches = [[n.getWhenTrue(), false], [n.getWhenFalse(), false]]; }
      else if (Node.isSwitchStatement(n)) { cond = n.getExpression(); branches = n.getClauses().flatMap((c) => c.getStatements().map((s) => [s, true] as [Node, boolean])); }
      if (cond === undefined) return;
      if (n.getFirstAncestor((a) => Node.isCatchClause(a)) !== undefined) return; // error translation
      // a switch on a domain value compares it with each case's constant
      const read = Node.isSwitchStatement(n)
        ? (domainDeclOf(cond.getType()) !== undefined && !(Node.isPropertyAccessExpression(cond) && MECHANISM_FIELD.test(cond.getName())) && n.getClauses().some((c) => Node.isCaseClause(c) && isConstant(c.getExpression())) ? short(cond) : undefined)
        : domainRead(cond);
      if (read === undefined) return;
      const equalityOnly = ![cond, ...cond.getDescendants()].some((x) => (Node.isBinaryExpression(x) && RELATIONAL.has(x.getOperatorToken().getKind())) || Node.isCallExpression(x));
      for (const [b, stmt] of branches) {
        const e = branchEffect(b, stmt);
        if (e === undefined || (e.http && equalityOnly)) continue; // an equality mapped to an HTTP status is translation
        const line = n.getStartLineNumber();
        if (!seen.has(line)) { seen.add(line); adapterRules.push({ file: f, line, unit: unitName(n), cond: cond.getText().replace(/\s+/g, ' ').slice(0, 100), reads: read, effect: e.effect }); }
        break;
      }
    });
  }
  bump('adapterRules', adapterRules.length);

  // ── MIRRORS_VENDOR (CN-04 H11) ──────────────────────────────────────────────────────────────────────────────────
  // Domain, application or port code re-declares a vendor SDK's vocabulary without importing it. The vendor types are
  // the exports of every external package (a non-relative specifier resolved to a declaration outside the tree: an
  // ambient `declare module`, a `.d.ts` under node_modules or through tsconfig paths) that an adapter of the tree
  // imports. A core type alias, enum, interface or const object or array mirrors one when all its string-literal
  // values (at least 2) or all its property names (at least 3, `id` aside) are found in one vendor type. A string-
  // literal union in a property of an interface or object alias counts as its own type (`Payment.declineCode`).
  // CN-04 decision: a value set may hold at most one value outside the vendor type, and only a generic catch-all
  // (other, unknown, none, default, unspecified; any case) next to at least 2 vendor values: a vendor code set plus one
  // catch-all is still the vendor's vocabulary.
  const CATCH_ALL = /^(other|unknown|none|default|unspecified)$/i;
  const mirrors: MirrorFact[] = [];
  interface Vocab { readonly name: string; readonly module: string; readonly literals: Set<string>; readonly names: Set<string> }
  const vocabs: Vocab[] = [];
  const literalsIn = (t: Type, out: Set<string>, depth: number): void => {
    if (t.isStringLiteral()) { out.add(String(t.getLiteralValue())); return; }
    if (t.isUnion()) { for (const u of t.getUnionTypes()) literalsIn(u, out, depth); return; }
    if (t.isArray()) { const e = t.getArrayElementType(); if (e) literalsIn(e, out, depth); return; }
    if (depth >= 2 || !t.isObject() || t.getCallSignatures().length > 0) return;
    for (const p of t.getProperties()) { const vd = p.getValueDeclaration() ?? p.getDeclarations()[0]; if (vd !== undefined) literalsIn(vd.getType(), out, depth + 1); }
  };
  const seenModules = new Set<string>();
  for (const sf of files) {
    if (spec.roleOf(fileOf(sf)) !== 'adapter') continue;
    for (const imp of sf.getImportDeclarations()) {
      const ms = imp.getModuleSpecifierValue();
      if (ms.startsWith('.') || ms.startsWith('/') || ms.startsWith('node:')) continue;
      const msym = imp.getModuleSpecifier().getSymbol();
      const mdecl = msym?.getDeclarations().find((d) => externalModuleOf(d) !== null);
      if (msym === undefined || mdecl === undefined) continue;
      const mod = Node.isModuleDeclaration(mdecl) ? mdecl.getName().replace(/^['"]|['"]$/g, '') : externalModuleOf(mdecl)!;
      if (seenModules.has(mod)) continue;
      seenModules.add(mod);
      for (const ex of msym.getExports()) {
        for (const d of ex.getDeclarations()) {
          const literals = new Set<string>(); const names = new Set<string>();
          if (Node.isEnumDeclaration(d)) { for (const m of d.getMembers()) { const v = m.getValue(); if (typeof v === 'string') literals.add(v); names.add(m.getName()); } }
          else if (Node.isInterfaceDeclaration(d) || Node.isClassDeclaration(d) || Node.isTypeAliasDeclaration(d)) {
            const t = d.getType();
            literalsIn(t, literals, 0);
            if (t.isObject() && t.getCallSignatures().length === 0) for (const p of t.getProperties()) names.add(p.getName());
          } else continue;
          vocabs.push({ name: ex.getName(), module: mod, literals, names });
        }
      }
    }
  }
  bump('vendorTypes', vocabs.length);
  const pureLiterals = (t: Type): string[] | undefined => {
    const parts = (t.isUnion() ? t.getUnionTypes() : [t]).filter((p) => !p.isUndefined() && !p.isNull()); // an optional field
    return parts.length >= 2 && parts.every((p) => p.isStringLiteral()) ? parts.map((p) => String(p.getLiteralValue())) : undefined;
  };
  const unwrap = (e: Node): Node => { let x = e; while (Node.isAsExpression(x) || Node.isSatisfiesExpression(x) || Node.isParenthesizedExpression(x)) x = x.getExpression(); return x; };
  const strings = (xs: Node[]): string[] | undefined => (xs.length >= 2 && xs.every((x) => Node.isStringLiteral(x) || Node.isNoSubstitutionTemplateLiteral(x)) ? xs.map((x) => (x as import('ts-morph').StringLiteral).getLiteralValue()) : undefined);
  for (const sf of vocabs.length > 0 ? files : []) {
    const f = fileOf(sf);
    const role = spec.roleOf(f);
    if (role !== 'domain' && role !== 'application' && role !== 'port') continue;
    const cands: { core: string; line: number; values?: string[]; names?: string[] }[] = [];
    const objectCands = (core: string, line: number, props: { name: string; type: Type; line: number }[]): void => {
      cands.push({ core, line, names: props.map((p) => p.name) });
      for (const p of props) { const v = pureLiterals(p.type); if (v) cands.push({ core: `${core}.${p.name}`, line: p.line, values: v }); }
    };
    for (const a of sf.getTypeAliases()) {
      const t = a.getType();
      const v = pureLiterals(t);
      if (v) cands.push({ core: a.getName(), line: a.getStartLineNumber(), values: v });
      else if (t.isObject() && !t.isArray() && t.getCallSignatures().length === 0) objectCands(a.getName(), a.getStartLineNumber(), t.getProperties().map((p) => { const vd = p.getValueDeclaration() ?? p.getDeclarations()[0]; return { name: p.getName(), type: vd?.getType() ?? t, line: vd?.getStartLineNumber() ?? a.getStartLineNumber() }; }));
    }
    for (const i of sf.getInterfaces()) objectCands(i.getName(), i.getStartLineNumber(), i.getProperties().map((p) => ({ name: p.getName(), type: p.getType(), line: p.getStartLineNumber() })));
    for (const en of sf.getEnums()) {
      const vals = en.getMembers().map((m) => m.getValue());
      if (vals.length >= 2 && vals.every((v) => typeof v === 'string')) cands.push({ core: en.getName(), line: en.getStartLineNumber(), values: vals as string[] });
    }
    for (const vd of sf.getVariableDeclarations()) {
      const init = vd.getVariableStatement()?.getDeclarationKind() === 'const' ? vd.getInitializer() : undefined;
      if (init === undefined) continue;
      const e = unwrap(init);
      if (Node.isArrayLiteralExpression(e)) { const v = strings(e.getElements().map(unwrap)); if (v) cands.push({ core: vd.getName(), line: vd.getStartLineNumber(), values: v }); }
      else if (Node.isObjectLiteralExpression(e)) {
        const ps = e.getProperties();
        if (!ps.every((p) => Node.isPropertyAssignment(p))) continue;
        const v = strings(ps.map((p) => unwrap((p as import('ts-morph').PropertyAssignment).getInitializerOrThrow())));
        if (v) cands.push({ core: vd.getName(), line: vd.getStartLineNumber(), values: v });
        cands.push({ core: vd.getName(), line: vd.getStartLineNumber(), names: ps.map((p) => (p as import('ts-morph').PropertyAssignment).getName().replace(/^['"]|['"]$/g, '')) });
      }
    }
    for (const c of cands) {
      const names = c.names?.filter((x) => x !== 'id');
      let hit: { v: Vocab; form: MirrorFact['form']; items: string[]; catchAll?: string } | undefined;
      for (const v of vocabs) {
        if (c.values !== undefined) {
          const inVendor = c.values.filter((x) => v.literals.has(x));
          const extra = c.values.filter((x) => !v.literals.has(x));
          if (inVendor.length >= 2 && (extra.length === 0 || (extra.length === 1 && CATCH_ALL.test(extra[0]!)))) { hit = { v, form: 'values', items: inVendor, ...(extra.length === 1 ? { catchAll: extra[0]! } : {}) }; break; }
        }
        if (names !== undefined && names.length >= 3 && names.every((x) => v.names.has(x))) { hit = { v, form: 'names', items: names }; break; }
      }
      if (hit === undefined) continue;
      mirrors.push({ file: f, line: c.line, role, core: c.core, vendor: hit.v.name, module: hit.v.module, form: hit.form, detail: `${hit.form === 'values' ? 'values' : 'fields'} ${hit.items.map((x) => `'${x}'`).join(', ')}${hit.catchAll !== undefined ? ` (plus the catch-all '${hit.catchAll}')` : ''}` });
    }
  }
  bump('mirrors', mirrors.length);

  return {
    roots: [...rootDecls.values()], rootSource, commands, guards, invariantSites, locks, calcs, refs, adapterImports, transports, domainTech, repoMulti, contracts, portMechanisms, injections,
    locators, coreIo, entityOut, adapterRules, mirrors, remoteInTx: dedupe(remoteInTx, (r) => `${r.file}:${r.line}:${r.remote}`), stats,
  };
}

function dedupe<T>(xs: readonly T[], key: (x: T) => string): T[] {
  const m = new Map<string, T>();
  for (const x of xs) if (!m.has(key(x))) m.set(key(x), x);
  return [...m.values()];
}
