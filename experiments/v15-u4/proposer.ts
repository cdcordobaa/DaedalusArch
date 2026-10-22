/**
 * U4 S2 (v1.5-exp): the relaxed D5 proposer of note §2.2, zero model calls. Frozen before any S2 call (note revision
 * r1, 2026-10-22); its candidate counts on every tree are committed in `results/proposer-counts.json`.
 *
 * A relaxed D5 candidate is an `if` in application or adapter code (spec roles, as R-D5 reads them) that
 *   (a) exits (its then-branch throws or returns, directly or as the only statement of a block), and
 *   (b) whose condition reads the state of an aggregate: some sub-expression (an identifier, a property access or a
 *       call, including the parameter of a callback such as `existing.some((b) => b.stay.overlaps(stay))`) is typed
 *       as a root, or as a collection of a root, of the tree's roots (declared, else inferred, exactly as R-D5 uses);
 *   excluding a pure existence test (`!x` on a name or property, `x === undefined`, `x == null`, `x.length === 0` and
 *   their conjunctions or disjunctions), which is a load-or-404, not a rule. `!room.fits(n)` is not an existence test.
 * The candidate carries `inScope` when the `if` sits inside a callback handed to a call whose name reads as a lock or
 * transaction scope (the existing DETECT-02 SCOPE pattern: transaction, tx, lock, atomic, unitOfWork, serializable).
 * The union with R-D5's own candidates is the S2 D5 candidate set; R-D5 is unchanged.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Node, Project, SyntaxKind } from 'ts-morph';
import type { IfStatement, Type } from 'ts-morph';
import { buildGraph, writeTsconfig } from '../detect-02/lib/graph.js';

export const PROPOSER_VERSION = 'u4-d5-relaxed-r1';
const SCOPE = /transaction|^tx$|lock|atomic|unitOfWork|serializable/i;

export interface RelaxedCandidate {
  readonly file: string; readonly line: number; readonly unit: string; readonly cond: string; readonly root: string; readonly read: string; readonly inScope: boolean; readonly exit: 'throw' | 'return';
}

const strip = (n: Node): Node => { let c = n; while (Node.isParenthesizedExpression(c)) c = c.getExpression(); return c; };
const isNullish = (n: Node): boolean => { const x = strip(n); return x.getKind() === SyntaxKind.NullKeyword || (Node.isIdentifier(x) && x.getText() === 'undefined'); };

/** A pure existence test: `!x`, `x == null`, `x === undefined`, `x.length === 0` (and && / || of such). */
export function isExistenceTest(n: Node): boolean {
  const x = strip(n);
  if (Node.isPrefixUnaryExpression(x) && x.getOperatorToken() === SyntaxKind.ExclamationToken) {
    const o = strip(x.getOperand());
    return Node.isIdentifier(o) || Node.isPropertyAccessExpression(o) || Node.isElementAccessExpression(o);
  }
  if (Node.isBinaryExpression(x)) {
    const k = x.getOperatorToken().getKind();
    if (k === SyntaxKind.AmpersandAmpersandToken || k === SyntaxKind.BarBarToken) return isExistenceTest(x.getLeft()) && isExistenceTest(x.getRight());
    if ([SyntaxKind.EqualsEqualsToken, SyntaxKind.EqualsEqualsEqualsToken, SyntaxKind.ExclamationEqualsToken, SyntaxKind.ExclamationEqualsEqualsToken].includes(k)) {
      if (isNullish(x.getLeft()) || isNullish(x.getRight())) return true;
      const len = (s: Node): boolean => { const y = strip(s); return Node.isPropertyAccessExpression(y) && y.getName() === 'length'; };
      const zero = (s: Node): boolean => strip(s).getText() === '0';
      if ((len(x.getLeft()) && zero(x.getRight())) || (len(x.getRight()) && zero(x.getLeft()))) return true;
    }
  }
  return false;
}

function exitOf(st: IfStatement): 'throw' | 'return' | null {
  const t = st.getThenStatement();
  const one = Node.isBlock(t) ? (t.getStatements().length === 1 ? t.getStatements()[0] : undefined) : t;
  if (one === undefined) return null;
  if (Node.isThrowStatement(one)) return 'throw';
  if (Node.isReturnStatement(one)) return 'return';
  return null;
}

function unitName(n: Node): string {
  for (let a: Node | undefined = n.getParent(); a; a = a.getParent()) {
    if (Node.isMethodDeclaration(a) || Node.isFunctionDeclaration(a)) {
      const cls = a.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);
      return `${cls?.getName() ? `${cls.getName()!}.` : ''}${a.getName() ?? 'default'}`;
    }
    if (Node.isVariableDeclaration(a) && (Node.isArrowFunction(a.getInitializer()) || Node.isFunctionExpression(a.getInitializer()))) return a.getName();
    if (Node.isPropertyDeclaration(a) || Node.isPropertyAssignment(a)) return a.getName();
  }
  return '(module)';
}

function inLockScope(n: Node): boolean {
  for (let a: Node | undefined = n.getParent(); a; a = a.getParent()) {
    if ((Node.isArrowFunction(a) || Node.isFunctionExpression(a)) && Node.isCallExpression(a.getParent())) {
      const callee = (a.getParent() as Node & { getExpression(): Node }).getExpression();
      const name = Node.isPropertyAccessExpression(callee) ? callee.getName() : callee.getText();
      if (SCOPE.test(name)) return true;
    }
    if (Node.isMethodDeclaration(a) || Node.isFunctionDeclaration(a)) return false;
  }
  return false;
}

export async function relaxedCandidates(tree: string, opts: { spec?: string | undefined; style?: string | undefined; scratch: string }): Promise<{ candidates: RelaxedCandidate[]; roots: string[]; rootSource: string }> {
  const tsconfig = writeTsconfig(tree, opts.scratch);
  const { facts, spec } = await buildGraph(tree, { spec: opts.spec, style: opts.style, scratch: opts.scratch, tsconfig, withApg: false });
  const roots = facts.roots;
  if (roots.length === 0) return { candidates: [], roots: [], rootSource: facts.rootSource };
  const project = new Project({ tsConfigFilePath: tsconfig });
  const abs = path.resolve(tree);
  const rel = (p: string): string => path.relative(abs, p).split(path.sep).join('/');
  const rootDecl = new Map<Node, string>();
  for (const r of roots) {
    const sf = project.getSourceFile(path.join(abs, r.file));
    const d = sf?.getClass(r.name) ?? sf?.getInterface(r.name);
    if (d) rootDecl.set(d, r.name);
  }
  const rootOfType = (t: Type): string | null => {
    const ts = [t, ...(t.isArray() ? [t.getArrayElementTypeOrThrow()] : []), ...(t.isUnion() ? t.getUnionTypes() : [])];
    for (const x of ts) for (const d of x.getSymbol()?.getDeclarations() ?? []) { const n = rootDecl.get(d); if (n) return n; }
    return null;
  };
  const out: RelaxedCandidate[] = [];
  for (const sf of project.getSourceFiles()) {
    if (sf.isDeclarationFile() || sf.getFilePath().includes('/node_modules/')) continue;
    const file = rel(sf.getFilePath());
    const role = spec.roleOf(file);
    if (role !== 'application' && role !== 'adapter') continue;
    for (const st of sf.getDescendantsOfKind(SyntaxKind.IfStatement)) {
      const exit = exitOf(st);
      if (exit === null) continue;
      const cond = st.getExpression();
      if (isExistenceTest(cond)) continue;
      let hit: { root: string; read: string } | null = null;
      for (const x of [cond, ...cond.getDescendants()]) {
        if (!Node.isIdentifier(x) && !Node.isPropertyAccessExpression(x) && !Node.isCallExpression(x)) continue;
        if (Node.isIdentifier(x) && Node.isPropertyAccessExpression(x.getParent()) && (x.getParent() as Node & { getNameNode(): Node }).getNameNode() === x) continue;
        const r = rootOfType(x.getType());
        if (r !== null) { hit = { root: r, read: x.getText() }; break; }
      }
      if (hit === null) continue;
      out.push({ file, line: st.getStartLineNumber(), unit: unitName(st), cond: cond.getText().replace(/\s+/g, ' '), root: hit.root, read: hit.read, inScope: inLockScope(st), exit });
    }
  }
  return { candidates: out, roots: roots.map((r) => r.name), rootSource: facts.rootSource };
}

export const scratchDir = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'v15-u4-prop-'));
