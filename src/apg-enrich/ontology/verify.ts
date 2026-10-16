/**
 * Ontology v0 deterministic verification of semantic rule duplication. The model proposes that methods in two or more
 * components enforce one business rule; code then checks it, in this order:
 *
 * 1. comparison pattern: every site holds a value comparison with the same canonical operator against a constant,
 *    the constants equal up to a decimal scale (`50` and `5000` cents). Canonical means: a constant on the left is
 *    mirrored (`50 <= x` is `x >= 50`) and a logical `!` over the comparison negates it (`!(x < 50)` is `x >= 50`).
 *    A constant is a numeric literal, a `const` variable or a `readonly` property initialised with one;
 * 2. constant pattern: every site uses one numeric constant (other than 0 and 1), up to a decimal scale;
 * 3. cheap clone: a SAME_LOGIC_AS edge of the clone proxy joins two of the sites;
 * 4. cheap literal: the shared-literal proxy flagged every site.
 *
 * A duplication none of these supports is kept as `verified: false` (model-only).
 */
import { Node, SyntaxKind, VariableDeclarationKind } from 'ts-morph';
import type { MethodDeclaration } from 'ts-morph';
import type { CheapEnrichment } from '../cheap/types.js';
import { equalUpToDecimalScale } from './text.js';
import type { Verification } from './types.js';

type Op = '<' | '<=' | '>' | '>=' | '==' | '!=';

export interface ComparisonPattern {
  readonly op: Op;
  readonly value: number;
}

const OPS: Readonly<Partial<Record<SyntaxKind, Op>>> = {
  [SyntaxKind.LessThanToken]: '<',
  [SyntaxKind.LessThanEqualsToken]: '<=',
  [SyntaxKind.GreaterThanToken]: '>',
  [SyntaxKind.GreaterThanEqualsToken]: '>=',
  [SyntaxKind.EqualsEqualsToken]: '==',
  [SyntaxKind.EqualsEqualsEqualsToken]: '==',
  [SyntaxKind.ExclamationEqualsToken]: '!=',
  [SyntaxKind.ExclamationEqualsEqualsToken]: '!=',
};
const MIRROR: Readonly<Record<Op, Op>> = { '<': '>', '<=': '>=', '>': '<', '>=': '<=', '==': '==', '!=': '!=' };
const NEGATE: Readonly<Record<Op, Op>> = { '<': '>=', '<=': '>', '>': '<=', '>=': '<', '==': '!=', '!=': '==' };

/** The numeric value of a constant expression, or null. Follows identifiers to a `const` or `readonly` initialiser. */
export function constantValue(expr: Node, depth = 0): number | null {
  if (depth > 3) return null;
  if (Node.isParenthesizedExpression(expr)) return constantValue(expr.getExpression(), depth);
  if (Node.isNumericLiteral(expr)) return expr.getLiteralValue();
  if (Node.isPrefixUnaryExpression(expr) && expr.getOperatorToken() === SyntaxKind.MinusToken) {
    const v = constantValue(expr.getOperand(), depth);
    return v === null ? null : -v;
  }
  const target = Node.isIdentifier(expr) ? expr : Node.isPropertyAccessExpression(expr) ? expr.getNameNode() : null;
  if (target === null) return null;
  for (const decl of target.getSymbol()?.getDeclarations() ?? []) {
    if (Node.isVariableDeclaration(decl)) {
      const list = decl.getVariableStatement();
      const init = decl.getInitializer();
      if (list?.getDeclarationKind() === VariableDeclarationKind.Const && init !== undefined) return constantValue(init, depth + 1);
    }
    if (Node.isPropertyDeclaration(decl) && decl.isReadonly()) {
      const init = decl.getInitializer();
      if (init !== undefined) return constantValue(init, depth + 1);
    }
  }
  return null;
}

/** Canonical comparisons of a method body against constants. */
export function comparisonPatterns(method: MethodDeclaration): ComparisonPattern[] {
  const out: ComparisonPattern[] = [];
  for (const bin of method.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
    const raw = OPS[bin.getOperatorToken().getKind()];
    if (raw === undefined) continue;
    const right = constantValue(bin.getRight());
    const left = constantValue(bin.getLeft());
    let op: Op;
    let value: number;
    if (right !== null && left === null) {
      op = raw;
      value = right;
    } else if (left !== null && right === null) {
      op = MIRROR[raw];
      value = left;
    } else {
      continue;
    }
    let node: Node = bin;
    for (let parent = node.getParent(); parent !== undefined; parent = node.getParent()) {
      if (Node.isParenthesizedExpression(parent)) {
        node = parent;
        continue;
      }
      if (Node.isPrefixUnaryExpression(parent) && parent.getOperatorToken() === SyntaxKind.ExclamationToken) {
        op = NEGATE[op];
        node = parent;
        continue;
      }
      break;
    }
    out.push({ op, value });
  }
  return out;
}

/** Numeric constants a method uses (literals and resolved constants), 0 and 1 excluded. */
export function numericConstants(method: MethodDeclaration): number[] {
  const values = new Set<number>();
  for (const d of method.getDescendants()) {
    if (!Node.isNumericLiteral(d) && !Node.isIdentifier(d)) continue;
    const v = constantValue(d);
    if (v !== null && v !== 0 && v !== 1) values.add(v);
  }
  return [...values].sort((a, b) => a - b);
}

export function verifyRuleDuplication(
  siteMethodIds: readonly string[],
  methodDecls: ReadonlyMap<string, MethodDeclaration>,
  cheap: CheapEnrichment,
  siteNames: ReadonlyMap<string, { readonly className: string; readonly methodName: string }>,
  decimalScaleMaxPower: number,
): Verification {
  const decls = siteMethodIds.map((id) => methodDecls.get(id));
  if (decls.every((d): d is MethodDeclaration => d !== undefined) && decls.length >= 2) {
    const patterns = decls.map(comparisonPatterns);
    for (const p of patterns[0] ?? []) {
      if (patterns.slice(1).every((ps) => ps.some((q) => q.op === p.op && equalUpToDecimalScale(q.value, p.value, decimalScaleMaxPower)))) {
        const shown = patterns.map((ps) => ps.find((q) => q.op === p.op && equalUpToDecimalScale(q.value, p.value, decimalScaleMaxPower))).map((q) => `x ${q?.op ?? ''} ${String(q?.value)}`);
        return { verified: true, method: 'comparison-pattern', detail: shown.join(' ~ ') };
      }
    }
    const consts = decls.map(numericConstants);
    for (const v of consts[0] ?? []) {
      if (consts.slice(1).every((cs) => cs.some((w) => equalUpToDecimalScale(v, w, decimalScaleMaxPower)))) {
        return { verified: true, method: 'constant-pattern', detail: `every site uses ${String(v)} (up to a decimal scale)` };
      }
    }
  }
  const ids = new Set(siteMethodIds);
  const clone = cheap.edges.find((e) => e.type === 'SAME_LOGIC_AS' && ids.has(e.sourceId) && ids.has(e.targetId) && e.sourceId !== e.targetId);
  if (clone !== undefined) return { verified: true, method: 'cheap-clone', detail: `SAME_LOGIC_AS ${clone.sourceId} ~ ${clone.targetId}` };
  const names = siteMethodIds.map((id) => siteNames.get(id));
  const literalFlagged = names.every((n) => n !== undefined && cheap.flags.some((f) => f.proxy === 'shared-literals' && f.className === n.className && f.methodName === n.methodName));
  if (literalFlagged && names.length >= 2) return { verified: true, method: 'cheap-literal', detail: 'the shared-literal proxy flagged every site' };
  return { verified: false, method: 'none', detail: 'no shared comparison, constant, clone or literal: model-only' };
}
