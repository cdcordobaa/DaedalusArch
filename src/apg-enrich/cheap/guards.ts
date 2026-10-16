/**
 * Guard-normalised clone units for the CLONES proxy (`clones.ts`, `CheapOptions.cloneGuardUnits`).
 *
 * Why: a duplicated business rule is often a bare guard, `if (!isOrderStatus(s)) throw new DomainError("Unknown order
 * state")`. Its Type-2 token shape is shared by every guard in a project, so the fragment unit drops it (density filter,
 * `densityOf`), and 5 of the 8 E1 AP-DUP-RULE2 seeds were missed that way
 * (`Docs/DiagnosticRuns/v1.3-duprule-v2-2026-10-15.md` §5). A guard unit keys the rule on what makes it *that* rule:
 *
 *   key = normalised condition | thrown error type | message template
 *
 * - **Guard.** A top-level `if` statement of a method, accessor, constructor or top-level function body, with no `else`,
 *   whose `then` is a `throw` statement or a block holding exactly one `throw` statement.
 * - **Condition.** Leaf tokens; a local name (a parameter, variable or `this`-less identifier) becomes `$v`; a property
 *   name (`x.customerId`) and a called function's name (`isOrderStatus(...)`) are kept, since they name the rule; string
 *   and numeric literals are kept by value.
 * - **Error type.** The constructor of `throw new E(...)` or the callee of `throw E.create(...)`; `$expr` otherwise.
 * - **Message template.** Every string-like argument of the thrown expression, in order, joined by ` | `; a template
 *   literal keeps its text with each substitution as `${}`.
 * Two guard units are clones when their keys are equal (similarity 1, clone type `guard`).
 *
 * **Exclusion rule (fixed before any evaluation run of this change; written in
 * `Docs/DiagnosticRuns/v1.3-fieldstate-cheapfix-2026-10-16.md` §B.1).** A guard is NOT a unit when its condition,
 * after removing parentheses, is a *trivial null check on parameters*: one of
 *   `!p`, `p == null`, `p === null`, `p == undefined`, `p === undefined`, `typeof p === 'undefined'` (either operand order,
 *   `!=`/`!==` not included: those guard the opposite case),
 * or an `||` disjunction of only such terms, where every `p` is a bare identifier naming a parameter of the enclosing
 * function, method, accessor or constructor, or a variable declared in its body (a lookup result: `const o = await
 * repo.find(id); if (!o) throw new NotFound('Order not found')`). A property access (`!req.customerId`), a call
 * (`!isValid(x)`), a value comparison (`qty <= 0`), or a module-level or imported name keeps the guard. Rationale:
 * such a check restates a type contract or an existence check rather than a business rule, and it is the shape every
 * component repeats (the reason the density filter exists); its message rarely distinguishes it (`'id is required'`).
 */
import { Node, SyntaxKind, ts } from 'ts-morph';
import type { IfStatement } from 'ts-morph';

export interface GuardShape {
  readonly condition: string;
  readonly errorType: string;
  readonly message: string;
}

/** The guard's `throw` statement, or undefined when the statement is not a guard (see the module comment). */
function guardThrow(st: IfStatement): Node | undefined {
  if (st.getElseStatement() !== undefined) return undefined;
  const then = st.getThenStatement();
  if (Node.isThrowStatement(then)) return then;
  if (Node.isBlock(then)) {
    const inner = then.getStatements();
    if (inner.length === 1 && Node.isThrowStatement(inner[0])) return inner[0];
  }
  return undefined;
}

function stripParens(n: Node): Node {
  let cur = n;
  while (Node.isParenthesizedExpression(cur)) cur = cur.getExpression();
  return cur;
}

const NULLISH_EQ = new Set([SyntaxKind.EqualsEqualsToken, SyntaxKind.EqualsEqualsEqualsToken]);

function isNullishLiteral(n: Node): boolean {
  const x = stripParens(n);
  return x.getKind() === SyntaxKind.NullKeyword || (Node.isIdentifier(x) && x.getText() === 'undefined');
}

/** True for a single trivial null-check term on a parameter name (see the exclusion rule). */
function isTrivialTerm(n: Node, params: ReadonlySet<string>): boolean {
  const x = stripParens(n);
  const isParam = (y: Node): boolean => {
    const z = stripParens(y);
    return Node.isIdentifier(z) && params.has(z.getText());
  };
  if (Node.isPrefixUnaryExpression(x) && x.getOperatorToken() === SyntaxKind.ExclamationToken) return isParam(x.getOperand());
  if (Node.isBinaryExpression(x)) {
    const op = x.getOperatorToken().getKind();
    if (op === SyntaxKind.BarBarToken) return isTrivialTerm(x.getLeft(), params) && isTrivialTerm(x.getRight(), params);
    if (!NULLISH_EQ.has(op)) return false;
    const [l, r] = [stripParens(x.getLeft()), stripParens(x.getRight())];
    if ((isParam(l) && isNullishLiteral(r)) || (isParam(r) && isNullishLiteral(l))) return true;
    const typeofUndefined = (a: Node, b: Node): boolean =>
      Node.isTypeOfExpression(a) && isParam(a.getExpression()) && Node.isStringLiteral(b) && b.getLiteralValue() === 'undefined';
    return typeofUndefined(l, r) || typeofUndefined(r, l);
  }
  return false;
}

/** Parameter names and body-declared variable names of the function-like node that owns `node` (nearest enclosing). */
function enclosingLocals(node: Node): Set<string> {
  for (let cur = node.getParent(); cur !== undefined; cur = cur.getParent()) {
    if (
      Node.isMethodDeclaration(cur) || Node.isConstructorDeclaration(cur) || Node.isFunctionDeclaration(cur) ||
      Node.isFunctionExpression(cur) || Node.isArrowFunction(cur) || Node.isGetAccessorDeclaration(cur) || Node.isSetAccessorDeclaration(cur)
    ) {
      const names = new Set(cur.getParameters().map((p) => p.getName()));
      for (const v of cur.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
        const n = v.getNameNode();
        if (Node.isIdentifier(n)) names.add(n.getText());
      }
      return names;
    }
  }
  return new Set();
}

/** True when the guard's condition is a trivial null check on parameters or locals (the exclusion rule). */
export function isTrivialParamNullCheck(st: IfStatement): boolean {
  return isTrivialTerm(st.getExpression(), enclosingLocals(st));
}

/** Condition tokens, normalised as the module comment says. */
export function normaliseCondition(cond: Node): string {
  const out: string[] = [];
  const sf = cond.getSourceFile().compilerNode;
  const walk = (n: ts.Node): void => {
    const kids = n.getChildren(sf);
    if (kids.length > 0) {
      for (const c of kids) walk(c);
      return;
    }
    const k = n.kind;
    if (k === SyntaxKind.Identifier || k === SyntaxKind.PrivateIdentifier) {
      const parent = n.parent;
      const keep = (ts.isPropertyAccessExpression(parent) && parent.name === n) || (ts.isCallExpression(parent) && parent.expression === n);
      out.push(keep ? n.getText(sf) : '$v');
    } else if (k === SyntaxKind.StringLiteral || k === SyntaxKind.NoSubstitutionTemplateLiteral) {
      out.push(JSON.stringify((n as ts.StringLiteralLike).text));
    } else {
      out.push(n.getText(sf));
    }
  };
  walk(cond.compilerNode);
  return out.join(' ');
}

function templateText(n: Node): string | undefined {
  if (Node.isStringLiteral(n) || Node.isNoSubstitutionTemplateLiteral(n)) return n.getLiteralValue();
  if (Node.isTemplateExpression(n)) {
    return n.getHead().getLiteralText() + n.getTemplateSpans().map((s) => `\${}${s.getLiteral().getLiteralText()}`).join('');
  }
  return undefined;
}

/** The guard's shape, or undefined when `st` is not a guard. Exclusion is a separate check (`isTrivialParamNullCheck`). */
export function guardShape(st: IfStatement): GuardShape | undefined {
  const thr = guardThrow(st);
  if (thr === undefined || !Node.isThrowStatement(thr)) return undefined;
  const e = stripParens(thr.getExpression());
  let errorType = '$expr';
  let args: Node[] = [];
  if (Node.isNewExpression(e)) {
    errorType = e.getExpression().getText();
    args = e.getArguments();
  } else if (Node.isCallExpression(e)) {
    errorType = e.getExpression().getText();
    args = e.getArguments();
  }
  const message = args.map(templateText).filter((x): x is string => x !== undefined).join(' | ');
  return { condition: normaliseCondition(st.getExpression()), errorType, message };
}

export function guardKey(g: GuardShape): string {
  return `${g.condition}|${g.errorType}|${g.message}`;
}
