/**
 * The projects the parity harness runs (Docs/v1.3/cypher-interpreter.md §4):
 * - the 71 v1.3 reference variants (5 styles), materialised under the OS temp directory exactly as the live
 *   reference run does, each with its style's spec;
 * - the APG v2 fixture suite (`tests/fixtures/v1.3-apg2`), whose graphs carry the APG v2 node and edge types;
 * - one synthetic APG with the shapes none of them has (`syntheticProject`).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { componentsFromLayerModel } from '../../../src/apg-extractor/index.js';
import type { ComponentDeclaration } from '../../../src/apg-extractor/index.js';
import type { LayerDefinition, LayerModel } from '../../../src/shared/types/spec.js';
import type { LayerKind } from '../../../src/shared/types/enums.js';
import type { APGEdge, APGNode, APGResult } from '../../../src/shared/types/apg.js';
import { loadAllReferences } from './reference-model.js';
import { materialiseVariant } from './materialise.js';

export interface ReferenceProject {
  readonly kind: 'reference';
  readonly id: string;
  readonly specPath: string;
  /** Materialises the variant under `root` and returns its directory. */
  readonly materialise: (root: string) => string;
}

export interface Apg2FixtureProject {
  readonly kind: 'apg2-fixture';
  readonly id: string;
  readonly dir: string;
  readonly layerModel: LayerModel;
  readonly components: ComponentDeclaration[];
  readonly allowedAsync: readonly string[];
}

export function referenceProjects(repoRoot: string, only?: (id: string) => boolean): ReferenceProject[] {
  const out: ReferenceProject[] = [];
  for (const ref of loadAllReferences(repoRoot)) {
    for (const v of ref.variants) {
      const id = `${ref.style}/${v.manifest.variant}`;
      if (only !== undefined && !only(id)) continue;
      out.push({ kind: 'reference', id, specPath: ref.specPath, materialise: (root) => materialiseVariant(ref, v, root).projectDir });
    }
  }
  return out;
}

interface SuiteProject {
  readonly layers: ReadonlyArray<{ name: string; directories: string[]; filePatterns?: string[]; kind: LayerKind }>;
  readonly components: 'layers' | 'folders' | ComponentDeclaration[];
  readonly allowedAsync?: string[];
}

/** As `scripts/v1.3/apg2-live.ts`: the suite's layer model and component declarations per fixture project. */
export function apg2FixtureProjects(repoRoot: string, only?: (id: string) => boolean): Apg2FixtureProject[] {
  const suiteDir = path.join(repoRoot, 'tests/fixtures/v1.3-apg2');
  const suite = JSON.parse(fs.readFileSync(path.join(suiteDir, 'cases.json'), 'utf8')) as { projects: Record<string, SuiteProject> };
  const out: Apg2FixtureProject[] = [];
  for (const [name, p] of Object.entries(suite.projects)) {
    const id = `apg2-fixture/${name}`;
    if (only !== undefined && !only(id)) continue;
    const layers: LayerDefinition[] = p.layers.map((l) => ({
      name: l.name, directories: l.directories, naming: [], role: '', kind: l.kind, kindSource: 'explicit',
      ...(l.filePatterns !== undefined ? { filePatterns: l.filePatterns } : {}),
    }));
    const layerModel: LayerModel = { layers };
    const components = p.components === 'folders' ? [] : p.components === 'layers' ? componentsFromLayerModel(layerModel) : p.components;
    out.push({ kind: 'apg2-fixture', id, dir: path.join(suiteDir, name), layerModel, components, allowedAsync: p.allowedAsync ?? [] });
  }
  return out;
}

export interface SyntheticProject {
  readonly kind: 'synthetic';
  readonly id: string;
  readonly apg: APGResult;
  readonly layerModel: LayerModel;
  /** Sweep parameters that override the generic binding (applied before the `low` / `high` bindings). */
  readonly params?: Readonly<Record<string, unknown>>;
}

/** Every synthetic graph the parity sweep runs: the shapes graph, then the graphs built for the thin templates. */
export function syntheticProjects(): SyntheticProject[] {
  return [syntheticProject(), thinTemplateProject('a'), thinTemplateProject('b')];
}

/**
 * The templates the first parity run of this fix compared on fewer than 50 non-empty statements ("thin"; Docs/v1.3/
 * cypher-interpreter.md §4.2). `thinTemplateProject` gives each of them violating rows under all three sweep
 * bindings (spec, low, high); `tests/unit/cypher-interp/template-order.test.ts` asserts it.
 */
export const THIN_TEMPLATES = [
  'boundary-type-leak', 'component-adp-cycle', 'component-main-sequence-distance', 'deep-import-declared-api', 'deep-import-inferred-api',
  'domain-event-placement', 'inheritance-depth', 'io-outside-adapters', 'module-domain-imports-infrastructure', 'naming-controllers',
  'no-index-logic', 'no-orphan-files', 'repository-aggregate-root', 'undeclared-async-coupling',
] as const;

/**
 * A synthetic APG (APG v1 and v2 node and edge types) on which every `THIN_TEMPLATES` entry returns rows under each
 * sweep binding, and so do `aggregate-boundary` and `dependency-direction-graph`, which no other synthetic or fixture
 * graph exercises. Two variants with different roots and names (`a` under `src/`, `b` under `lib/`, with more of every
 * shape) so that every APG v2 template (two compiled texts each) reaches at least 3 non-empty comparisons per binding.
 *
 * One deliberate out-of-range value: component `Shipping` has `distance` 2.5 (the extractor's distance is in [0, 1]),
 * so `component-main-sequence-distance` returns a row under the `high` binding (threshold 2) too. Everything else is a
 * shape the extractor emits. Aggregates are given explicitly and do not overlap (the row-grain precondition of the
 * aggregate templates, see the order-guard test).
 */
export function thinTemplateProject(variant: 'a' | 'b'): SyntheticProject {
  const root = variant === 'a' ? 'src' : 'lib';
  const extra = variant === 'b';
  const layer = (name: string, kind: LayerKind): LayerDefinition => ({ name, directories: [`${root}/${name}/**`], naming: [], role: '', kind, kindSource: 'explicit' });
  const layerModel: LayerModel = { layers: [layer('domain', 'domain'), layer('application', 'application'), layer('infrastructure', 'infrastructure'), layer('presentation', 'presentation')] };
  const nodes: APGNode[] = [];
  const edges: APGEdge[] = [];
  const node = (id: string, type: APGNode['type'], name: string, filePath: string, properties: Record<string, unknown> = {}): void => {
    nodes.push({ id, type, name, filePath, decorators: [], properties });
  };
  const edge = (type: APGEdge['type'], sourceId: string, targetId: string, properties: Record<string, unknown> = {}): void => {
    edges.push({ id: `${type}:${sourceId}->${targetId}`, type, sourceId, targetId, properties });
  };
  const f = (rel: string): string => `${root}/${rel}`;
  const file = (rel: string, properties: Record<string, unknown> = {}): string => {
    const fp = f(rel);
    node(`file:${fp}`, 'File', fp.slice(fp.lastIndexOf('/') + 1), fp, { isBarrel: false, ...properties });
    return `file:${fp}`;
  };
  const imp = (s: string, t: string, line: number): void => edge('IMPORTS', s, t, { line, lines: [line], isTypeOnly: false });

  // Files. `orphan*` have a layer and no import in or out (no-orphan-files).
  const order = file('domain/order/Order.ts');
  const orderItem = file('domain/order/OrderItem.ts');
  const invoice = file('domain/billing/Invoice.ts');
  file('domain/events/DomainEvent.ts');
  const barrel = file('domain/index.ts', { isBarrel: true });
  const service = file('application/OrderService.ts');
  const handler = file('application/ShipOrderHandler.ts');
  const repo = file('infrastructure/OrderRepository.ts');
  const invRepo = file('infrastructure/InvoiceRepository.ts');
  const db = file('infrastructure/Db.ts');
  const ctrl = file('presentation/OrdersController.ts');
  file('domain/orphan/Clock.ts');
  file('application/orphan/Unused.ts');
  if (extra) {
    file('infrastructure/orphan/Legacy.ts');
    file('presentation/orphan/OldView.ts');
  }

  // Imports: a domain file importing application (dependency-direction-graph: domain>application is not allowed but
  // application>domain is); repositories reaching into aggregate internals (repository-aggregate-root,
  // aggregate-boundary); the barrel re-exported nowhere but declaring code (no-index-logic).
  imp(order, service, 3);
  imp(order, orderItem, 1);
  imp(service, order, 2);
  imp(service, repo, 4);
  imp(handler, order, 5);
  imp(handler, orderItem, 6);
  imp(repo, orderItem, 2);
  imp(repo, order, 1);
  imp(invRepo, invoice, 1);
  imp(invRepo, orderItem, 7);
  imp(repo, db, 3);
  imp(ctrl, service, 1);
  imp(ctrl, invoice, 9);
  if (extra) {
    imp(invoice, handler, 4);
    imp(db, invoice, 8);
  }

  // Classes, with an EXTENDS chain of depth 3 (inheritance-depth, maxDepth <= 1) and domain events
  // (domain-event-placement: a class outside the domain layer that implements or extends an event type).
  const cls = (id: string, name: string, fp: string, properties: Record<string, unknown> = {}): string => {
    node(`class:${variant}:${id}`, 'Class', name, fp, properties);
    return `class:${variant}:${id}`;
  };
  const base = cls('Base', 'EntityBase', f('domain/order/Order.ts'));
  const agg = cls('Agg', 'AggregateBase', f('domain/order/Order.ts'));
  const orderC = cls('Order', 'Order', f('domain/order/Order.ts'));
  const special = cls('Special', 'SpecialOrder', f('domain/order/Order.ts'));
  edge('EXTENDS', agg, base);
  edge('EXTENDS', orderC, agg);
  edge('EXTENDS', special, orderC);
  const domainEvent = cls('DomainEvent', 'DomainEvent', f('domain/events/DomainEvent.ts'));
  const eventIface = `iface:${variant}:Event`;
  node(eventIface, 'Interface', 'Event', f('domain/events/DomainEvent.ts'));
  const shipped = cls('Shipped', 'OrderShippedEvent', f('application/ShipOrderHandler.ts'));
  const paid = cls('Paid', 'InvoicePaidEvent', f('infrastructure/Db.ts'));
  edge('EXTENDS', shipped, domainEvent);
  edge('IMPLEMENTS', paid, eventIface);
  const svcC = cls('Svc', 'OrderService', f('application/OrderService.ts'));
  const repoC = cls('Repo', 'OrderRepository', f('infrastructure/OrderRepository.ts'));
  if (extra) {
    const deeper = cls('Deeper', 'VerySpecialOrder', f('domain/order/Order.ts'));
    edge('EXTENDS', deeper, special);
    const audit = cls('Audit', 'AuditEvent', f('presentation/OrdersController.ts'));
    edge('EXTENDS', audit, domainEvent);
  }

  // NestJS-style modules: a domain module importing an infrastructure module (module-domain-imports-infrastructure).
  const domMod = cls('DomMod', 'OrderDomainModule', f('domain/order/Order.ts'));
  const infMod = cls('InfMod', 'PersistenceModule', f('infrastructure/Db.ts'));
  edge('MODULE_IMPORTS', domMod, infMod, { line: 12 });
  if (extra) {
    const infMod2 = cls('InfMod2', 'MessagingModule', f('infrastructure/OrderRepository.ts'));
    edge('MODULE_IMPORTS', domMod, infMod2, { line: 13 });
  }

  // Controllers (naming-controllers): a presentation class whose name breaks the naming pattern (spec and high
  // bindings), and a domain class with a Controller decorator (the low binding sets controllerLayer to the domain).
  cls('Ctrl', 'orders_controller', f('presentation/OrdersController.ts'), { decorators: ['Controller'] });
  cls('DomCtrl', 'DomainController', f('domain/order/Order.ts'), { decorators: ['Controller', 'Injectable'] });
  if (extra) cls('Ctrl2', 'invoices-controller', f('presentation/OrdersController.ts'), { decorators: ['RestController'] });

  // The barrel declares code (no-index-logic).
  node(`fn:${variant}:helper`, 'Function', 'formatOrder', f('domain/index.ts'));
  edge('DECLARES', barrel, `fn:${variant}:helper`);
  edge('DECLARES', barrel, orderC);

  // Members for the APG v2 member-level edges.
  const method = (owner: string, name: string, fp: string): string => {
    const id = `method:${variant}:${name}`;
    node(id, 'Method', name, fp);
    edge('CONTAINS', owner, id);
    return id;
  };
  const place = method(svcC, 'OrderService.place', f('application/OrderService.ts'));
  const ship = method(svcC, 'OrderService.ship', f('application/OrderService.ts'));
  const total = method(orderC, 'Order.total', f('domain/order/Order.ts'));
  const save = method(repoC, 'OrderRepository.save', f('infrastructure/OrderRepository.ts'));

  // boundary-type-leak: application members whose public signature uses an infrastructure type.
  edge('SIGNATURE_USES', place, repoC, { publicSurface: true, positions: ['parameter'], inferred: false });
  edge('SIGNATURE_USES', ship, repoC, { publicSurface: true, positions: ['return'], inferred: true });
  edge('SIGNATURE_USES', total, repoC, { publicSurface: false, positions: ['parameter'], inferred: false });

  // io-outside-adapters: domain and application members performing db / http / fs I/O.
  for (const io of ['db', 'http-out', 'fs', 'clock']) node(`io:${variant}:${io}`, 'IOCategory', io, '');
  edge('PERFORMS_IO', place, `io:${variant}:db`, { apis: ['query'], line: 20, lines: [20, 24] });
  edge('PERFORMS_IO', total, `io:${variant}:http-out`, { apis: ['fetch'], line: 7, lines: [7] });
  edge('PERFORMS_IO', save, `io:${variant}:db`, { apis: ['insert'], line: 3, lines: [3] });
  if (extra) edge('PERFORMS_IO', ship, `io:${variant}:fs`, { apis: ['writeFile'], line: 31, lines: [31] });

  // Components (APG v2): an ADP cycle between two modules, a main-sequence outlier, BELONGS_TO for async coupling.
  const comp = (name: string, properties: Record<string, unknown>): string => {
    const id = `component:${variant}:${name}`;
    node(id, 'Component', name, '', properties);
    return id;
  };
  const orders = comp('Orders', { kind: 'module', typeCount: 6, abstractness: 0.1, instability: 0.1, distance: 0.8 });
  const billing = comp('Billing', { kind: 'module', typeCount: 4, abstractness: 0.5, instability: 0.5, distance: 0 });
  const shipping = comp('Shipping', { kind: 'module', typeCount: 9, abstractness: 0, instability: 0, distance: 2.5 });
  const domainLayerC = comp('domain', { kind: 'layer', typeCount: 12, abstractness: 0, instability: 0, distance: 1 });
  edge('DEPENDS_ON', orders, billing, { kind: 'module', imports: 3 });
  edge('DEPENDS_ON', billing, orders, { kind: 'module', imports: 1 });
  edge('DEPENDS_ON', shipping, orders, { kind: 'module', imports: 2 });
  edge('DEPENDS_ON', domainLayerC, orders, { kind: 'layer', imports: 1 });
  if (extra) {
    edge('DEPENDS_ON', orders, shipping, { kind: 'module', imports: 4 });
    comp('Reporting', { kind: 'folder', typeCount: 5, abstractness: 0.9, instability: 0.9, distance: 0.8 });
  }
  edge('BELONGS_TO', order, orders);
  edge('BELONGS_TO', service, orders);
  edge('BELONGS_TO', invoice, billing);
  edge('BELONGS_TO', handler, shipping);
  edge('BELONGS_TO', repo, orders);

  // deep-import-*: files importing past a component's public API (declared and inferred), kinds module and folder.
  edge('DEEP_IMPORT', ctrl, invoice, { publicApiDeclared: true, kind: 'module', component: 'Billing', line: 9 });
  edge('DEEP_IMPORT', handler, orderItem, { publicApiDeclared: false, kind: 'folder', component: 'Orders', line: 6 });
  edge('DEEP_IMPORT', invRepo, orderItem, { publicApiDeclared: true, kind: 'folder', component: 'Orders', line: 7 });
  edge('DEEP_IMPORT', repo, orderItem, { publicApiDeclared: false, kind: 'module', component: 'Orders', line: 2 });

  // undeclared-async-coupling: a publisher and a subscriber in different module components on one channel.
  node(`channel:${variant}:orders`, 'Channel', 'order.placed', '', { transport: 'event-emitter' });
  node(`channel:${variant}:billing`, 'Channel', 'invoice.paid', '', { transport: 'kafka' });
  edge('PUBLISHES', place, `channel:${variant}:orders`);
  edge('SUBSCRIBES', `class:${variant}:Shipped`, `channel:${variant}:orders`);
  const invoiceC = cls('Invoice', 'Invoice', f('domain/billing/Invoice.ts'));
  edge('SUBSCRIBES', invoiceC, `channel:${variant}:orders`);
  edge('PUBLISHES', invoiceC, `channel:${variant}:billing`);
  edge('SUBSCRIBES', total, `channel:${variant}:billing`);

  const roots = [`${root}/domain/order/`, `${root}/domain/billing/`];
  return {
    kind: 'synthetic', id: `synthetic/thin-${variant}`, apg: { nodes, edges } as unknown as APGResult, layerModel,
    params: {
      aggregates: [
        { name: 'OrderAggregate', innerEntities: [`${roots[0] ?? ''}OrderItem\\.ts$`], module: `${roots[0] ?? ''}.*` },
        { name: 'InvoiceAggregate', innerEntities: [`${roots[1] ?? ''}Invoice\\.ts$`], module: `${roots[1] ?? ''}.*` },
      ],
    },
  };
}

/**
 * A hand-built APG with the shapes no reference project has, so the templates that read them are compared on rows,
 * not on empty results: a four-class EXTENDS chain (inheritance-depth, domain-event-placement), MODULE_IMPORTS
 * (module-domain-imports-infrastructure), class decorators (naming-controllers), a barrel that declares code
 * (no-index-logic), an interface with many methods, injections across layers, unlayered files and null-valued
 * properties (three-valued logic). It goes through the real `ingestAPG`, like every other graph.
 */
export function syntheticProject(): SyntheticProject {
  const layer = (name: string, kind: LayerKind): LayerDefinition => ({ name, directories: [`src/${name}/**`], naming: [], role: '', kind, kindSource: 'explicit' });
  const layerModel: LayerModel = { layers: [layer('domain', 'domain'), layer('application', 'application'), layer('infrastructure', 'infrastructure'), layer('presentation', 'presentation')] };
  const nodes: APGNode[] = [];
  const edges: APGEdge[] = [];
  const node = (id: string, type: APGNode['type'], name: string, filePath: string, properties: Record<string, unknown> = {}): void => {
    nodes.push({ id, type, name, filePath, decorators: [], properties });
  };
  const edge = (type: APGEdge['type'], sourceId: string, targetId: string, properties: Record<string, unknown> = {}): void => {
    edges.push({ id: `${type}:${sourceId}->${targetId}`, type, sourceId, targetId, properties });
  };
  const files = ['src/domain/Base.ts', 'src/domain/Entities.ts', 'src/domain/index.ts', 'src/application/OrderService.ts', 'src/infrastructure/OrderRepository.ts',
    'src/infrastructure/InfraModule.ts', 'src/domain/DomainModule.ts', 'src/presentation/OrderController.ts', 'src/presentation/BadController.ts', 'scripts/tool.ts', 'src/domain/Base.spec.ts'];
  for (const f of files) node(`file:${f}`, 'File', f.slice(f.lastIndexOf('/') + 1), f, { isBarrel: f.endsWith('index.ts') });
  node('class:Base', 'Class', 'BaseEntity', 'src/domain/Base.ts');
  node('class:Mid', 'Class', 'AggregateRoot', 'src/domain/Entities.ts');
  node('class:Leaf', 'Class', 'OrderEntity', 'src/domain/Entities.ts');
  node('class:Leaf2', 'Class', 'SpecialOrderEntity', 'src/domain/Entities.ts', { isAbstract: null });
  node('class:Event', 'Class', 'OrderPlacedEvent', 'src/application/OrderService.ts');
  node('class:Svc', 'Class', 'OrderService', 'src/application/OrderService.ts');
  node('class:Repo', 'Class', 'OrderRepository', 'src/infrastructure/OrderRepository.ts');
  node('class:DomMod', 'Class', 'DomainModule', 'src/domain/DomainModule.ts');
  node('class:InfMod', 'Class', 'InfraModule', 'src/infrastructure/InfraModule.ts');
  node('class:Ctrl', 'Class', 'OrderController', 'src/presentation/OrderController.ts', { decorators: ['Controller', 'UseGuards'] });
  node('class:Bad', 'Class', 'orders_ctrl', 'src/presentation/BadController.ts', { decorators: ['Controller'] });
  node('iface:Repo', 'Interface', 'IOrderRepository', 'src/domain/Entities.ts');
  node('fn:helper', 'Function', 'helper', 'src/domain/index.ts');
  for (const m of ['find', 'save', 'delete', 'count', 'exists']) {
    node(`method:IOrderRepository.${m}`, 'Method', `IOrderRepository.${m}`, 'src/domain/Entities.ts');
    edge('CONTAINS', 'iface:Repo', `method:IOrderRepository.${m}`);
  }
  for (const [m, isStatic] of [['setTotal', false], ['setStatus', null], ['create', true]] as const) {
    node(`method:OrderEntity.${m}`, 'Method', `OrderEntity.${m}`, 'src/domain/Entities.ts', { isStatic });
    edge('CONTAINS', 'class:Leaf', `method:OrderEntity.${m}`);
  }
  edge('EXTENDS', 'class:Mid', 'class:Base');
  edge('EXTENDS', 'class:Leaf', 'class:Mid');
  edge('EXTENDS', 'class:Leaf2', 'class:Leaf');
  edge('EXTENDS', 'class:Event', 'class:Base');
  edge('IMPLEMENTS', 'class:Repo', 'iface:Repo');
  edge('MODULE_IMPORTS', 'class:DomMod', 'class:InfMod', { line: 4 });
  edge('CONSTRUCTOR_INJECTS', 'class:Svc', 'class:Repo', { parameterName: 'repo', line: 7 });
  edge('CONSTRUCTOR_INJECTS', 'class:Svc', 'iface:Repo', { parameterName: 'port' });
  edge('CONSTRUCTOR_INJECTS', 'class:Ctrl', 'class:Svc', { parameterName: 'svc' });
  edge('CONSTRUCTOR_INJECTS', 'class:Ctrl', 'class:Leaf', { parameterName: 'entity' });
  edge('CONSTRUCTOR_INJECTS', 'class:Leaf', 'class:Repo', { parameterName: 'leak' });
  edge('FLOWS_TO', 'class:Leaf2', 'class:Repo', { field: 'repo', line: 3 });
  edge('DECLARES', 'file:src/domain/index.ts', 'fn:helper');
  edge('DECLARES', 'file:src/domain/Base.ts', 'class:Base');
  edge('DECLARES', 'file:src/domain/Entities.ts', 'class:Leaf');
  const imp = (s: string, t: string, line: number, extra: Record<string, unknown> = {}): void => edge('IMPORTS', `file:${s}`, `file:${t}`, { line, lines: [line], isTypeOnly: false, specifier: t, ...extra });
  imp('src/domain/Entities.ts', 'src/domain/Base.ts', 1);
  imp('src/domain/Entities.ts', 'src/infrastructure/OrderRepository.ts', 2, { isTypeOnly: true });
  imp('src/application/OrderService.ts', 'src/domain/index.ts', 1, { reExportHop: true });
  imp('src/application/OrderService.ts', 'src/domain/Entities.ts', 1, { viaReExport: true });
  imp('src/presentation/OrderController.ts', 'src/application/OrderService.ts', 3);
  imp('src/presentation/OrderController.ts', 'src/domain/Entities.ts', 4);
  imp('src/infrastructure/OrderRepository.ts', 'src/domain/Entities.ts', 1);
  imp('src/infrastructure/InfraModule.ts', 'src/infrastructure/OrderRepository.ts', 2);
  imp('scripts/tool.ts', 'src/presentation/OrderController.ts', 9);
  edge('RE_EXPORTS', 'file:src/domain/index.ts', 'file:src/domain/Entities.ts', { line: 1, lines: [1], exportedNames: ['*'], isTypeOnly: false });
  edge('RE_EXPORTS', 'file:src/domain/Base.ts', 'file:src/domain/Entities.ts', { line: 5, lines: [5], exportedNames: ['OrderEntity'], isTypeOnly: false });
  node('pkg:express', 'Package', 'express', '');
  node('pkg:typeorm', 'Package', 'typeorm', '');
  edge('IMPORTS', 'file:src/domain/Entities.ts', 'pkg:typeorm', { line: 3, lines: [3], isTypeOnly: false });
  edge('IMPORTS', 'file:src/domain/Base.ts', 'pkg:express', { line: 2, lines: [2, 8], isTypeOnly: true });
  return { kind: 'synthetic', id: 'synthetic/shapes', apg: { nodes, edges } as unknown as APGResult, layerModel };
}
