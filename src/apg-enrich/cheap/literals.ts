/**
 * Proxy 2, SHARED LITERALS: a non-trivial number or string written in value position in two or more components is a
 * cheap sign of one rule or constant encoded twice (a "magic number" smell across a boundary).
 *
 * Kept: string, no-substitution template and numeric literals (with a unary minus) in value position. Dropped:
 * 0, 1, -1 and common HTTP status codes; strings shorter than `literalMinLength`; HTTP methods, header names and content types;
 * log levels and arguments of log calls; `typeof` tags; identifier-like single-token strings (error codes, event
 * names, keys: a shared tag is how two components state one contract, not a duplicated rule); literals in imports, exports, types and decorator arguments
 * (framework configuration such as routes and column options).
 *
 * Emits SHARES_LITERAL between the File nodes of each pair of components' first sites, with the literal and every
 * site; flags every site of a literal shared across components.
 */
import { Node, SyntaxKind } from 'ts-morph';
import type { CheapContext } from './context.js';
import type { CheapEdge, CheapFlag, CheapProxyOutput, Evidence } from './types.js';

const TRIVIAL_NUMBERS = new Set(['0', '1', '-1']);
const HTTP_STATUS = new Set(['200', '201', '202', '204', '301', '302', '304', '400', '401', '403', '404', '405', '409', '410', '422', '429', '500', '502', '503', '504']);
const COMMON_STRINGS = new Set([
  'get', 'post', 'put', 'patch', 'delete', 'head', 'options',
  'content-type', 'application/json', 'text/plain', 'text/html', 'authorization', 'accept', 'bearer', 'x-api-key',
  'debug', 'info', 'warn', 'warning', 'error', 'log', 'trace', 'verbose', 'fatal',
  'utf8', 'utf-8', 'base64', 'hex', 'true', 'false', 'null', 'undefined',
  'string', 'number', 'boolean', 'object', 'function', 'symbol', 'bigint',
  'production', 'development', 'test',
]);
const LOG_CALLEES = new Set(['log', 'debug', 'info', 'warn', 'error', 'verbose', 'trace', 'fatal']);

export interface LiteralSite {
  readonly value: string;
  readonly kind: 'string' | 'number';
  readonly file: string;
  readonly component: string;
  readonly className: string | undefined;
  readonly methodName: string | undefined;
  readonly evidence: Evidence;
}

/** True when the literal sits where it configures something rather than encodes a value. */
function excludedPosition(n: Node): boolean {
  for (let p = n.getParent(); p !== undefined; p = p.getParent()) {
    const k = p.getKind();
    if (k === SyntaxKind.ImportDeclaration || k === SyntaxKind.ExportDeclaration || k === SyntaxKind.ExternalModuleReference
      || k === SyntaxKind.ImportType || k === SyntaxKind.LiteralType || k === SyntaxKind.Decorator || k === SyntaxKind.ModuleDeclaration) return true;
    if (Node.isCallExpression(p)) {
      const e = p.getExpression();
      const callee = Node.isPropertyAccessExpression(e) ? e.getName() : e.getText();
      if (LOG_CALLEES.has(callee)) return true;
      if (callee === 'require') return true;
    }
    if (Node.isStatement(p) || Node.isPropertyDeclaration(p) || Node.isMethodDeclaration(p)) break;
  }
  const parent = n.getParent();
  if (parent !== undefined && Node.isBinaryExpression(parent)) {
    const other = parent.getLeft() === n ? parent.getRight() : parent.getLeft();
    if (Node.isTypeOfExpression(other)) return true;
  }
  // Property names written as strings (`{ 'a-b': 1 }`, `x['key']`) are keys, not values.
  if (parent !== undefined && Node.isPropertyAssignment(parent) && parent.getNameNode() === n) return true;
  if (parent !== undefined && Node.isElementAccessExpression(parent) && parent.getArgumentExpression() === n) return true;
  return false;
}

/** One identifier-like token (`not-found`, `order.placed`, `ORDER_PAID`): a key, code or tag, not a value. */
const CODE_LIKE = /^[A-Za-z][A-Za-z0-9]*([-_.:/][A-Za-z0-9]+)*$/;

export function isTrivialLiteral(value: string, kind: 'string' | 'number', minLength: number): boolean {
  if (kind === 'number') return TRIVIAL_NUMBERS.has(value) || HTTP_STATUS.has(value);
  return value.trim().length < minLength || COMMON_STRINGS.has(value.toLowerCase()) || CODE_LIKE.test(value);
}

function enclosing(n: Node): { className: string | undefined; methodName: string | undefined } {
  const cls = n.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);
  const m = n.getFirstAncestor((a) => Node.isMethodDeclaration(a) || Node.isFunctionDeclaration(a) || Node.isGetAccessorDeclaration(a) || Node.isSetAccessorDeclaration(a) || Node.isConstructorDeclaration(a));
  let methodName: string | undefined;
  if (m !== undefined) methodName = Node.isConstructorDeclaration(m) ? 'constructor' : Node.hasName(m) ? m.getName() : undefined;
  return { className: cls?.getName(), methodName };
}

export function literalSites(ctx: CheapContext): LiteralSite[] {
  const out: LiteralSite[] = [];
  for (const { file, sf } of ctx.sources) {
    const component = ctx.info(file).component;
    sf.forEachDescendant((n) => {
      let value: string | undefined;
      let kind: 'string' | 'number' = 'string';
      let site: Node = n;
      if (Node.isStringLiteral(n) || Node.isNoSubstitutionTemplateLiteral(n)) value = n.getLiteralValue();
      else if (Node.isNumericLiteral(n)) {
        kind = 'number';
        const p = n.getParent();
        const neg = Node.isPrefixUnaryExpression(p) && p.getOperatorToken() === SyntaxKind.MinusToken;
        value = `${neg ? '-' : ''}${String(n.getLiteralValue())}`;
        if (neg) site = p;
      }
      if (value === undefined || isTrivialLiteral(value, kind, ctx.options.literalMinLength) || excludedPosition(site)) return;
      out.push({ value, kind, file, component, ...enclosing(n), evidence: ctx.evidence(site) });
    });
  }
  return out;
}

export function runSharedLiterals(ctx: CheapContext): CheapProxyOutput {
  const byKey = new Map<string, LiteralSite[]>();
  for (const s of literalSites(ctx)) {
    const k = `${s.kind}:${s.value}`;
    const list = byKey.get(k);
    if (list === undefined) byKey.set(k, [s]);
    else list.push(s);
  }
  const components = new Set([...ctx.files.values()].map((f) => f.component));
  const edges: CheapEdge[] = [];
  const flags: CheapFlag[] = [];
  let shared = 0;
  for (const [, sites] of [...byKey.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
    const comps = [...new Set(sites.map((s) => s.component))].sort();
    if (comps.length < 2) continue;
    shared++;
    const first = sites[0];
    if (first === undefined) continue;
    const score = comps.length / Math.max(components.size, 2);
    const allSites = sites.map((s) => s.evidence);
    for (let i = 0; i < comps.length; i++) {
      for (let j = i + 1; j < comps.length; j++) {
        const a = sites.find((s) => s.component === comps[i]);
        const b = sites.find((s) => s.component === comps[j]);
        const aId = a === undefined ? undefined : ctx.info(a.file).fileNodeId;
        const bId = b === undefined ? undefined : ctx.info(b.file).fileNodeId;
        if (a === undefined || b === undefined || aId === undefined || bId === undefined) continue;
        edges.push({ type: 'SHARES_LITERAL', proxy: 'shared-literals', sourceId: aId, targetId: bId, score, evidence: allSites, properties: { literal: first.value, literalKind: first.kind, components: comps, sites: allSites.length } });
      }
    }
    for (const s of sites) {
      const other = sites.find((o) => o.component !== s.component);
      if (other === undefined) continue;
      flags.push({
        proxy: 'shared-literals', kind: `shared-${s.kind}-literal`, score, evidence: s.evidence,
        ...(s.className !== undefined ? { className: s.className } : {}), ...(s.methodName !== undefined ? { methodName: s.methodName } : {}),
        message: `literal ${JSON.stringify(s.value)} also used in component(s) ${comps.filter((c) => c !== s.component).join(', ')}`,
        related: { ...other.evidence, ...(other.className !== undefined ? { className: other.className } : {}), ...(other.methodName !== undefined ? { methodName: other.methodName } : {}) },
      });
    }
  }
  return { edges, nodeFacts: [], flags, summary: { distinctLiterals: byKey.size, sharedAcrossComponents: shared } };
}
