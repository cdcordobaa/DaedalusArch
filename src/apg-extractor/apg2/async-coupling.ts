import { Node, SyntaxKind } from 'ts-morph';
import type { CallExpression, Decorator, SourceFile, Type } from 'ts-morph';
import type { APGEdge, APGNode } from '../../shared/types/apg.js';
import type { NodeLookup } from '../types.js';
import { normalizeFilePath } from '../id-generator.js';
import { apg2Edge, apg2Node, chainRoot, lineOf, literalString, originOfValue, packageRoot } from './common.js';
import { hostIndependentCompare } from '../../shared/collation.js';

/**
 * Enrichment 4, async coupling: PUBLISHES and SUBSCRIBES edges from the owning Method / Function / Class / File node to
 * a Channel node `(transport, name)`. Detected by package + call shape (the receiver's origin package, see
 * `originOfValue`) and by handler decorators:
 *
 * | transport | publish | subscribe |
 * |---|---|---|
 * | `event` (node `events`, `eventemitter2`, `@nestjs/event-emitter`) | `x.emit('name', …)` | `x.on / once / addListener / prependListener('name', …)`, `@OnEvent('name')` |
 * | `cqrs-event` / `cqrs-command` / `cqrs-query` (`@nestjs/cqrs`) | `eventBus.publish(new E())`, `commandBus.execute(new C())`, `queryBus.execute(new Q())` | `@EventsHandler(E)`, `@CommandHandler(C)`, `@QueryHandler(Q)`; channel name = the class name |
 * | `queue` (`bullmq`, `bull`, `@nestjs/bullmq`, `@nestjs/bull`) | `queue.add(…)` / `addBulk`, queue name from `new Queue('name')` or `@InjectQueue('name')` | `new Worker('name', …)`, `@Processor('name')` |
 * | `topic` (`kafkajs`) | `producer.send({ topic: 'name' })` | `consumer.subscribe({ topic \| topics })` |
 * | `amqp-queue` / `amqp-exchange` (`amqplib`) | `ch.sendToQueue('q')` / `ch.publish('ex', …)` | `ch.consume('q')` |
 *
 * A channel name must be a string literal (or a class name, for CQRS). Computed names are counted as `dynamicNames`
 * and produce no edge. Channels are keyed by name only: two emitter instances with one event name are one channel.
 */

const EMITTER_PKGS = new Set(['events', 'eventemitter2', 'eventemitter3', '@nestjs/event-emitter']);
const QUEUE_PKGS = new Set(['bullmq', 'bull', '@nestjs/bullmq', '@nestjs/bull']);
const SUBSCRIBE_METHODS = new Set(['on', 'once', 'addListener', 'prependListener', 'prependOnceListener']);

export interface AsyncStats {
  publishes: number;
  subscribes: number;
  dynamicNames: number;
}

interface Hit {
  readonly kind: 'PUBLISHES' | 'SUBSCRIBES';
  readonly transport: string;
  readonly name: string;
  readonly node: Node;
  readonly via: string;
}

function typeNames(type: Type, depth = 0): string[] {
  if (depth > 5) return [];
  const names: string[] = [];
  const s = type.getSymbol();
  if (s !== undefined) names.push(s.getName());
  for (const b of type.getBaseTypes()) names.push(...typeNames(b, depth + 1));
  return names;
}

/** True when a receiver is an event emitter: by origin package, by its (base) type names, or a class extending one. */
function isEmitter(receiver: Node): boolean {
  const o = originOfValue(receiver);
  if (o !== undefined && EMITTER_PKGS.has(packageRoot(o.pkg))) return true;
  try {
    const names = typeNames((receiver as unknown as { getType(): Type }).getType());
    if (names.some((n) => n === 'EventEmitter' || n === 'EventEmitter2')) return true;
  } catch {
    // lenient
  }
  if (receiver.getKind() === SyntaxKind.ThisKeyword) {
    const cls = receiver.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);
    const ext = cls?.getExtends()?.getExpression();
    if (ext !== undefined) {
      const eo = originOfValue(ext);
      if (eo !== undefined && EMITTER_PKGS.has(packageRoot(eo.pkg))) return true;
    }
  }
  return false;
}

/** The class named by `new E(…)` or by an identifier's type; undefined for anything else. */
function messageClassName(arg: Node | undefined): string | undefined {
  if (arg === undefined) return undefined;
  if (Node.isNewExpression(arg)) return arg.getExpression().getText().split('.').pop();
  try {
    const sym = (arg as unknown as { getType(): Type }).getType().getSymbol();
    const d = sym?.getDeclarations()[0];
    if (d !== undefined && Node.isClassDeclaration(d)) return d.getName();
  } catch {
    // lenient
  }
  return undefined;
}

/** Queue name of a bull/bullmq queue value: `new Queue('name')` initializer or `@InjectQueue('name')` on its declaration. */
function queueNameOf(receiver: Node): string | undefined {
  const root = chainRoot(receiver);
  const target = Node.isPropertyAccessExpression(root) ? root.getNameNode() : root;
  for (const d of target.getSymbol()?.getDeclarations() ?? []) {
    if (Node.isParameterDeclaration(d) || Node.isPropertyDeclaration(d)) {
      for (const dec of d.getDecorators()) {
        if (dec.getName() === 'InjectQueue') return literalString(dec.getArguments()[0]);
      }
    }
    if (Node.isVariableDeclaration(d) || Node.isPropertyDeclaration(d)) {
      const init = d.getInitializer();
      if (init !== undefined && Node.isNewExpression(init)) return literalString(init.getArguments()[0]);
    }
  }
  return undefined;
}

/** `{ topic: 'x' }` or `{ topics: ['a', 'b'] }` → names; `undefined` when the argument is not such a literal. */
function topicsOf(arg: Node | undefined): string[] | undefined {
  if (arg === undefined || !Node.isObjectLiteralExpression(arg)) return undefined;
  const out: string[] = [];
  for (const p of arg.getProperties()) {
    if (!Node.isPropertyAssignment(p)) continue;
    const init = p.getInitializer();
    if (p.getName() === 'topic') {
      const s = literalString(init);
      if (s === undefined) return undefined;
      out.push(s);
    } else if (p.getName() === 'topics' && init !== undefined && Node.isArrayLiteralExpression(init)) {
      for (const el of init.getElements()) {
        const s = literalString(el);
        if (s === undefined) return undefined;
        out.push(s);
      }
    }
  }
  return out.length > 0 ? out : undefined;
}

function callHits(call: CallExpression, stats: AsyncStats): Hit[] {
  const expr = call.getExpression();
  if (!Node.isPropertyAccessExpression(expr)) return [];
  const method = expr.getName();
  const receiver = expr.getExpression();
  const args = call.getArguments();
  const named = (kind: Hit['kind'], transport: string, name: string | undefined, via: string): Hit[] => {
    if (name === undefined) {
      stats.dynamicNames++;
      return [];
    }
    return [{ kind, transport, name, node: call, via }];
  };

  if (method === 'emit' || SUBSCRIBE_METHODS.has(method)) {
    if (!isEmitter(receiver)) return [];
    return named(method === 'emit' ? 'PUBLISHES' : 'SUBSCRIBES', 'event', literalString(args[0]), `${method}()`);
  }
  const origin = originOfValue(receiver);
  if (origin === undefined) return [];
  const pkg = packageRoot(origin.pkg);
  if (pkg === '@nestjs/cqrs' && (method === 'publish' || method === 'publishAll' || method === 'execute')) {
    const bus = origin.name;
    const transport = bus === 'CommandBus' ? 'cqrs-command' : bus === 'QueryBus' ? 'cqrs-query' : 'cqrs-event';
    if (method === 'publishAll') {
      const arr = args[0];
      if (arr === undefined || !Node.isArrayLiteralExpression(arr)) return named('PUBLISHES', transport, undefined, method);
      return arr.getElements().flatMap((el) => named('PUBLISHES', transport, messageClassName(el), `${bus}.${method}()`));
    }
    return named('PUBLISHES', transport, messageClassName(args[0]), `${bus}.${method}()`);
  }
  if (QUEUE_PKGS.has(pkg) && (method === 'add' || method === 'addBulk')) {
    return named('PUBLISHES', 'queue', queueNameOf(receiver), `Queue.${method}()`);
  }
  if (pkg === 'kafkajs' && (method === 'send' || method === 'subscribe')) {
    const topics = topicsOf(args[0]);
    if (topics === undefined) return named(method === 'send' ? 'PUBLISHES' : 'SUBSCRIBES', 'topic', undefined, method);
    return topics.flatMap((t) => named(method === 'send' ? 'PUBLISHES' : 'SUBSCRIBES', 'topic', t, `kafkajs ${method}()`));
  }
  if (pkg === 'amqplib' && (method === 'sendToQueue' || method === 'publish' || method === 'consume')) {
    if (method === 'publish') return named('PUBLISHES', 'amqp-exchange', literalString(args[0]), 'amqplib publish()');
    return named(method === 'consume' ? 'SUBSCRIBES' : 'PUBLISHES', 'amqp-queue', literalString(args[0]), `amqplib ${method}()`);
  }
  return [];
}

function decoratorHits(dec: Decorator, stats: AsyncStats): Hit[] {
  const name = dec.getName();
  const args = dec.getArguments();
  const one = (transport: string, n: string | undefined): Hit[] => {
    if (n === undefined) {
      stats.dynamicNames++;
      return [];
    }
    return [{ kind: 'SUBSCRIBES', transport, name: n, node: dec, via: `@${name}` }];
  };
  switch (name) {
    case 'OnEvent': return one('event', literalString(args[0]));
    case 'Processor': return one('queue', literalString(args[0]));
    case 'EventsHandler':
    case 'CommandHandler':
    case 'QueryHandler': {
      const transport = name === 'EventsHandler' ? 'cqrs-event' : name === 'CommandHandler' ? 'cqrs-command' : 'cqrs-query';
      return args.flatMap((a) => one(transport, Node.isIdentifier(a) ? a.getText() : undefined));
    }
    default: return [];
  }
}

export function extractAsyncCoupling(
  sourceFiles: readonly SourceFile[],
  lookup: NodeLookup,
  projectRoot: string,
  ownerOf: (node: Node, filePath: string) => string | undefined,
): { nodes: APGNode[]; edges: APGEdge[]; stats: AsyncStats } {
  const stats: AsyncStats = { publishes: 0, subscribes: 0, dynamicNames: 0 };
  const channels = new Map<string, APGNode>();
  const edges = new Map<string, APGEdge>();

  for (const sf of sourceFiles) {
    const filePath = normalizeFilePath(sf.getFilePath(), projectRoot);
    if (!lookup.fileNodes.has(filePath)) continue;
    const hits: Hit[] = [];
    sf.forEachDescendant((node) => {
      if (Node.isCallExpression(node) && !Node.isDecorator(node.getParent())) hits.push(...callHits(node, stats));
      else if (Node.isNewExpression(node)) {
        // bullmq `new Worker('name', processor)`
        const origin = originOfValue(node.getExpression());
        if (origin !== undefined && QUEUE_PKGS.has(packageRoot(origin.pkg)) && origin.name === 'Worker') {
          const n = literalString(node.getArguments()[0]);
          if (n === undefined) stats.dynamicNames++;
          else hits.push({ kind: 'SUBSCRIBES', transport: 'queue', name: n, node, via: 'new Worker()' });
        }
      } else if (Node.isDecorator(node)) hits.push(...decoratorHits(node, stats));
    });
    for (const h of hits) {
      // A class decorator subscribes the class; a method decorator its method; a call its owning member.
      const anchor = Node.isDecorator(h.node) ? h.node.getParent() : h.node;
      const owner = ownerOf(anchor, filePath);
      if (owner === undefined) continue;
      const key = `${h.transport}:${h.name}`;
      let ch = channels.get(key);
      if (ch === undefined) {
        ch = apg2Node('Channel', `channel:${h.transport}`, h.name, { transport: h.transport });
        channels.set(key, ch);
      }
      const ekey = `${h.kind}:${owner}:${ch.id}`;
      const existing = edges.get(ekey);
      if (existing !== undefined) {
        (existing.properties.lines as number[]).push(lineOf(h.node));
        continue;
      }
      if (h.kind === 'PUBLISHES') stats.publishes++;
      else stats.subscribes++;
      edges.set(ekey, apg2Edge(h.kind, owner, ch.id, { transport: h.transport, via: h.via, line: lineOf(h.node), lines: [lineOf(h.node)] }));
    }
  }
  const nodes = [...channels.values()].sort((a, b) => hostIndependentCompare(a.filePath + a.name, b.filePath + b.name));
  return { nodes, edges: [...edges.values()], stats };
}
