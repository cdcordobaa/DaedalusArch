/**
 * REPO-SCOUT (v1.5-exp): compiler-based truth for global comprehension questions, independent of the DaedalusArch
 * graph. Zero model calls.
 *
 * The truth is the TypeScript language service, through ts-morph: find-all-references on a declaration
 * (`findReferencesAsNodes`), the checker's resolved symbol of a call (`getSymbol` + `getAliasedSymbol`), and
 * `getImplementations`. Nothing from `experiments/detect-02/` is imported here, so a graph fact is never truth.
 *
 * Three question kinds:
 *   - `callers`:  every call site of the named members of an interface or class (a port), grouped by the enclosing
 *                 named unit; with `members` omitted, every member. Also the files that reference the type at all.
 *   - `writers`:  `callers` restricted to mutating members (a regex over member names), i.e. every unit that writes
 *                 the entity behind the port.
 *   - `crossCalls`: every call expression in files matching `from` globs whose resolved declaration is in a file
 *                 matching `to` globs (the calls from one module into another), grouped by callee.
 *
 * A unit is named as the DETECT-02 index names it where one exists (`Class.method`, `Class.constructor`,
 * `Class.prop`, `fn`, `{}.prop`, `const name`), and otherwise as the nearest named declaration that encloses the call
 * (a `const x = factory(name, async () => …)` callback is unit `x`): `file#name`.
 */
import * as path from 'node:path';
import picomatch from 'picomatch';
import { Node, Project, SyntaxKind } from 'ts-morph';
import type { SourceFile } from 'ts-morph';

export interface CallersQ { readonly id: string; readonly kind: 'callers' | 'writers'; readonly question: string; readonly file: string; readonly type: string; readonly members?: readonly string[]; readonly memberPattern?: string; readonly scope?: readonly string[] }
export interface CrossQ { readonly id: string; readonly kind: 'crossCalls'; readonly question: string; readonly from: readonly string[]; readonly to: readonly string[]; readonly exclude?: readonly string[] }
export type Question = CallersQ | CrossQ;

export interface Site { readonly unit: string; readonly file: string; readonly line: number; readonly callee: string; readonly indexNamed: boolean }
export interface Truth {
  readonly id: string; readonly kind: Question['kind']; readonly question: string;
  readonly members: readonly string[];
  readonly sites: readonly Site[];
  readonly units: readonly string[];
  readonly files: readonly string[];
  /** For callers/writers: files referencing the type itself (type positions included), excluding its own file. */
  readonly typeRefFiles?: readonly string[];
  /** For callers/writers: in-tree implementations of the type. */
  readonly implementations?: readonly string[];
  readonly ms: number;
}

const rel = (root: string, abs: string): string => path.relative(root, abs).split(path.sep).join('/');
const isTest = (f: string): boolean => /\.(spec|test|e2e)\.tsx?$/.test(f) || /(^|\/)(__tests__|__mocks__|tests?|e2e|integration-tests)\//.test(f);

/** The enclosing unit of a node, named as the DETECT-02 index would, else by the nearest named declaration. */
export function unitOf(root: string, n: Node): { id: string; indexNamed: boolean } {
  const file = rel(root, n.getSourceFile().getFilePath());
  for (let a: Node | undefined = n.getParent(); a !== undefined; a = a.getParent()) {
    if (Node.isMethodDeclaration(a)) {
      const p = a.getParent();
      if (Node.isClassDeclaration(p) || Node.isClassExpression(p)) return { id: `${file}#${p.getName() ?? 'anonymous'}.${a.getName()}`, indexNamed: Node.isClassDeclaration(p) };
      if (Node.isObjectLiteralExpression(p)) return { id: `${file}#{}.${a.getName()}`, indexNamed: true };
    }
    if (Node.isConstructorDeclaration(a)) { const c = a.getParent(); if (Node.isClassDeclaration(c)) return { id: `${file}#${c.getName() ?? 'anonymous'}.constructor`, indexNamed: true }; }
    if (Node.isGetAccessorDeclaration(a) || Node.isSetAccessorDeclaration(a)) { const c = a.getParent(); if (Node.isClassDeclaration(c)) return { id: `${file}#${c.getName() ?? 'anonymous'}.${a.getName()}`, indexNamed: false }; }
    if (Node.isArrowFunction(a) || Node.isFunctionExpression(a)) {
      const p = a.getParent();
      if (Node.isPropertyDeclaration(p)) { const c = p.getParent(); if (Node.isClassDeclaration(c)) return { id: `${file}#${c.getName() ?? 'anonymous'}.${p.getName()}`, indexNamed: true }; }
      if (Node.isVariableDeclaration(p)) return { id: `${file}#${p.getName()}`, indexNamed: true };
      if (Node.isPropertyAssignment(p)) return { id: `${file}#{}.${p.getName()}`, indexNamed: true };
    }
    if (Node.isFunctionDeclaration(a) && a.getBody()) return { id: `${file}#${a.getName() ?? 'default'}`, indexNamed: true };
    // A module-level `const x = factory(…, async () => …)`: the callback belongs to `x`. A local variable is skipped.
    if (Node.isVariableDeclaration(a) && Node.isSourceFile(a.getVariableStatement()?.getParent() ?? a)) return { id: `${file}#${a.getName()}`, indexNamed: false };
    if (Node.isPropertyDeclaration(a)) { const c = a.getParent(); if (Node.isClassDeclaration(c)) return { id: `${file}#${c.getName() ?? 'anonymous'}.${a.getName()}`, indexNamed: false }; }
  }
  return { id: `${file}#<module>`, indexNamed: false };
}

export class TruthProject {
  readonly project: Project;
  readonly root: string;
  readonly sources: SourceFile[];
  constructor(root: string, tsconfig: string) {
    this.root = path.resolve(root);
    this.project = new Project({ tsConfigFilePath: tsconfig });
    this.sources = this.project.getSourceFiles().filter((sf) => this.inTree(sf));
  }
  inTree(sf: SourceFile): boolean {
    const p = sf.getFilePath();
    const r = rel(this.root, p);
    return !sf.isDeclarationFile() && !p.includes('/node_modules/') && !r.startsWith('..') && !isTest(r);
  }
  fileOf(n: Node): string { return rel(this.root, n.getSourceFile().getFilePath()); }
  /** Whether an expression's type is the class `name` or one of its subclasses. */
  receiverIs(expr: Node, name: string): boolean {
    const t = expr.getType();
    for (const d of t.getSymbol()?.getDeclarations() ?? []) {
      for (let c: Node | undefined = d, i = 0; c && Node.isClassDeclaration(c) && i < 6; c = c.getBaseClass(), i++) if (c.getName() === name) return true;
    }
    return false;
  }

  answer(q: Question): Truth {
    const t0 = Date.now();
    return q.kind === 'crossCalls' ? this.cross(q, t0) : this.callers(q, t0);
  }

  private callers(q: CallersQ, t0: number): Truth {
    const sf = this.project.getSourceFile(path.join(this.root, q.file));
    if (!sf) throw new Error(`${q.id}: no source file ${q.file}`);
    const decl = sf.getInterface(q.type) ?? sf.getClass(q.type) ?? sf.getTypeAlias(q.type);
    if (!decl) throw new Error(`${q.id}: no type ${q.type} in ${q.file}`);
    const re = q.memberPattern !== undefined ? new RegExp(q.memberPattern) : undefined;
    const memberNodes: Node[] = [];
    /** Members declared on a base class: their call sites count only when the receiver is typed by `q.type` or a subclass. */
    const inherited = new Set<Node>();
    const visit = (d: Node, seen: Set<Node>): void => {
      if (seen.has(d)) return; seen.add(d);
      if (Node.isInterfaceDeclaration(d)) {
        for (const m of [...d.getMethods(), ...d.getProperties()]) memberNodes.push(m);
        for (const b of d.getBaseDeclarations()) visit(b, seen);
      } else if (Node.isClassDeclaration(d)) {
        // Own members first; then inherited ones not overridden (a repository's `create` declared on its base class).
        const names = new Set(memberNodes.map((m) => (m as unknown as { getName(): string }).getName()));
        for (const m of [...d.getMethods(), ...d.getProperties()]) {
          if (m.hasModifier(SyntaxKind.PrivateKeyword) || m.hasModifier(SyntaxKind.ProtectedKeyword) || names.has(m.getName())) continue;
          memberNodes.push(m);
          if (d !== decl) inherited.add(m);
        }
        const b = d.getBaseClass();
        if (b) visit(b, seen);
      }
    };
    visit(decl, new Set());
    const scope = q.scope !== undefined ? picomatch([...q.scope]) : undefined;
    const chosen = memberNodes.filter((m) => {
      const n = (m as unknown as { getName(): string }).getName();
      return (q.members === undefined || q.members.includes(n)) && (re === undefined || re.test(n));
    });
    const sites: Site[] = [];
    const seen = new Set<string>();
    for (const m of chosen) {
      const nameNode = (m as unknown as { getNameNode(): Node }).getNameNode();
      const mname = (m as unknown as { getName(): string }).getName();
      for (const r of (nameNode as unknown as { findReferencesAsNodes(): Node[] }).findReferencesAsNodes()) {
        if (!this.inTree(r.getSourceFile())) continue;
        const f = this.fileOf(r);
        if (scope && !scope(f)) continue;
        // A call: `x.member(…)`, `x?.member(…)`, or `x['member'](…)`.
        const pa = r.getParent();
        const call = pa && (Node.isPropertyAccessExpression(pa) || Node.isElementAccessExpression(pa)) ? pa.getParent() : undefined;
        if (!call || !Node.isCallExpression(call) || call.getExpression() !== pa) continue;
        if (inherited.has(m) && !this.receiverIs((pa as unknown as { getExpression(): Node }).getExpression(), q.type)) continue;
        const u = unitOf(this.root, call);
        const k = `${f}:${call.getStartLineNumber()}:${mname}`;
        if (seen.has(k)) continue; seen.add(k);
        sites.push({ unit: u.id, file: f, line: call.getStartLineNumber(), callee: `${q.type}.${mname}`, indexNamed: u.indexNamed });
      }
    }
    const own = q.file;
    const typeRefFiles = new Set<string>();
    const nn = (decl as unknown as { getNameNode(): Node }).getNameNode();
    for (const r of (nn as unknown as { findReferencesAsNodes(): Node[] }).findReferencesAsNodes()) {
      if (!this.inTree(r.getSourceFile())) continue;
      const f = this.fileOf(r);
      if (f !== own) typeRefFiles.add(f);
    }
    const implementations = new Set<string>();
    for (const i of (nn as unknown as { getImplementations(): { getNode(): Node }[] }).getImplementations()) {
      const n = i.getNode();
      if (!this.inTree(n.getSourceFile())) continue;
      const c = n.getFirstAncestor((a) => Node.isClassDeclaration(a)) ?? n.getParent();
      const name = c && Node.isClassDeclaration(c) ? c.getName() ?? '?' : n.getText().slice(0, 40);
      implementations.add(`${this.fileOf(n)}#${name}`);
    }
    return this.pack(q, chosen.map((m) => (m as unknown as { getName(): string }).getName()), sites, t0, { typeRefFiles: [...typeRefFiles].sort(), implementations: [...implementations].sort() });
  }

  private cross(q: CrossQ, t0: number): Truth {
    const from = picomatch([...q.from]);
    const to = picomatch([...q.to]);
    const ex = q.exclude !== undefined ? picomatch([...q.exclude]) : (): boolean => false;
    const sites: Site[] = [];
    for (const sf of this.sources) {
      const f = this.fileOf(sf);
      if (!from(f) || ex(f)) continue;
      sf.forEachDescendant((n) => {
        if (!Node.isCallExpression(n) && !Node.isNewExpression(n)) return;
        const e = n.getExpression();
        const id = Node.isPropertyAccessExpression(e) ? e.getNameNode() : e;
        let s = id.getSymbol();
        if (s?.isAlias()) s = s.getAliasedSymbol() ?? s;
        const d = s?.getDeclarations()[0];
        if (!d || !this.inTree(d.getSourceFile())) return;
        const tf = this.fileOf(d);
        if (!to(tf) || ex(tf)) return;
        const owner = d.getFirstAncestor((a) => Node.isClassDeclaration(a) || Node.isInterfaceDeclaration(a));
        const dn = (d as unknown as { getName?: () => string }).getName?.() ?? (Node.isConstructorDeclaration(d) ? 'constructor' : '?');
        const callee = `${tf}#${owner && (Node.isClassDeclaration(owner) || Node.isInterfaceDeclaration(owner)) ? `${owner.getName() ?? '?'}.` : ''}${dn}`;
        const u = unitOf(this.root, n);
        sites.push({ unit: u.id, file: f, line: n.getStartLineNumber(), callee, indexNamed: u.indexNamed });
      });
    }
    return this.pack(q, [], sites, t0, {});
  }

  private pack(q: Question, members: string[], sites: Site[], t0: number, extra: Partial<Truth>): Truth {
    sites.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
    return {
      id: q.id, kind: q.kind, question: q.question, members, sites,
      units: [...new Set(sites.map((s) => s.unit))].sort(), files: [...new Set(sites.map((s) => s.file))].sort(),
      ...extra, ms: Date.now() - t0,
    };
  }
}
