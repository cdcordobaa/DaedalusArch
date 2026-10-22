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
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Node, Project } from 'ts-morph';
import type { CallExpression, ClassDeclaration, InterfaceDeclaration, NewExpression, SourceFile } from 'ts-morph';
import { computeFacts, typeDecls, externalModuleOf } from '../../lib/facts.js';
import type { Facts } from '../../lib/facts.js';
import { writeTsconfig } from '../../lib/graph.js';
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
    const d = s?.getDeclarations()[0];
    if (Node.isNewExpression(call) && d && Node.isClassDeclaration(d)) return d.getConstructors()[0] ?? d;
    return d;
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
  const push = <T>(m: Map<string, T[]>, k: string, v: T): void => { m.set(k, [...(m.get(k) ?? []), v]); };
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
        push(calls, u.id, { from: u.id, to: tu.id, file: u.file, line, via, ...(port !== undefined ? { port } : {}) });
      }
    }
  }

  // ── Imports ─────────────────────────────────────────────────────────────────────────────────────────────────
  const files = sources.map((sf) => rel(root, sf.getFilePath())).sort();
  const fileSet = new Set(files);
  const imports = new Map<string, string[]>();
  const importedBy = new Map<string, string[]>();
  const declarations = new Map<string, Map<string, number>>();
  for (const sf of sources) {
    const f = rel(root, sf.getFilePath());
    const targets = new Set<string>();
    for (const d of [...sf.getImportDeclarations(), ...sf.getExportDeclarations()]) {
      const t = d.getModuleSpecifierSourceFile();
      if (t) { const tf = rel(root, t.getFilePath()); if (fileSet.has(tf) && tf !== f) targets.add(tf); }
    }
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

  const units = new Map<string, UnitInfo>();
  for (const u of unitNode.values()) units.set(u.id, u);
  return { root, specPath: findSpec(root, opts.spec), spec, facts, units, calls, reads, externals, unresolved, files, imports, importedBy, declarations, referencesOf, buildMs: Date.now() - t0 };
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
