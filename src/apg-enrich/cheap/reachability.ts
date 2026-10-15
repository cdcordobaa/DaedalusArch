/**
 * Batch 2, proxy 12, ENTRY-POINT REACHABILITY: what each entry point reaches over the resolved call graph
 * (`callgraph.ts`: calls through interfaces resolve to their implementations), which modules nothing reaches, and
 * which endpoints reach infrastructure without passing through the core.
 *
 * Entry points (`EntryPoint` virtual nodes, `entry:<kind>:<file>:<line>:<name>`):
 * - `http`: a method carrying a route decorator (`Get`, `Post`, …, from `@nestjs/common`) of a `@Controller` class; a
 *   handler passed to `get / post / put / patch / delete / options / head / all / use` on an express, fastify or
 *   koa-router receiver (resolved by the receiver type's package): a function or method reference, or an inline
 *   callback (the callback is the entry's scope);
 * - `message`: a method with `@MessagePattern` / `@EventPattern` (`@nestjs/microservices`), `@OnEvent`
 *   (`@nestjs/event-emitter`), `@Process` (`@nestjs/bull*`), the `handle` / `execute` method of an `@EventsHandler` /
 *   `@CommandHandler` / `@QueryHandler` class (`@nestjs/cqrs`), and every source of an APG v2 SUBSCRIBES edge when
 *   the APG has them;
 * - `scheduled`: `@Cron` / `@Interval` / `@Timeout` (`@nestjs/schedule`);
 * - `main`: the module body and the exported functions of a file named `main`, `cli`, `server`, `bootstrap`,
 *   `container` or `composition-root`, of `src/index.ts` / `index.ts` at the root, and of any file that tests
 *   `require.main === module` (a composition root is often a function its host calls).
 *
 * REACHES (entry → unit): every unit reachable from the entry over `call`, `new` and function-reference edges, with
 * its BFS depth. Reaching a constructor also reaches the public methods of its class: an instantiated object may
 * escape to a caller outside the project (rapid type analysis, Bacon and Sweeney 1996). Module reachability adds the declarations an identifier of a reached unit resolves to (types, classes
 * and constants) and the files a reached file imports at run time (non-type-only IMPORTS / RE_EXPORTS).
 *
 * Flags:
 * - `unreachable-module`: a file that declares runtime code (a class, a function or a variable) and that no entry
 *   reaches in that sense. Only raised when the project has at least one entry point; test files are not APG files.
 * - `endpoint-bypasses-core`: an `http` or `message` entry with a call path (calls and function references, not
 *   `new`) to an infrastructure unit on which no unit lies in a core layer. Core = the application-kind layers, or the
 *   domain-kind layers when there is no application kind (strict layering); without a layer model, a `*Service`,
 *   `*UseCase`, `*Handler`, entity or domain-service class. An infrastructure unit = a unit of an infrastructure-kind
 *   file whose class is in the repository or adapter role by name (or that performs catalogued I/O), outside the
 *   entry's own class. An interface (a port) on the path does not count as core.
 */
import * as path from 'node:path';
import { Node, SyntaxKind } from 'ts-morph';
import type { Decorator } from 'ts-morph';
import type { CheapContext } from './context.js';
import { classesOf } from './context.js';
import { callGraph } from './callgraph.js';
import type { CallGraph, CgUnit } from './callgraph.js';
import { allClassBehaviours, resolvedDeclaration, roleFromName } from './behaviour.js';
import { countKinds, ownerNodeId } from './error-flow.js';
import type { CheapEdge, CheapFlag, CheapNodeFact, CheapProxyOutput, CheapVirtualNode, Evidence } from './types.js';

export type EntryKind = 'http' | 'message' | 'scheduled' | 'main';

export interface EntryPoint {
  readonly id: string;
  readonly kind: EntryKind;
  readonly file: string;
  readonly name: string;
  readonly via: string;
  /** The unit(s) the entry starts from (for an inline handler: the units its body calls). */
  readonly units: readonly string[];
  /** An inline callback: the entry's own code is not a unit, its callees are the start units. */
  readonly inline: boolean;
  readonly evidence: Evidence;
}

const ROUTE_DECORATORS = new Set(['Get', 'Post', 'Put', 'Patch', 'Delete', 'Options', 'Head', 'All', 'Sse']);
const MESSAGE_DECORATORS: Readonly<Record<string, RegExp>> = {
  MessagePattern: /^@nestjs\/microservices$/, EventPattern: /^@nestjs\/microservices$/, OnEvent: /^@nestjs\/event-emitter$/,
  Process: /^@nestjs\/bull(mq)?$/, SqsMessageHandler: /.*/, RabbitSubscribe: /.*/,
};
const SCHEDULE_DECORATORS = new Set(['Cron', 'Interval', 'Timeout']);
const CQRS_CLASS_DECORATORS = new Set(['EventsHandler', 'CommandHandler', 'QueryHandler', 'Saga']);
const ROUTER_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'del', 'options', 'head', 'all', 'use', 'route']);
const ROUTER_MODULES = /^(express|fastify|koa-router|@koa\/router|@fastify\/.+|hono)$/;
const MAIN_NAMES = new Set(['main', 'cli', 'server', 'bootstrap', 'container', 'composition-root']);

function decoratorModule(ctx: CheapContext, d: Decorator): string | null {
  const call = d.getCallExpression();
  const decl = resolvedDeclaration(call?.getExpression() ?? d.getExpression());
  return decl === undefined ? null : ctx.moduleOf(decl);
}

/** The package of a router receiver's type (or of the declaration it was created from). */
function receiverModule(ctx: CheapContext, recv: Node): string | null {
  const t = recv.getType();
  for (const sym of [t.getSymbol(), t.getAliasSymbol(), t.getApparentType().getSymbol()]) {
    const d = sym?.getDeclarations()[0];
    const m = d === undefined ? null : ctx.moduleOf(d);
    if (m !== null) return m;
  }
  return null;
}

export function detectEntryPoints(ctx: CheapContext, g: CallGraph): EntryPoint[] {
  const out: EntryPoint[] = [];
  const seen = new Set<string>();
  const add = (kind: EntryKind, file: string, line: number, name: string, via: string, units: readonly string[], evidence: Evidence, inline = false): void => {
    const id = `entry:${kind}:${file}:${String(line)}:${name}`;
    if (seen.has(id) || units.length === 0) return;
    seen.add(id);
    out.push({ id, kind, file, name, via, units, evidence, inline });
  };
  for (const { file, sf } of ctx.sources) {
    for (const cls of classesOf(sf)) {
      const cn = cls.getName() ?? '';
      const clsDecos = cls.getDecorators().map((d) => ({ name: d.getName(), mod: decoratorModule(ctx, d) }));
      const isController = clsDecos.some((d) => d.name === 'Controller' && d.mod === '@nestjs/common');
      const cqrs = clsDecos.find((d) => CQRS_CLASS_DECORATORS.has(d.name) && d.mod === '@nestjs/cqrs');
      for (const m of cls.getMethods()) {
        const unit = g.unitOfDeclaration(m);
        if (unit === undefined) continue;
        for (const d of m.getDecorators()) {
          const dn = d.getName();
          const mod = decoratorModule(ctx, d);
          if (isController && ROUTE_DECORATORS.has(dn) && mod === '@nestjs/common') add('http', file, m.getStartLineNumber(), `${cn}.${m.getName()}`, `@${dn}`, [unit], ctx.evidence(m));
          const re = MESSAGE_DECORATORS[dn];
          if (re !== undefined && mod !== null && re.test(mod)) add('message', file, m.getStartLineNumber(), `${cn}.${m.getName()}`, `@${dn}`, [unit], ctx.evidence(m));
          if (SCHEDULE_DECORATORS.has(dn) && mod === '@nestjs/schedule') add('scheduled', file, m.getStartLineNumber(), `${cn}.${m.getName()}`, `@${dn}`, [unit], ctx.evidence(m));
        }
        if (cqrs !== undefined && (m.getName() === 'handle' || m.getName() === 'execute')) add('message', file, m.getStartLineNumber(), `${cn}.${m.getName()}`, `@${cqrs.name}`, [unit], ctx.evidence(m));
      }
    }
    // Router registrations: express / fastify / koa-router.
    sf.forEachDescendant((n) => {
      if (!Node.isCallExpression(n)) return;
      const e = n.getExpression();
      if (!Node.isPropertyAccessExpression(e) || !ROUTER_METHODS.has(e.getName())) return;
      const mod = receiverModule(ctx, e.getExpression());
      if (mod === null || !ROUTER_MODULES.test(mod)) return;
      const args = n.getArguments();
      const route = args[0] !== undefined && Node.isStringLiteral(args[0]) ? args[0].getLiteralText() : '';
      for (const a of args) {
        if (Node.isStringLiteral(a) || Node.isTemplateExpression(a) || Node.isNoSubstitutionTemplateLiteral(a)) continue;
        let units: string[] = [];
        if (Node.isArrowFunction(a) || Node.isFunctionExpression(a)) {
          // An inline handler: its own body is the entry scope; reach what it calls.
          const r: string[] = [];
          a.forEachDescendant((c) => {
            if (Node.isCallExpression(c) || Node.isNewExpression(c)) r.push(...g.resolve(c.getExpression(), Node.isNewExpression(c)).targets);
          });
          units = [...new Set(r)];
          add('http', file, a.getStartLineNumber(), `${e.getName().toUpperCase()} ${route}`.trim(), `${mod}.${e.getName()}`, units, ctx.evidence(a), true);
          continue;
        }
        const target = Node.isCallExpression(a) && Node.isPropertyAccessExpression(a.getExpression()) && a.getExpression().getText().endsWith('.bind') ? (a.getExpression() as import('ts-morph').PropertyAccessExpression).getExpression() : a;
        units = [...g.resolve(target, false).targets];
        add('http', file, a.getStartLineNumber(), `${e.getName().toUpperCase()} ${route}`.trim(), `${mod}.${e.getName()}`, units, ctx.evidence(a));
      }
    });
    // Main modules.
    const base = path.posix.basename(file).replace(/\.(ts|tsx|mts|cts)$/, '');
    const atRoot = file === 'index.ts' || file === 'src/index.ts';
    const requireMain = /require\.main\s*===\s*module/.test(sf.getFullText());
    if (MAIN_NAMES.has(base) || atRoot || requireMain) {
      const via = MAIN_NAMES.has(base) ? 'file name' : atRoot ? 'root index' : 'require.main';
      // The module body, and every exported function: a composition root is often a function its host calls.
      const exported = sf.getFunctions().filter((f) => f.isExported()).map((f) => g.unitOfDeclaration(f)).filter((x): x is string => x !== undefined);
      for (const v of sf.getVariableDeclarations()) if (v.getVariableStatement()?.isExported() === true) {
        const u = g.unitOfDeclaration(v);
        if (u !== undefined) exported.push(u);
      }
      add('main', file, 1, file, via, [`file:${file}`, ...exported], { file, startLine: 1, endLine: 1 });
    }
  }
  // APG v2 SUBSCRIBES sources.
  const unitByApg = new Map<string, string>();
  for (const u of g.units.values()) if (u.apgId !== undefined) unitByApg.set(u.apgId, u.id);
  const byId = new Map(ctx.apg.nodes.map((n) => [n.id, n]));
  for (const e of ctx.apg.edges) {
    if (e.type !== 'SUBSCRIBES') continue;
    const unit = unitByApg.get(e.sourceId);
    const n = byId.get(e.sourceId);
    if (unit === undefined || n === undefined) continue;
    const u = g.units.get(unit);
    if (u === undefined) continue;
    add('message', u.file, u.evidence.startLine, n.name, 'SUBSCRIBES', [unit], u.evidence);
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function coreKinds(ctx: CheapContext): Set<string> {
  const kinds = new Set((ctx.layerModel?.layers ?? []).map((l) => l.kind).filter((k): k is NonNullable<typeof k> => k !== undefined));
  return kinds.has('application') ? new Set(['application']) : kinds.has('domain') ? new Set(['domain']) : new Set();
}

export function runReachability(ctx: CheapContext): CheapProxyOutput {
  const g = callGraph(ctx);
  const entries = detectEntryPoints(ctx, g);
  const core = coreKinds(ctx);
  const hasLayers = (ctx.layerModel?.layers.length ?? 0) > 0;
  const ioClasses = new Set(allClassBehaviours(ctx).filter((b) => b.io.some((x) => x.category !== 'transport')).map((b) => `${b.file}|${b.name}`));
  const isCore = (u: CgUnit): boolean => {
    const k = ctx.info(u.file).layerKind;
    if (hasLayers) return k !== null && core.has(k);
    if (u.className === undefined) return false;
    const r = roleFromName(u.className);
    return r === 'service' || r === 'entity' || r === 'domain-service';
  };
  const isInfra = (u: CgUnit): boolean => {
    if (u.className === undefined) return false;
    const k = ctx.info(u.file).layerKind;
    if (hasLayers && k !== 'infrastructure') return false;
    const r = roleFromName(u.className);
    return r === 'repository' || r === 'adapter' || ioClasses.has(`${u.file}|${u.className}`);
  };

  const edges: CheapEdge[] = [];
  const flags: CheapFlag[] = [];
  const nodeFacts: CheapNodeFact[] = [];
  const virtualNodes: CheapVirtualNode[] = [];
  const publicMethods = new Map<string, string[]>();
  for (const u of g.units.values()) {
    if (u.className === undefined || (u.kind !== 'method' && u.kind !== 'property-function')) continue;
    const d = u.decl;
    if ((Node.isMethodDeclaration(d) || Node.isPropertyDeclaration(d)) && (d.hasModifier(SyntaxKind.PrivateKeyword) || d.hasModifier(SyntaxKind.StaticKeyword) || d.getName().startsWith('#'))) continue;
    const ctor = `unit:${u.file}#${u.className}.constructor`;
    publicMethods.set(ctor, [...(publicMethods.get(ctor) ?? []), u.id]);
  }
  const reachedUnits = new Set<string>();
  const reachedFiles = new Set<string>();
  const perEntry: Record<string, { kind: EntryKind; units: number; files: number; components: string[] }> = {};
  for (const ep of entries) {
    // BFS over call / new / ref.
    const depth = new Map<string, number>();
    const parent = new Map<string, string | undefined>();
    const queue: string[] = [];
    for (const s of ep.units) if (!depth.has(s)) {
      depth.set(s, 0);
      parent.set(s, undefined);
      queue.push(s);
    }
    for (let i = 0; i < queue.length; i++) {
      const cur = queue[i] ?? '';
      const next = (g.out.get(cur) ?? []).map((e) => e.target);
      // An instantiated object may escape to code outside the project (a host, a framework): its public methods count
      // as reached (rapid type analysis, Bacon and Sweeney 1996).
      if (g.units.get(cur)?.kind === 'constructor') next.push(...(publicMethods.get(cur) ?? []));
      for (const t of next) {
        if (depth.has(t)) continue;
        depth.set(t, (depth.get(cur) ?? 0) + 1);
        parent.set(t, cur);
        queue.push(t);
      }
    }
    const comps = new Set<string>();
    const firstEdge = edges.length;
    const reachUnit: string[] = [];
    for (const [uid, d] of depth) {
      reachedUnits.add(uid);
      const u = g.units.get(uid);
      if (u === undefined) continue;
      comps.add(ctx.info(u.file).component);
      const target = ownerNodeId(ctx, u);
      if (target !== undefined && u.kind !== 'module') reachUnit.push(uid);
      if (target !== undefined && u.kind !== 'module') edges.push({ type: 'REACHES', proxy: 'reachability', sourceId: ep.id, targetId: target, score: 1 / (1 + d), evidence: [u.evidence], properties: { depth: d, unit: `${u.className !== undefined ? `${u.className}.` : ''}${u.name}` } });
    }
    // Component paths: the component sequence of the BFS-tree path to every leaf.
    const children = new Set([...parent.values()].filter((x): x is string => x !== undefined));
    const paths = new Set<string>();
    for (const uid of depth.keys()) {
      if (children.has(uid)) continue;
      const seq: string[] = [];
      for (let c: string | undefined = uid; c !== undefined; c = parent.get(c)) {
        const u = g.units.get(c);
        const comp = u === undefined ? '?' : ctx.info(u.file).component;
        if (seq[0] !== comp) seq.unshift(comp);
      }
      paths.add(seq.join(' > '));
    }
    const componentPaths = [...paths].sort().slice(0, 25);
    virtualNodes.push({ id: ep.id, kind: 'EntryPoint', name: ep.name, properties: { entryKind: ep.kind, file: ep.file, via: ep.via, reachedUnits: depth.size, components: [...comps].sort(), componentPaths } });
    perEntry[ep.id] = { kind: ep.kind, units: depth.size, files: new Set([...depth.keys()].map((x) => g.units.get(x)?.file)).size, components: [...comps].sort() };
    for (const s of ep.units) {
      const u = g.units.get(s);
      const id = u?.apgId;
      if (id !== undefined) nodeFacts.push({ proxy: 'reachability', nodeId: id, key: 'entryPoint', value: { kind: ep.kind, via: ep.via } });
    }

    // Core bypass: state = (unit, passed core). Calls and references only.
    if (ep.kind !== 'http' && ep.kind !== 'message') continue;
    const entryClasses = new Set(ep.inline ? [] : ep.units.map((x) => g.units.get(x)?.className).filter((x): x is string => x !== undefined));
    const seenState = new Set<string>();
    const back = new Map<string, string | undefined>();
    const q: { unit: string; core: boolean }[] = [];
    const reported = new Set<string>();
    const visit = (unit: string, core: boolean, from: string | undefined): void => {
      const key = `${unit}|${String(core)}`;
      if (seenState.has(key)) return;
      seenState.add(key);
      back.set(key, from);
      q.push({ unit, core });
      const t = g.units.get(unit);
      if (t === undefined || core || !isInfra(t) || (t.className !== undefined && entryClasses.has(t.className)) || reported.has(t.className ?? t.id)) return;
      reported.add(t.className ?? t.id);
      const chain: string[] = ep.inline ? [ep.name] : [];
      for (let k: string | undefined = key; k !== undefined; k = back.get(k)) {
        const u = g.units.get(k.slice(0, k.lastIndexOf('|')));
        chain.splice(ep.inline ? 1 : 0, 0, u === undefined ? '?' : `${u.className !== undefined ? `${u.className}.` : ''}${u.name}`);
      }
      const first = ep.inline ? undefined : g.units.get(ep.units[0] ?? '');
      flags.push({
        proxy: 'reachability', kind: 'endpoint-bypasses-core', score: 1, evidence: ep.evidence,
        ...(first?.className !== undefined ? { className: first.className } : {}), ...(first !== undefined ? { methodName: first.name } : {}),
        message: `${ep.kind} entry ${ep.name} reaches infrastructure ${t.className ?? t.name} without a core unit: ${chain.join(' -> ')}`,
        related: { ...t.evidence, ...(t.className !== undefined ? { className: t.className } : {}), methodName: t.name },
      });
    };
    for (const s of ep.units) {
      const u = g.units.get(s);
      visit(s, u !== undefined && isCore(u), undefined);
    }
    for (let i = 0; i < q.length; i++) {
      const cur = q[i];
      if (cur === undefined) continue;
      const curKey = `${cur.unit}|${String(cur.core)}`;
      for (const e of g.out.get(cur.unit) ?? []) {
        if (e.kind === 'new') continue;
        const t = g.units.get(e.target);
        if (t === undefined) continue;
        visit(e.target, cur.core || isCore(t), curKey);
      }
    }
    // REACHES of an http / message entry say whether a call path with no core unit reaches the unit (read by the
    // `endpoint-bypasses-application` template).
    const noCore = new Set(q.filter((x) => !x.core).map((x) => x.unit));
    for (let i = firstEdge; i < edges.length; i++) {
      const e = edges[i];
      const uid = reachUnit[i - firstEdge];
      const u = uid === undefined ? undefined : g.units.get(uid);
      if (e === undefined || u === undefined) continue;
      edges[i] = { ...e, properties: { ...e.properties, withoutCore: noCore.has(u.id), infrastructure: isInfra(u) && !(u.className !== undefined && entryClasses.has(u.className)) } };
    }
  }

  // Module reachability.
  for (const uid of reachedUnits) {
    const u = g.units.get(uid);
    if (u === undefined) continue;
    reachedFiles.add(u.file);
    for (const k of g.refDecls.get(uid) ?? []) reachedFiles.add(k.slice(0, k.indexOf('|')));
  }
  const fileOfNode = new Map(ctx.apg.nodes.filter((n) => n.type === 'File').map((n) => [n.id, n.filePath]));
  const runtimeImports = new Map<string, string[]>();
  for (const e of ctx.apg.edges) {
    if ((e.type !== 'IMPORTS' && e.type !== 'RE_EXPORTS') || e.properties.isTypeOnly === true || e.properties.reExportHop === true) continue;
    const s = fileOfNode.get(e.sourceId);
    const t = fileOfNode.get(e.targetId);
    if (s !== undefined && t !== undefined) runtimeImports.set(s, [...(runtimeImports.get(s) ?? []), t]);
  }
  const loaded = new Set(reachedFiles);
  const stack = [...reachedFiles];
  while (stack.length > 0) {
    const f = stack.pop() ?? '';
    for (const t of runtimeImports.get(f) ?? []) if (!loaded.has(t)) {
      loaded.add(t);
      stack.push(t);
    }
  }
  // A file reached by reference only (a type) is reached: refs were added to reachedFiles before the import closure.
  const unreachable: string[] = [];
  for (const { file, sf } of ctx.sources) {
    const id = ctx.info(file).fileNodeId;
    const reached = loaded.has(file);
    if (id !== undefined) nodeFacts.push({ proxy: 'reachability', nodeId: id, key: 'reachable', value: entries.length === 0 ? null : reached });
    if (entries.length === 0 || reached) continue;
    const runtime = sf.getClasses().length + sf.getFunctions().length + sf.getVariableStatements().length > 0;
    if (!runtime) continue;
    unreachable.push(file);
    flags.push({ proxy: 'reachability', kind: 'unreachable-module', score: 1, evidence: { file, startLine: 1, endLine: 1 }, message: `no entry point reaches ${file} (${String(entries.length)} entries)` });
  }
  return {
    edges, nodeFacts, flags, virtualNodes,
    summary: { entries: entries.length, entriesByKind: countBy(entries.map((e) => e.kind)), reachedUnits: reachedUnits.size, units: g.units.size, unreachableModules: unreachable, perEntry, coreKinds: [...core], flagsByKind: countKinds(flags) },
  };
}

function countBy(xs: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of xs) out[x] = (out[x] ?? 0) + 1;
  return out;
}
