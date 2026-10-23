/**
 * COMPREHEND-01 (v1.5-exp) graph index for the four comprehension tools (`context_map`, `who_writes`, `trace`,
 * `impact`). Design: `ops/notes/comprehend-01-design.md` §4. Symbolic, read-only, zero model calls.
 *
 * Two parts, both over the tree's tsconfig:
 *   - the DETECT-02 facts (`../../lib/facts.ts`, imported read-only): roots and their owners, commands and their
 *     write footprints, the spec's roles and contexts;
 *   - a call graph and an import graph built here in one more ts-morph pass. Units and call resolution follow
 *     `facts.ts` (by resolved symbol: a call on an interface member goes to every in-tree implementation, a class or an
 *     object literal typed by the interface), so `trace` crosses ports to adapters the same way the write footprint does.
 * Reads are calls on a store-like owner (a spec `repositories` file, a port or an adapter) whose return type mentions a
 * root; writes are the write sites of the footprint facts.
 *
 * GRAPH-SCALE (U1 groundwork, 2026-10-23; `aidlc-docs/construction/v1.5/u1-graph-scale-plan.md`) adds, in this index
 * only (the DETECT-02 rules still read `facts.ts` unchanged):
 *   (a) factory units: a module-level `const x = factory(…, () => …)` (a step, workflow, registry or provider factory
 *       taking a function literal) is the unit `x`, and a call to `x(…)` resolves to it;
 *   (b) receiver-aware calls: a call to an overloaded method resolves to its implementation, and every call to an
 *       in-tree member records the receiver's static type (`memberCalls`), so an inherited base-repository member called
 *       on `SubscriberRepository` is told apart from the same member called on `JobRepository`;
 *   (c) a type registry (bases, implementations, member signatures) for `callers`;
 *   (d) inferred entities (`entities.ts`) for `who_writes` on code without declared aggregates;
 *   (e) inline `import('./X').X` types in the import graph (`../../lib/import-types.ts`).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Node, Project } from 'ts-morph';
import type { CallExpression, ClassDeclaration, InterfaceDeclaration, NewExpression, SourceFile } from 'ts-morph';
import { computeFacts, typeDecls, externalModuleOf } from '../../lib/facts.js';
import type { Facts } from '../../lib/facts.js';
import { writeTsconfig } from '../../lib/graph.js';
import { importTypeEdges } from '../../lib/import-types.js';
import { inferEntities } from './entities.js';
import type { EntityInfo } from './entities.js';
import { findSpec, globMatch, loadSpec } from '../../lib/spec.js';
import type { DetectSpec, Role } from '../../lib/spec.js';

export interface UnitInfo {
  readonly id: string; readonly name: string; readonly file: string; readonly line: number; readonly owner: string | null; readonly role: Role;
}
export interface CallEdge {
  readonly from: string; readonly to: string; readonly file: string; readonly line: number;
  /** How the call reaches `to`: a direct call, or through an interface member (a port) to its implementation. */
  readonly via: 'direct' | 'interface';
  /** The interface member crossed (`Port.method`), when `via` is `interface`. */
  readonly port?: string;
  /** (b) The receiver's static type (`file#Type`), when the member called is declared on another (base) type. */
  readonly receiver?: string;
}
/** (b) One call to an in-tree class or interface member, whatever unit it reaches (or none). */
export interface MemberCall {
  readonly unit: string; readonly file: string; readonly line: number;
  /** `Owner.member`, as declared (the overload with a body, when there is one). */
  readonly member: string;
  /** `file#Owner` of the declaring class or interface. */
  readonly owner: string;
  /** `file#Type` of the receiver's static type (a class or interface in the tree), when it can be read. */
  readonly receiver?: string;
}
export interface MemberSig { readonly name: string; readonly params: number; readonly returnsNothing: boolean; readonly line: number }
/** (c) An in-tree class or interface. */
export interface TypeInfo {
  readonly key: string; readonly name: string; readonly file: string; readonly line: number; readonly kind: 'class' | 'interface';
  /** Extended classes or interfaces (`file#Name`). */
  readonly bases: readonly string[];
  /** Implemented interfaces (`file#Name`), for classes. */
  readonly implements: readonly string[];
  readonly members: readonly MemberSig[];
}
export interface ReadSite { readonly unit: string; readonly file: string; readonly line: number; readonly method: string; readonly roots: readonly string[] }
export interface ExternalSite { readonly unit: string; readonly file: string; readonly line: number; readonly module: string; readonly call: string }
export interface UnresolvedSite { readonly unit: string; readonly file: string; readonly line: number; readonly call: string; readonly reason: string }

export interface ComprehendIndex {
  readonly root: string;
  /** The spec file read (absolute), if any. */
  readonly specPath: string | undefined;
  readonly spec: DetectSpec;
  readonly facts: Facts;
  readonly units: ReadonlyMap<string, UnitInfo>;
  /** Outgoing call edges per unit id, in source order. */
  readonly calls: ReadonlyMap<string, readonly CallEdge[]>;
  readonly reads: ReadonlyMap<string, readonly ReadSite[]>;
  readonly externals: ReadonlyMap<string, readonly ExternalSite[]>;
  readonly unresolved: ReadonlyMap<string, readonly UnresolvedSite[]>;
  /** (b) Every call to an in-tree member, in source order per unit. */
  readonly memberCalls: readonly MemberCall[];
  /** (c) In-tree classes and interfaces by `file#Name`. */
  readonly types: ReadonlyMap<string, TypeInfo>;
  /** (d) Entity-like types inferred from the code (always labelled with their evidence). */
  readonly entities: readonly EntityInfo[];
  /** (e) How many import-graph edges come only from inline `import('…')` types. */
  readonly importTypeEdges: number;
  /** Production files (project-relative) and their in-tree imports (resolved), and the reverse. */
  readonly files: readonly string[];
  readonly imports: ReadonlyMap<string, readonly string[]>;
  readonly importedBy: ReadonlyMap<string, readonly string[]>;
  /** Exported top-level declarations per file: name → line. */
  readonly declarations: ReadonlyMap<string, ReadonlyMap<string, number>>;
  /** Files that reference each `file#Name` declaration (by symbol), excluding its own file. */
  referencesOf(file: string, name: string): readonly string[];
  readonly buildMs: number;
}

const rel = (root: string, abs: string): string => path.relative(root, abs).split(path.sep).join('/');
const isTestFile = (f: string): boolean => /\.(spec|test)\.ts$/.test(f) || /(^|\/)(__tests__|tests?)\//.test(f);

/**
 * (a) The call that makes a factory unit: the initializer (through `as`, `satisfies`, `!` and parentheses) is a call or
 * `new` whose chain (`createStep(…).config(…)`) passes a function literal as a direct argument somewhere.
 */
export function factoryCall(init: Node | undefined): Node | undefined {
  let x = init;
  while (x !== undefined && (Node.isAsExpression(x) || Node.isSatisfiesExpression(x) || Node.isParenthesizedExpression(x) || Node.isNonNullExpression(x))) x = x.getExpression();
  if (x === undefined || (!Node.isCallExpression(x) && !Node.isNewExpression(x))) return undefined;
  for (let c: Node | undefined = x; c !== undefined && (Node.isCallExpression(c) || Node.isNewExpression(c));) {
    if ((c.getArguments() as Node[]).some((a) => Node.isArrowFunction(a) || Node.isFunctionExpression(a))) return x;
    const e: Node = c.getExpression();
    c = Node.isPropertyAccessExpression(e) ? e.getExpression() : undefined;
  }
  return undefined;
}

export interface IndexOptions { readonly spec?: string | undefined; readonly tsconfig?: string | undefined; readonly scratch?: string | undefined }

export function buildIndex(tree: string, opts: IndexOptions = {}): ComprehendIndex {
  const t0 = Date.now();
  const root = path.resolve(tree);
  const tsconfig = opts.tsconfig ?? writeTsconfig(root, opts.scratch ?? fs.mkdtempSync(path.join(os.tmpdir(), 'comprehend-')));
  const spec = loadSpec(root, opts.spec);
  const facts = computeFacts(root, tsconfig, spec);

  const project = new Project({ tsConfigFilePath: tsconfig, skipAddingFilesFromTsConfig: false });
  const inRoot = (sf: SourceFile): boolean => {
    const p = sf.getFilePath();
    return !sf.isDeclarationFile() && !p.includes('/node_modules/') && (p + '/').startsWith(root + '/') && !rel(root, p).startsWith('..');
  };
  const sources = project.getSourceFiles().filter((sf) => inRoot(sf) && !isTestFile(rel(root, sf.getFilePath())));
  const fileOf = (n: Node): string => rel(root, n.getSourceFile().getFilePath());
  const inTree = (n: Node): boolean => inRoot(n.getSourceFile());

  // ── Units (as facts.ts) ───────────────────────────────────────────────────────────────────────────────────────
  const unitNode = new Map<Node, UnitInfo>();
  const ownerName = (n: Node): string | null => {
    const c = n.getFirstAncestor((a) => Node.isClassDeclaration(a));
    return c && Node.isClassDeclaration(c) ? c.getName() ?? null : null;
  };
  const addUnit = (n: Node, name: string): void => {
    const file = fileOf(n);
    unitNode.set(n, { id: `${file}#${name}`, name, file, line: n.getStartLineNumber(), owner: ownerName(n), role: spec.roleOf(file) });
  };
  for (const sf of sources) {
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
    // (a) Factory units: a module-level declaration (or a class property) initialised by a call that takes a function
    // literal. The whole call is the unit, so every callback passed to the factory belongs to it.
    for (const v of sf.getVariableDeclarations()) { const fi = factoryCall(v.getInitializer()); if (fi) addUnit(fi, v.getName()); }
    for (const cls of sf.getClasses()) for (const p of cls.getProperties()) { const fi = factoryCall(p.getInitializer()); if (fi) addUnit(fi, `${cls.getName() ?? 'anonymous'}.${p.getName()}`); }
    sf.forEachDescendant((d) => {
      if (Node.isPropertyAssignment(d)) {
        const init = d.getInitializer();
        if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) addUnit(init, `{}.${d.getName()}`);
      } else if (Node.isMethodDeclaration(d) && Node.isObjectLiteralExpression(d.getParent())) {
        addUnit(d, `{}.${d.getName()}`);
      } else if (Node.isVariableDeclaration(d)) {
        const init = d.getInitializer();
        if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) addUnit(init, d.getName());
      }
    });
  }
  // Duplicate ids (overloads, two `{}.x` literals in a file) get a line suffix so every unit stays addressable.
  const seenIds = new Map<string, number>();
  for (const [n, u] of [...unitNode]) {
    const k = seenIds.get(u.id) ?? 0;
    seenIds.set(u.id, k + 1);
    if (k > 0) unitNode.set(n, { ...u, id: `${u.id}@${u.line}` });
  }

  const bodyNodes = (n: Node): Node[] => {
    const out: Node[] = [];
    const walk = (x: Node): void => { for (const c of x.getChildren()) { if (unitNode.has(c)) continue; out.push(c); walk(c); } };
    walk(n);
    return out;
  };

  // ── Implementations of interface members (as facts.ts) ──────────────────────────────────────────────────────
  const impls = new Map<Node, Node[]>();
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
  for (const sf of sources) {
    for (const cls of sf.getClasses()) {
      const ifs: InterfaceDeclaration[] = [];
      for (const h of cls.getImplements()) for (const d of h.getType().getSymbol()?.getDeclarations() ?? []) if (Node.isInterfaceDeclaration(d)) ifs.push(d);
      const base = cls.getBaseClass();
      if (base) for (const m of base.getMethods()) if (m.isAbstract()) { const sub = cls.getMethod(m.getName()); if (sub) addImpl(m, sub); }
      for (const i of ifs) {
        for (const m of cls.getMethods()) for (const im of interfaceMembers(i, m.getName())) addImpl(im, m);
        for (const p of cls.getProperties()) { const init = p.getInitializer(); if (init && unitNode.has(init)) for (const im of interfaceMembers(i, p.getName())) addImpl(im, init); }
      }
    }
    sf.forEachDescendant((d) => {
      if (!Node.isObjectLiteralExpression(d)) return;
      const ct = d.getContextualType();
      if (!ct) return;
      const decls = new Set<Node>(); typeDecls(ct, decls);
      for (const i of decls) {
        if (!Node.isInterfaceDeclaration(i)) continue;
        for (const p of d.getProperties()) {
          let name: string | undefined; let unit: Node | undefined;
          if (Node.isPropertyAssignment(p)) { name = p.getName(); const init = p.getInitializer(); if (init && unitNode.has(init)) unit = init; }
          else if (Node.isMethodDeclaration(p)) { name = p.getName(); unit = p; }
          if (name && unit) for (const im of interfaceMembers(i, name)) addImpl(im, unit);
        }
      }
    });
  }

  const declOfCall = (call: CallExpression | NewExpression): Node | undefined => {
    const e = call.getExpression();
    const id = Node.isPropertyAccessExpression(e) ? e.getNameNode() : e;
    let s = id.getSymbol();
    if (s?.isAlias()) s = s.getAliasedSymbol() ?? s;
    const ds = s?.getDeclarations() ?? [];
    // (b) An overloaded method or function: the declaration with a body (the overload signatures are not units).
    const d = ds.find((x) => (Node.isMethodDeclaration(x) || Node.isFunctionDeclaration(x)) && x.getBody() !== undefined) ?? ds[0];
    if (Node.isNewExpression(call) && d && Node.isClassDeclaration(d)) { const ks = d.getConstructors(); return ks.find((k) => k.getBody() !== undefined) ?? ks[0] ?? d; }
    return d;
  };
  /** (b) The receiver's static type of a member call (`recv.member(…)`), as `file#Type` when it is in the tree. */
  const receiverOf = (call: CallExpression | NewExpression): string | undefined => {
    const e = call.getExpression();
    if (!Node.isPropertyAccessExpression(e)) return undefined;
    const t = e.getExpression().getType();
    for (const s of [t.getSymbol(), t.getApparentType().getSymbol()]) {
      for (const rd of s?.getDeclarations() ?? []) {
        if ((Node.isClassDeclaration(rd) || Node.isInterfaceDeclaration(rd)) && inTree(rd)) return `${fileOf(rd)}#${rd.getName() ?? 'anonymous'}`;
      }
    }
    return undefined;
  };
  const memberOwner = (d: Node): ClassDeclaration | InterfaceDeclaration | undefined => {
    const o = d.getFirstAncestor((a) => Node.isClassDeclaration(a) || Node.isInterfaceDeclaration(a));
    return o && (Node.isClassDeclaration(o) || Node.isInterfaceDeclaration(o)) ? o : undefined;
  };
  const declName = (d: Node): string => {
    const o = memberOwner(d);
    const n = (d as unknown as { getName?: () => string }).getName?.() ?? (Node.isConstructorDeclaration(d) ? 'constructor' : '?');
    return o && o !== d ? `${o.getName() ?? '?'}.${n}` : n;
  };

  // ── Roots, for reads ────────────────────────────────────────────────────────────────────────────────────────
  const rootFiles = new Map<string, string>(facts.roots.map((r) => [`${r.file}#${r.name}`, r.name] as const));
  const rootNamesIn = (t: import('ts-morph').Type): string[] => {
    const ds = new Set<Node>(); typeDecls(t, ds);
    const out: string[] = [];
    for (const d of ds) {
      if (!inTree(d)) continue;
      const n = (d as unknown as { getName?: () => string }).getName?.();
      const r = n !== undefined ? rootFiles.get(`${fileOf(d)}#${n}`) : undefined;
      if (r !== undefined && !out.includes(r)) out.push(r);
    }
    return out;
  };
  const storeLike = (o: ClassDeclaration | InterfaceDeclaration): boolean => {
    const f = fileOf(o);
    if (spec.repositories.length > 0 && globMatch(spec.repositories, f)) return true;
    const r = spec.roleOf(f);
    return r === 'port' || r === 'adapter' || (r === 'domain' && Node.isInterfaceDeclaration(o));
  };

  // ── Calls, reads, external IO ─────────────────────────────────────────────────────────────────────────────────
  const calls = new Map<string, CallEdge[]>();
  const reads = new Map<string, ReadSite[]>();
  const externals = new Map<string, ExternalSite[]>();
  const unresolved = new Map<string, UnresolvedSite[]>();
  const memberCalls: MemberCall[] = [];
  const push = <T>(m: Map<string, T[]>, k: string, v: T): void => { const l = m.get(k); if (l) l.push(v); else m.set(k, [v]); };
  for (const [node, u] of unitNode) {
    for (const n of bodyNodes(node)) {
      if (!Node.isCallExpression(n) && !Node.isNewExpression(n)) continue;
      const line = n.getStartLineNumber();
      const d = declOfCall(n);
      if (d === undefined) {
        // Only report calls that look like they target project code (a member call on `this.x` or a local).
        const txt = n.getExpression().getText().replace(/\s+/g, '');
        // One entry per line: a chain (`this.client.putItem(x).promise()`) reports its innermost call only.
        if (/^this\./.test(txt) && !(unresolved.get(u.id) ?? []).some((x) => x.line === line)) {
          const inner = txt.replace(/\(.*$/, '');
          push(unresolved, u.id, { unit: u.id, file: u.file, line, call: inner, reason: 'the callee has no resolved declaration (a missing type or an untyped dependency)' });
        }
        continue;
      }
      const mod = externalModuleOf(d);
      if (mod !== null) { push(externals, u.id, { unit: u.id, file: u.file, line, module: mod, call: declName(d) }); continue; }
      if (!inTree(d)) continue;
      const mo = memberOwner(d);
      let receiver: string | undefined;
      if (mo && mo !== d) {
        receiver = receiverOf(n);
        const owner = `${fileOf(mo)}#${mo.getName() ?? 'anonymous'}`;
        memberCalls.push({ unit: u.id, file: u.file, line, member: declName(d), owner, ...(receiver !== undefined ? { receiver } : {}) });
        if (receiver === owner) receiver = undefined;
      }
      // Reads: a store-like owner's method that returns something mentioning a root.
      if (Node.isMethodSignature(d) || Node.isMethodDeclaration(d)) {
        const o = memberOwner(d);
        // A static helper (a mapper, a factory) holds no storage: never a read (as DETECT-02 revision R2 for writes).
        const isStatic = Node.isMethodDeclaration(d) && d.isStatic();
        if (o && !isStatic && storeLike(o) && !rootFiles.has(`${fileOf(o)}#${o.getName() ?? ''}`)) {
          let rt = d.getReturnType();
          if (rt.getSymbol()?.getName() === 'Promise') rt = rt.getTypeArguments()[0] ?? rt;
          const rs = rootNamesIn(rt);
          if (rs.length > 0) push(reads, u.id, { unit: u.id, file: u.file, line, method: declName(d), roots: rs });
        }
      }
      // Targets: the unit itself, its initializer, or the implementations of an interface (or abstract) member.
      let targets: Node[] = [];
      let via: CallEdge['via'] = 'direct';
      if (unitNode.has(d)) targets = [d];
      else if (Node.isPropertyAssignment(d) || Node.isVariableDeclaration(d) || Node.isPropertyDeclaration(d)) {
        const init = d.getInitializer(); if (init && unitNode.has(init)) targets = [init];
      }
      const im = impls.get(d);
      if (im && im.length > 0) {
        const own = targets.length > 0 && !(Node.isMethodDeclaration(d) && d.isAbstract());
        if (!own) { targets = im.filter((x) => unitNode.has(x)); via = 'interface'; }
      }
      const port = via === 'interface' ? declName(d) : undefined;
      if (targets.length === 0 && (Node.isMethodSignature(d) || Node.isPropertySignature(d))) {
        push(unresolved, u.id, { unit: u.id, file: u.file, line, call: declName(d), reason: 'an interface member with no in-tree implementation' });
      }
      for (const t of targets) {
        const tu = unitNode.get(t)!;
        if (tu.id === u.id) continue;
        push(calls, u.id, { from: u.id, to: tu.id, file: u.file, line, via, ...(port !== undefined ? { port } : {}), ...(receiver !== undefined ? { receiver } : {}) });
      }
    }
  }

  // ── Imports ─────────────────────────────────────────────────────────────────────────────────────────────────
  const files = sources.map((sf) => rel(root, sf.getFilePath())).sort();
  const fileSet = new Set(files);
  const imports = new Map<string, string[]>();
  const importedBy = new Map<string, string[]>();
  const declarations = new Map<string, Map<string, number>>();
  // (e) Inline `import('…')` types: the frozen import declarations miss them.
  const importTypesBySource = new Map<string, Set<string>>();
  for (const e of importTypeEdges(root, tsconfig, sources.map((sf) => sf.getFilePath()))) {
    const s = importTypesBySource.get(e.source) ?? new Set<string>(); s.add(e.target); importTypesBySource.set(e.source, s);
  }
  let importTypeOnly = 0;
  for (const sf of sources) {
    const f = rel(root, sf.getFilePath());
    const targets = new Set<string>();
    for (const d of [...sf.getImportDeclarations(), ...sf.getExportDeclarations()]) {
      const t = d.getModuleSpecifierSourceFile();
      if (t) { const tf = rel(root, t.getFilePath()); if (fileSet.has(tf) && tf !== f) targets.add(tf); }
    }
    for (const t of importTypesBySource.get(f) ?? []) if (fileSet.has(t) && !targets.has(t)) { targets.add(t); importTypeOnly++; }
    imports.set(f, [...targets].sort());
    for (const t of targets) importedBy.set(t, [...(importedBy.get(t) ?? []), f]);
    const decls = new Map<string, number>();
    for (const [name, ds] of sf.getExportedDeclarations()) for (const d of ds) if (inTree(d) && fileOf(d) === f) decls.set(name, d.getStartLineNumber());
    for (const c of sf.getClasses()) if (c.getName()) decls.set(c.getName()!, c.getStartLineNumber());
    for (const i of sf.getInterfaces()) decls.set(i.getName(), i.getStartLineNumber());
    declarations.set(f, decls);
  }
  for (const [k, v] of importedBy) importedBy.set(k, [...new Set(v)].sort());

  const refCache = new Map<string, string[]>();
  const referencesOf = (file: string, name: string): string[] => {
    const key = `${file}#${name}`;
    const hit = refCache.get(key);
    if (hit) return hit;
    const sf = project.getSourceFile(path.join(root, file));
    const decl = sf?.getClass(name) ?? sf?.getInterface(name) ?? sf?.getFunction(name) ?? sf?.getTypeAlias(name) ?? sf?.getVariableDeclaration(name) ?? sf?.getEnum(name);
    const out = new Set<string>();
    const nameNode = decl ? (decl as unknown as { getNameNode?: () => Node }).getNameNode?.() : undefined;
    if (nameNode && Node.isIdentifier(nameNode)) {
      for (const r of nameNode.findReferencesAsNodes()) {
        if (!inTree(r)) continue;
        const f = fileOf(r);
        if (f !== file && fileSet.has(f)) out.add(f);
      }
    }
    const res = [...out].sort();
    refCache.set(key, res);
    return res;
  };

  // ── (c) Type registry ───────────────────────────────────────────────────────────────────────────────────────
  const keyOf = (d: Node): string | undefined => ((Node.isClassDeclaration(d) || Node.isInterfaceDeclaration(d)) && inTree(d) ? `${fileOf(d)}#${d.getName() ?? 'anonymous'}` : undefined);
  const sigOf = (m: Node, name: string): MemberSig => {
    let params = 0; let rt: import('ts-morph').Type | undefined;
    if (Node.isMethodDeclaration(m) || Node.isMethodSignature(m)) { params = m.getParameters().length; rt = m.getReturnType(); }
    else if (Node.isPropertyDeclaration(m) || Node.isPropertySignature(m)) {
      const sig = m.getType().getCallSignatures()[0];
      if (sig) { params = sig.getParameters().length; rt = sig.getReturnType(); }
    }
    if (rt?.getSymbol()?.getName() === 'Promise') rt = rt.getTypeArguments()[0] ?? rt;
    return { name, params, returnsNothing: rt !== undefined && (rt.isVoid() || rt.isUndefined()), line: m.getStartLineNumber() };
  };
  const types = new Map<string, TypeInfo>();
  for (const sf of sources) {
    for (const d of [...sf.getClasses(), ...sf.getInterfaces()]) {
      const key = keyOf(d)!;
      const bases: string[] = []; const impl: string[] = []; const members: MemberSig[] = [];
      const seenM = new Set<string>();
      const addM = (m: Node, name: string): void => {
        // Overloads: keep the declaration with a body (or the first signature).
        if (seenM.has(name)) { if ((Node.isMethodDeclaration(m) && m.getBody() !== undefined)) { const i = members.findIndex((x) => x.name === name); members[i] = sigOf(m, name); } return; }
        seenM.add(name); members.push(sigOf(m, name));
      };
      if (Node.isClassDeclaration(d)) {
        const b = d.getBaseClass(); const bk = b ? keyOf(b) : undefined; if (bk) bases.push(bk);
        for (const h of d.getImplements()) for (const x of h.getType().getSymbol()?.getDeclarations() ?? []) { const k = keyOf(x); if (k && !impl.includes(k)) impl.push(k); }
        for (const m of d.getMethods()) if (!m.isStatic()) addM(m, m.getName());
        for (const p of d.getProperties()) if (!p.isStatic()) addM(p, p.getName());
      } else {
        for (const b of d.getBaseDeclarations()) { const k = keyOf(b); if (k && !bases.includes(k)) bases.push(k); }
        for (const m of d.getMethods()) addM(m, m.getName());
        for (const p of d.getProperties()) addM(p, p.getName());
      }
      types.set(key, { key, name: d.getName() ?? 'anonymous', file: fileOf(d), line: d.getStartLineNumber(), kind: Node.isClassDeclaration(d) ? 'class' : 'interface', bases, implements: impl, members });
    }
  }

  const units = new Map<string, UnitInfo>();
  for (const u of unitNode.values()) units.set(u.id, u);
  const entities = inferEntities({ root, sources, spec, types, inTree, fileOf });
  return {
    root, specPath: findSpec(root, opts.spec), spec, facts, units, calls, reads, externals, unresolved, memberCalls, types, entities,
    importTypeEdges: importTypeOnly, files, imports, importedBy, declarations, referencesOf, buildMs: Date.now() - t0,
  };
}

/** One index per (tree, spec, tsconfig), kept for the server's lifetime: the first call pays the build. */
const cache = new Map<string, ComprehendIndex>();
export function cachedIndex(tree: string, opts: IndexOptions = {}): { index: ComprehendIndex; cached: boolean } {
  const key = [path.resolve(tree), opts.spec ?? '', opts.tsconfig ?? ''].join('\u0000');
  const hit = cache.get(key);
  if (hit) return { index: hit, cached: true };
  const index = buildIndex(tree, opts);
  cache.set(key, index);
  return { index, cached: false };
}
export function clearIndexCache(): void { cache.clear(); }
