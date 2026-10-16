/**
 * Batch 2, proxy 11, ERROR FLOW: which error types each unit can throw and how catch blocks handle them.
 *
 * - THROWS (unit → error type). Direct: a `throw` whose expression's type resolves to a class (`throw new X()`, a
 *   rethrown variable, a factory call's return type). Propagated: the union of the throws of every unit the unit calls
 *   (call graph, interface calls resolved to implementations, `callgraph.ts`) outside the try block of a try … catch of
 *   the same unit; fixpoint over the graph. An error type is the APG Class node of a project class, or a virtual
 *   `ErrorType` node (`error:<module>#<Name>`, `lib` for the standard library) for a package or built-in class.
 * - CATCHES (unit → error type): for each try … catch, every error type its try block can throw (direct throws in the
 *   block and the throws of the units it calls), with the catch's handling, in this order of precedence:
 *   `rethrown` (a `throw` in the catch block), `narrowed` (an `instanceof` test on the caught value), `translated`
 *   (the value is passed on, returned or read outside a log call, e.g. to an error mapper), `logged` (the value only
 *   reaches log calls), `swallowed` (no binding, or the binding is never read).
 *
 * Flags:
 * - `framework-http-exception-in-core`: a direct throw, in a domain- or application-kind file, of an error type that
 *   is (or extends) a framework HTTP exception: `@nestjs/common` `*Exception`, `http-errors`, `@hapi/boom` / `boom`,
 *   `routing-controllers` `*Error`, `@tsed/exceptions`. The transport's status vocabulary inside the core.
 * - `domain-error-swallowed`: a catch block in an adapter (infrastructure- or presentation-kind file; without a
 *   layer, a controller / adapter / repository class) whose handling is `swallowed` or `logged` and whose try block can
 *   throw an error type declared in a domain- or application-kind file (without layers: a project error class under a
 *   `domain` or `core` directory). A catch that narrows, translates or rethrows is not flagged.
 */
import { Node } from 'ts-morph';
import type { CatchClause, ClassDeclaration } from 'ts-morph';
import type { CheapContext } from './context.js';
import { callGraph } from './callgraph.js';
import type { CallGraph, CgUnit } from './callgraph.js';
import { resolvedDeclaration, roleFromName } from './behaviour.js';
import type { CheapEdge, CheapFlag, CheapNodeFact, CheapProxyOutput, CheapVirtualNode } from './types.js';

export type CatchHandling = 'rethrown' | 'narrowed' | 'translated' | 'logged' | 'swallowed';

export interface ErrorType {
  /** `class:<file>|<Name>` for a project class, `error:<module>#<Name>` otherwise. */
  readonly key: string;
  readonly name: string;
  /** Package or `lib`; null for a project class. */
  readonly module: string | null;
  readonly file: string | null;
  readonly frameworkHttp: boolean;
  /** Declared in a domain- or application-kind file (see the module comment for the no-layer rule). */
  readonly core: boolean;
  /** The APG Class node id (project class with a node) or the virtual node id. */
  readonly nodeId: string;
}

const HTTP_EXCEPTION_MODULES: readonly (readonly [RegExp, RegExp])[] = [
  [/^@nestjs\/common$/, /Exception$/],
  [/^http-errors$/, /.*/],
  [/^(@hapi\/boom|boom)$/, /.*/],
  [/^routing-controllers$/, /(Error|Exception)$/],
  [/^@tsed\/exceptions$/, /.*/],
];

const LOG_METHODS = new Set(['log', 'error', 'warn', 'info', 'debug', 'trace', 'fatal', 'verbose']);

function isFrameworkHttp(ctx: CheapContext, cls: ClassDeclaration | undefined, name: string, module: string | null): boolean {
  const test = (mod: string | null, n: string): boolean => mod !== null && HTTP_EXCEPTION_MODULES.some(([m, re]) => m.test(mod) && re.test(n));
  if (test(module, name)) return true;
  for (let c = cls?.getBaseClass(), depth = 0; c !== undefined && depth < 6; c = c.getBaseClass(), depth++) {
    if (test(ctx.moduleOf(c), c.getName() ?? '')) return true;
  }
  // A base class from a package that ts-morph cannot follow as a ClassDeclaration (an `extends` on an alias).
  const ext = cls?.getExtends();
  if (ext !== undefined) {
    const d = resolvedDeclaration(ext.getExpression());
    if (d !== undefined && test(ctx.moduleOf(d), ext.getExpression().getText())) return true;
  }
  return false;
}

function isCoreFile(ctx: CheapContext, file: string): boolean {
  const info = ctx.info(file);
  if (info.layerKind !== null) return info.layerKind === 'domain' || info.layerKind === 'application';
  if (info.layer !== null) return false;
  return /(^|\/)(domain|core)(\/|$)/.test(file);
}

function isAdapterUnit(ctx: CheapContext, u: CgUnit): boolean {
  const kind = ctx.info(u.file).layerKind;
  if (kind !== null) return kind === 'infrastructure' || kind === 'presentation';
  if (u.className === undefined) return false;
  const r = roleFromName(u.className);
  return r === 'controller' || r === 'adapter' || r === 'repository' || r === 'transport-infra';
}

/** The error type a thrown expression denotes, if it resolves to a class (or a lib / package value of a class type). */
export function errorTypeOf(ctx: CheapContext, expr: Node): ErrorType | undefined {
  let decl: Node | undefined;
  let name: string | undefined;
  if (Node.isNewExpression(expr)) {
    decl = resolvedDeclaration(expr.getExpression());
    name = expr.getExpression().getText().split('.').pop();
  }
  if (decl === undefined || !(Node.isClassDeclaration(decl))) {
    const sym = expr.getType().getSymbol() ?? expr.getType().getAliasSymbol();
    const d = sym?.getDeclarations()[0];
    if (d !== undefined) {
      decl = d;
      name = sym?.getName();
    }
  }
  if (decl === undefined || name === undefined || name === '__type' || name === '__object') return undefined;
  const cls = Node.isClassDeclaration(decl) ? decl : undefined;
  const sfPath = decl.getSourceFile().getFilePath().replace(/\\/g, '/');
  const projectFile = ctx.files.has(ctx.rel(decl.getSourceFile())) ? ctx.rel(decl.getSourceFile()) : null;
  const isLib = /\/typescript\/lib\/lib\.[^/]*\.d\.ts$/.test(sfPath);
  const module = projectFile !== null ? null : isLib ? 'lib' : ctx.moduleOf(decl);
  if (projectFile === null && module === null) return undefined;
  const n = cls?.getName() ?? name;
  const fw = isFrameworkHttp(ctx, cls, n, module);
  if (projectFile !== null) {
    return { key: `class:${projectFile}|${n}`, name: n, module: null, file: projectFile, frameworkHttp: fw, core: isCoreFile(ctx, projectFile), nodeId: ctx.nodeId('Class', projectFile, n) ?? `error:${projectFile}#${n}` };
  }
  return { key: `error:${module ?? 'lib'}#${n}`, name: n, module, file: null, frameworkHttp: fw, core: false, nodeId: `error:${module ?? 'lib'}#${n}` };
}

interface ThrowInfo {
  readonly type: ErrorType;
  readonly direct: boolean;
  readonly line: number;
  /** For a propagated throw: the unit called. */
  readonly via: string | undefined;
}

/** The APG node a unit's facts hang on: its own node, its class, its file. */
export function ownerNodeId(ctx: CheapContext, u: CgUnit): string | undefined {
  return u.apgId ?? (u.className !== undefined ? ctx.nodeId('Class', u.file, u.className) : undefined) ?? ctx.info(u.file).fileNodeId;
}

interface ErrorFlowModel {
  readonly graph: CallGraph;
  readonly throws: ReadonlyMap<string, ReadonlyMap<string, ThrowInfo>>;
  readonly types: ReadonlyMap<string, ErrorType>;
  /** Error types a node's subtree can throw (direct throws and calls into units). */
  within(node: Node): Map<string, ThrowInfo>;
}

const MODEL = new WeakMap<CheapContext, ErrorFlowModel>();

export function errorFlowModel(ctx: CheapContext): ErrorFlowModel {
  const hit = MODEL.get(ctx);
  if (hit !== undefined) return hit;
  const g = callGraph(ctx);
  const types = new Map<string, ErrorType>();
  const throws = new Map<string, Map<string, ThrowInfo>>();
  const directIn = (node: Node, skipCaught: boolean): ThrowInfo[] => {
    const out: ThrowInfo[] = [];
    node.forEachDescendant((n, trav) => {
      if (Node.isClassDeclaration(n)) {
        trav.skip();
        return;
      }
      if (!Node.isThrowStatement(n)) return;
      if (skipCaught && caughtWithin(n, node)) return;
      const t = errorTypeOf(ctx, n.getExpression());
      if (t === undefined) return;
      types.set(t.key, t);
      out.push({ type: t, direct: true, line: n.getStartLineNumber(), via: undefined });
    });
    return out;
  };
  for (const u of g.units.values()) {
    const m = new Map<string, ThrowInfo>();
    for (const s of u.scopes) for (const t of directIn(s, true)) if (!m.has(t.type.key)) m.set(t.type.key, t);
    throws.set(u.id, m);
  }
  // Fixpoint: propagate along calls that are not inside a try … catch of the caller.
  for (let changed = true, rounds = 0; changed && rounds < 50; rounds++) {
    changed = false;
    for (const u of g.units.values()) {
      const mine = throws.get(u.id) ?? new Map<string, ThrowInfo>();
      for (const e of g.out.get(u.id) ?? []) {
        if (e.kind === 'new' || e.inTry) continue;
        for (const [k, t] of throws.get(e.target) ?? []) {
          if (mine.has(k)) continue;
          mine.set(k, { type: t.type, direct: false, line: e.line, via: e.target });
          changed = true;
        }
      }
      throws.set(u.id, mine);
    }
  }
  const within = (node: Node): Map<string, ThrowInfo> => {
    const m = new Map<string, ThrowInfo>();
    for (const t of directIn(node, false)) if (!m.has(t.type.key)) m.set(t.type.key, t);
    const visit = (n: Node): void => {
      if (Node.isCallExpression(n) || Node.isNewExpression(n)) {
        const r = g.resolve(n.getExpression(), Node.isNewExpression(n));
        for (const target of r.targets) for (const [k, t] of throws.get(target) ?? []) if (!m.has(k)) m.set(k, { type: t.type, direct: false, line: n.getStartLineNumber(), via: target });
      }
      n.forEachChild(visit);
    };
    visit(node);
    return m;
  };
  const model: ErrorFlowModel = { graph: g, throws, types, within };
  MODEL.set(ctx, model);
  return model;
}

/** True when a throw statement lies in the try block of a try … catch nested inside `scope`. */
function caughtWithin(n: Node, scope: Node): boolean {
  for (let p = n.getParent(); p !== undefined && p !== scope; p = p.getParent()) {
    const gp = p.getParent();
    if (gp !== undefined && Node.isTryStatement(gp) && gp.getTryBlock() === p && gp.getCatchClause() !== undefined) return true;
  }
  return false;
}

function isLogCall(call: Node): boolean {
  if (!Node.isCallExpression(call)) return false;
  const e = call.getExpression();
  if (!Node.isPropertyAccessExpression(e)) return false;
  if (!LOG_METHODS.has(e.getName())) return false;
  const recv = e.getExpression().getText();
  return /^(console|logger|log|this\.logger|this\.log|this\._logger)$/i.test(recv) || /logger$/i.test(recv);
}

/** How a catch clause handles what it catches (see the module comment). */
export function catchHandling(clause: CatchClause): { handling: CatchHandling; narrowedTo: string[] } {
  const block = clause.getBlock();
  const st = { rethrows: false };
  block.forEachDescendant((n, trav) => {
    if (Node.isArrowFunction(n) || Node.isFunctionExpression(n) || Node.isFunctionDeclaration(n)) {
      trav.skip();
      return;
    }
    if (Node.isThrowStatement(n)) st.rethrows = true;
  });
  if (st.rethrows) return { handling: 'rethrown', narrowedTo: [] };
  const v = clause.getVariableDeclaration();
  const name = v?.getName();
  if (v === undefined || name === undefined) return { handling: 'swallowed', narrowedTo: [] };
  const uses = block.getDescendants().filter((n) => Node.isIdentifier(n) && n.getText() === name && resolvedDeclaration(n) === v);
  const narrowedTo: string[] = [];
  for (const u of uses) {
    const p = u.getParent();
    if (p !== undefined && Node.isBinaryExpression(p) && p.getOperatorToken().getText() === 'instanceof' && p.getLeft() === u) narrowedTo.push(p.getRight().getText());
  }
  if (narrowedTo.length > 0) return { handling: 'narrowed', narrowedTo };
  if (uses.length === 0) return { handling: 'swallowed', narrowedTo };
  const logged = uses.every((u) => {
    for (let p = u.getParent(); p !== undefined && p !== block; p = p.getParent()) if (isLogCall(p)) return true;
    return false;
  });
  return { handling: logged ? 'logged' : 'translated', narrowedTo };
}

export function runErrorFlow(ctx: CheapContext): CheapProxyOutput {
  const model = errorFlowModel(ctx);
  const g = model.graph;
  const edges: CheapEdge[] = [];
  const flags: CheapFlag[] = [];
  const nodeFacts: CheapNodeFact[] = [];
  const handlingCounts: Record<CatchHandling, number> = { rethrown: 0, narrowed: 0, translated: 0, logged: 0, swallowed: 0 };
  let direct = 0;
  let propagated = 0;
  let catchesWithoutKnownThrows = 0;
  for (const u of g.units.values()) {
    const owner = ownerNodeId(ctx, u);
    const ts = [...(model.throws.get(u.id) ?? new Map<string, ThrowInfo>()).values()].sort((a, b) => (a.type.key < b.type.key ? -1 : 1));
    for (const t of ts) {
      if (t.direct) direct++;
      else propagated++;
      if (owner !== undefined) {
        edges.push({
          type: 'THROWS', proxy: 'error-flow', sourceId: owner, targetId: t.type.nodeId, score: t.direct ? 1 : 0.5,
          evidence: [{ file: u.file, startLine: t.line, endLine: t.line }],
          properties: { unit: `${u.className !== undefined ? `${u.className}.` : ''}${u.name}`, errorType: t.type.name, module: t.type.module, direct: t.direct, frameworkHttp: t.type.frameworkHttp, coreError: t.type.core, ...(t.via !== undefined ? { via: g.units.get(t.via)?.name ?? t.via } : {}) },
        });
      }
      if (t.direct && t.type.frameworkHttp && isCoreUnit(ctx, u)) {
        flags.push({
          proxy: 'error-flow', kind: 'framework-http-exception-in-core', score: 1, evidence: { file: u.file, startLine: t.line, endLine: t.line },
          ...(u.className !== undefined ? { className: u.className } : {}), methodName: u.name,
          message: `${ctx.info(u.file).layerKind ?? 'core'} unit ${u.className !== undefined ? `${u.className}.` : ''}${u.name} throws framework HTTP exception ${t.type.name}${t.type.module !== null ? ` (${t.type.module})` : ''}`,
        });
      }
    }
    for (const scope of u.scopes) {
      const clauses: CatchClause[] = [];
      if (Node.isCatchClause(scope)) clauses.push(scope);
      scope.forEachDescendant((n) => {
        if (Node.isCatchClause(n)) clauses.push(n);
      });
      for (const clause of clauses) {
        const tryStmt = clause.getParent();
        if (!Node.isTryStatement(tryStmt)) continue;
        if (g.unitAt(clause) !== u.id) continue;
        const { handling, narrowedTo } = catchHandling(clause);
        handlingCounts[handling]++;
        const can = [...model.within(tryStmt.getTryBlock()).values()].sort((a, b) => (a.type.key < b.type.key ? -1 : 1));
        if (can.length === 0) catchesWithoutKnownThrows++;
        const ev = ctx.evidence(clause);
        for (const t of can) {
          if (owner !== undefined) {
            edges.push({ type: 'CATCHES', proxy: 'error-flow', sourceId: owner, targetId: t.type.nodeId, score: handling === 'swallowed' || handling === 'logged' ? 1 : 0, evidence: [ev], properties: { errorType: t.type.name, handling, catchAll: narrowedTo.length === 0, narrowedTo, coreError: t.type.core } });
          }
        }
        const swallowedCore = can.filter((t) => t.type.core);
        if ((handling === 'swallowed' || handling === 'logged') && swallowedCore.length > 0 && isAdapterUnit(ctx, u)) {
          flags.push({
            proxy: 'error-flow', kind: 'domain-error-swallowed', score: handling === 'swallowed' ? 1 : 0.5, evidence: ev,
            ...(u.className !== undefined ? { className: u.className } : {}), methodName: u.name,
            message: `catch-all in ${u.className !== undefined ? `${u.className}.` : ''}${u.name} ${handling === 'swallowed' ? 'swallows' : 'only logs'} ${swallowedCore.map((t) => t.type.name).join(', ')}`,
          });
        }
      }
    }
  }
  const virtualNodes: CheapVirtualNode[] = [];
  for (const t of [...model.types.values()].sort((a, b) => (a.key < b.key ? -1 : 1))) {
    if (t.module !== null || !t.nodeId.startsWith('error:')) {
      if (t.module !== null) virtualNodes.push({ id: t.nodeId, kind: 'ErrorType', name: t.name, properties: { module: t.module, frameworkHttp: t.frameworkHttp } });
      else nodeFacts.push({ proxy: 'error-flow', nodeId: t.nodeId, key: 'errorType', value: { frameworkHttp: t.frameworkHttp, core: t.core } });
    } else {
      virtualNodes.push({ id: t.nodeId, kind: 'ErrorType', name: t.name, properties: { file: t.file, frameworkHttp: t.frameworkHttp, core: t.core } });
    }
  }
  return {
    edges, nodeFacts, flags, virtualNodes,
    summary: { errorTypes: model.types.size, throwsDirect: direct, throwsPropagated: propagated, catches: handlingCounts, catchesWithoutKnownThrows, flagsByKind: countKinds(flags) },
  };
}

function isCoreUnit(ctx: CheapContext, u: CgUnit): boolean {
  const info = ctx.info(u.file);
  if (info.layerKind !== null) return info.layerKind === 'domain' || info.layerKind === 'application';
  if (info.layer !== null || u.className === undefined) return false;
  const r = roleFromName(u.className);
  return r === 'entity' || r === 'domain-service' || (r === 'service' && /(^|\/)(domain|application|core|use-?cases?)(\/|$)/.test(u.file));
}

export function countKinds(flags: readonly CheapFlag[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of flags) out[f.kind] = (out[f.kind] ?? 0) + 1;
  return out;
}
