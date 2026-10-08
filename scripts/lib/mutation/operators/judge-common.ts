/**
 * Entity guard methods for the judge-construction probes MO-X02 and MO-X03 (FR-24 amendment; BR-U5a-28, 29;
 * OI-U5a-7).
 *
 * A **guard method** is a method `m(): boolean` of a named domain-layer class whose body is one `return <rule>;`
 * where `<rule>` reads instance state only as `this.<field>` (at least one field, no other `this` use, no call on
 * `this`). Its **guard calls** are the statements `if (!<receiver>.m()) { throw …; }` that call it; a method with no
 * call, or with any call that is not such a guard statement, is not removable (`not-removable-guard`).
 */
import { Node, SyntaxKind } from 'ts-morph';
import type { ClassDeclaration, IfStatement, MethodDeclaration, SourceFile } from 'ts-morph';
import type { ProjectHandle } from '../types.js';
import { layerOfFile, namedClasses, projectFiles, relOf } from './common.js';
import type { SpecView } from './common.js';

export interface GuardCall {
  readonly file: string;
  readonly statement: IfStatement;
  /** Receiver expression text (`task`). */
  readonly receiver: string;
}

export interface GuardMethod {
  readonly file: string;
  readonly cls: ClassDeclaration;
  readonly method: MethodDeclaration;
  /** Rule expression text with `this.` kept. */
  readonly rule: string;
  /** Fields read as `this.<field>`, first-use order, unique. */
  readonly fields: readonly string[];
  /** All calls; `removable` is false when any call is not a guard statement. */
  readonly calls: readonly GuardCall[];
  readonly removable: boolean;
}

/** `<rule>` of a single-return boolean method, or undefined. */
function ruleOf(method: MethodDeclaration): { rule: string; fields: string[] } | undefined {
  if (method.isStatic() || method.getParameters().length > 0) return undefined;
  if (method.getReturnTypeNode()?.getText() !== 'boolean') return undefined;
  const stmts = method.getStatements();
  const only = stmts[0];
  if (stmts.length !== 1 || only === undefined || !Node.isReturnStatement(only)) return undefined;
  const expr = only.getExpression();
  if (expr === undefined) return undefined;
  const fields: string[] = [];
  for (const t of expr.getDescendantsOfKind(SyntaxKind.ThisKeyword)) {
    const parent = t.getParent();
    if (!Node.isPropertyAccessExpression(parent) || parent.getExpression() !== t) return undefined;
    if (Node.isCallExpression(parent.getParent()) && parent.getParentOrThrow().getChildAtIndex(0) === parent) return undefined;
    const name = parent.getName();
    if (!fields.includes(name)) fields.push(name);
  }
  if (fields.length === 0) return undefined;
  return { rule: expr.getText(), fields };
}

/** The guard statement around a call `<recv>.m()`, when the call is exactly `if (!<recv>.m()) { throw … }`. */
function guardOf(call: Node): IfStatement | undefined {
  const not = call.getParent();
  if (!Node.isPrefixUnaryExpression(not) || not.getOperatorToken() !== SyntaxKind.ExclamationToken) return undefined;
  const stmt = not.getParent();
  if (!Node.isIfStatement(stmt) || stmt.getExpression() !== not || stmt.getElseStatement() !== undefined) return undefined;
  const then = stmt.getThenStatement();
  const body = Node.isBlock(then) ? then.getStatements() : [then];
  return body.length === 1 && body[0] !== undefined && Node.isThrowStatement(body[0]) ? stmt : undefined;
}

/** Every guard method of the domain layer, path then class then method order. */
export function guardMethods(handle: ProjectHandle, view: SpecView): GuardMethod[] {
  const domain = view.binding.domainLayer;
  if (domain === undefined) return [];
  const files = projectFiles(handle);
  const out: GuardMethod[] = [];
  for (const sf of files) {
    const rel = relOf(handle, sf);
    if (layerOfFile(view, rel) !== domain) continue;
    for (const cls of namedClasses(sf)) {
      for (const method of cls.getMethods()) {
        const r = ruleOf(method);
        if (r === undefined) continue;
        const calls: GuardCall[] = [];
        let removable = true;
        for (const ref of method.findReferencesAsNodes()) {
          const access = ref.getParent();
          if (!Node.isPropertyAccessExpression(access) || access.getNameNode() !== ref) continue;
          const call = access.getParent();
          if (!Node.isCallExpression(call) || call.getExpression() !== access) {
            removable = false;
            continue;
          }
          const stmt = guardOf(call);
          if (stmt === undefined) {
            removable = false;
            continue;
          }
          calls.push({ file: relOf(handle, call.getSourceFile()), statement: stmt, receiver: access.getExpression().getText() });
        }
        out.push({ file: rel, cls, method, rule: r.rule, fields: r.fields, calls, removable: removable && calls.length > 0 });
      }
    }
  }
  return out;
}

/** The guard method named by a site (`detail.class`, `detail.method`). */
export function guardAt(handle: ProjectHandle, view: SpecView, file: string, cls: string, method: string): GuardMethod | undefined {
  return guardMethods(handle, view).find((g) => g.file === file && g.cls.getName() === cls && g.method.getName() === method);
}

/** `<rule>` with every `this.<f>` replaced by `map(f)`. */
export function rewriteRule(rule: string, map: (field: string) => string): string {
  return rule.replace(/\bthis\.([A-Za-z_$][\w$]*)/g, (_m, f: string) => map(f));
}

/** Source file of a relative path (helper for callers holding a handle). */
export function sourceOf(handle: ProjectHandle, rel: string): SourceFile | undefined {
  return handle.project.getSourceFile(`${handle.root.endsWith('/') ? handle.root : handle.root + '/'}${rel}`);
}
