/**
 * APG v2 extraction (`apg2` option, `V13_APG2_OPTIONS`): the five enrichments on the fixture suite
 * `tests/fixtures/v1.3-apg2/`, and the guarantee that the v1.2E and v1.3 graphs are unchanged. Design:
 * Docs/v1.3/apg2-design.md.
 */
import * as path from 'node:path';
import { extractAPG, componentsFromLayerModel, V12E_DEFAULT_OPTIONS, V13_APG2_OPTIONS, V13_DEFAULT_OPTIONS } from '../../../src/apg-extractor/index.js';
import type { ComponentDeclaration, ExtractorOptions } from '../../../src/apg-extractor/index.js';
import { folderComponents } from '../../../src/apg-extractor/apg2/components.js';
import { normalizePackage, packageRoot } from '../../../src/apg-extractor/apg2/common.js';
import type { APGEdge, APGNode, APGResult } from '../../../src/shared/types/apg.js';
import { APG2_EDGE_TYPES, APG2_NODE_TYPES } from '../../../src/shared/types/enums.js';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const SUITE = path.join(REPO_ROOT, 'tests/fixtures/v1.3-apg2');
const fx = (name: string): string => path.join(SUITE, name);

async function extract(dir: string, options: ExtractorOptions): Promise<APGResult> {
  const r = await extractAPG(dir, options);
  if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
  return r.data;
}

/** Edges of a type as `source -> target` labels (`name@filePath` for File-less names). */
function edges(apg: APGResult, type: string): { s: APGNode; t: APGNode; e: APGEdge }[] {
  const byId = new Map(apg.nodes.map((n) => [n.id, n]));
  const get = (id: string): APGNode => {
    const n = byId.get(id);
    if (n === undefined) throw new Error(`dangling ${id}`);
    return n;
  };
  return apg.edges.filter((e) => e.type === type).map((e) => ({ s: get(e.sourceId), t: get(e.targetId), e }));
}

function component(apg: APGResult, name: string): APGNode {
  const n = apg.nodes.find((x) => x.type === 'Component' && x.name === name);
  if (n === undefined) throw new Error(`no component ${name}`);
  return n;
}

describe('APG v2: options and isolation', () => {
  it('is OFF in the v1.2E and v1.3 defaults, ON only in V13_APG2_OPTIONS', () => {
    expect(V12E_DEFAULT_OPTIONS.apg2).toBe(false);
    expect(V13_DEFAULT_OPTIONS.apg2).toBe(false);
    expect(V13_APG2_OPTIONS).toEqual({ ...V13_DEFAULT_OPTIONS, apg2: true });
  });

  it.each(['type-flow', 'async', 'io'])('%s: without the option no APG v2 node, edge or stats appear', async (name) => {
    for (const opts of [V12E_DEFAULT_OPTIONS, V13_DEFAULT_OPTIONS]) {
      const apg = await extract(fx(name), opts);
      expect(apg.nodes.filter((n) => (APG2_NODE_TYPES as readonly string[]).includes(n.type))).toEqual([]);
      expect(apg.edges.filter((e) => (APG2_EDGE_TYPES as readonly string[]).includes(e.type))).toEqual([]);
      expect(apg.apg2).toBeUndefined();
    }
  });

  it.each([
    path.join(REPO_ROOT, 'fixtures/correct-reference'),
    path.join(REPO_ROOT, 'tests/fixtures/v1.3-reference/nestjs/project'),
    fx('public-api'),
  ])('the APG v2 graph starts with the v1.3 graph, unchanged (%s)', async (dir) => {
    const v13 = await extract(dir, V13_DEFAULT_OPTIONS);
    const v2 = await extract(dir, V13_APG2_OPTIONS);
    expect(v2.nodes.slice(0, v13.nodes.length)).toEqual(v13.nodes);
    expect(v2.edges.slice(0, v13.edges.length)).toEqual(v13.edges);
    expect(v2.nodes.slice(v13.nodes.length).every((n) => (APG2_NODE_TYPES as readonly string[]).includes(n.type))).toBe(true);
    expect(v2.edges.slice(v13.edges.length).every((e) => (APG2_EDGE_TYPES as readonly string[]).includes(e.type))).toBe(true);
    expect({ ...v2, nodes: [], edges: [], apg2: undefined }).toEqual({ ...v13, nodes: [], edges: [], apg2: undefined });
  });

  it('is deterministic', async () => {
    const a = await extract(fx('async'), V13_APG2_OPTIONS);
    const b = await extract(fx('async'), V13_APG2_OPTIONS);
    expect({ ...a, apg2: { ...a.apg2, timingsMs: null } }).toEqual({ ...b, apg2: { ...b.apg2, timingsMs: null } });
  });
});

describe('APG v2 (1): SIGNATURE_USES', () => {
  let apg: APGResult;
  beforeAll(async () => { apg = await extract(fx('type-flow'), V13_APG2_OPTIONS); });
  const use = (member: string, type: string): Record<string, unknown> | undefined =>
    edges(apg, 'SIGNATURE_USES').find((x) => x.s.name === member && x.t.name === type)?.e.properties;

  it('resolves inferred return types through Promise, arrays, generics and object types', () => {
    expect(use('UserController.get', 'UserRecord')).toEqual({ positions: ['return'], inferred: true, visibility: 'public', ownerExported: true, publicSurface: true });
    expect(use('UserController.orders', 'OrderRow')).toMatchObject({ positions: ['return'], inferred: true });
    expect(use('UserController.profile', 'UserRecord')).toMatchObject({ positions: ['return'], inferred: true });
  });

  it('resolves a derived parameter type (indexed access) and marks the position', () => {
    expect(use('UserController.update', 'UserRecord')).toMatchObject({ positions: ['param'], inferred: false });
  });

  it('marks an annotated return as not inferred, and a non-public member as off the public surface', () => {
    expect(use('AdminController.dump', 'UserRecord')).toMatchObject({ inferred: false, publicSurface: true });
    expect(use('UserController.raw', 'UserRecord')).toMatchObject({ visibility: 'private', publicSurface: false });
    expect(use('UserController.rawProtected', 'UserRecord')).toMatchObject({ visibility: 'protected', publicSurface: false });
  });

  it('records no edge for a DTO-returning member besides the DTO', () => {
    expect(edges(apg, 'SIGNATURE_USES').filter((x) => x.s.name === 'UserController.getDto').map((x) => x.t.name)).toEqual(['UserDto']);
  });
});

describe('APG v2 (2): components and Martin metrics', () => {
  let apg: APGResult;
  beforeAll(async () => { apg = await extract(fx('components'), V13_APG2_OPTIONS); });

  it('falls back to the top-level folders under src/', () => {
    expect(apg.apg2?.componentSource).toBe('folders');
    expect(folderComponents(['src/a/x.ts', 'src/a/b/y.ts', 'src/main.ts', 'src/c/z.ts']).map((c) => c.name)).toEqual(['a', 'c']);
    expect(folderComponents(['lib/x.ts', 'app/y.ts']).map((c) => c.include)).toEqual([['app/**'], ['lib/**']]);
  });

  it('aggregates file imports into DEPENDS_ON within a kind', () => {
    const deps = edges(apg, 'DEPENDS_ON').map((x) => `${x.s.name}->${x.t.name}`).sort();
    expect(deps).toEqual(expect.arrayContaining(['billing->shipping', 'shipping->billing', 'kernel->plugins', 'promo->catalog']));
    expect(deps).not.toContain('audit->audit');
  });

  it('computes Ca, Ce, I, A and D (Martin 2017 ch. 14)', () => {
    expect(component(apg, 'kernel').properties).toMatchObject({ ca: 5, ce: 1, instability: 0.167, abstractness: 0, distance: 0.833 });
    expect(component(apg, 'contracts').properties).toMatchObject({ ca: 0, ce: 1, instability: 1, abstractness: 1, distance: 1 });
    expect(component(apg, 'vendor-a').properties).toMatchObject({ instability: 0, abstractness: 0.5, distance: 0.5 });
    // No dependency in or out: I (and so D) is undefined, stored as null.
    expect(component(apg, 'audit').properties).toMatchObject({ ca: 0, ce: 0, instability: null, distance: null });
  });

  it('writes one BELONGS_TO per file and kind', () => {
    const belongs = edges(apg, 'BELONGS_TO');
    expect(new Set(belongs.map((x) => x.s.filePath)).size).toBe(belongs.length);
    expect(belongs.find((x) => x.s.filePath === 'src/kernel/registry.ts')?.t.name).toBe('kernel');
  });

  it('derives components from a spec: one per layer, one per DDD context', () => {
    const decls = componentsFromLayerModel({
      layers: [{ name: 'domain', directories: ['src/domain/**'], naming: [], role: '', filePatterns: ['**/*.entity.ts'] }],
      ddd: { sourceRoot: 'src/', contexts: [{ name: 'sales', root: 'src/sales', publicApi: ['src/sales/index.ts'], acl: [] }],
        outsideContexts: [], aggregates: [], valueObjects: [], repositories: [], domainEventTypes: [], applicationServices: [] },
    });
    expect(decls).toEqual([
      { name: 'domain', kind: 'layer', include: ['src/domain/**'], includeByName: ['**/*.entity.ts'] },
      { name: 'sales', kind: 'module', include: ['src/sales/**'], publicApi: ['src/sales/index.ts'] },
    ]);
  });

  it('groups glob-declared modules inside one folder (components-flat)', async () => {
    const flat = await extract(fx('components-flat'), { ...V13_APG2_OPTIONS, components: [
      { name: 'core', kind: 'module', include: ['src/lib/core-*.ts'] },
      { name: 'plugins', kind: 'module', include: ['src/lib/plugin-*.ts'] },
    ] });
    expect(edges(flat, 'DEPENDS_ON').map((x) => `${x.s.name}->${x.t.name}`).sort()).toEqual(['core->plugins', 'plugins->core']);
  });
});

describe('APG v2 (2b): public API surface', () => {
  const decls: ComponentDeclaration[] = [
    { name: 'orders', kind: 'module', include: ['src/orders/**'], publicApi: ['src/orders/index.ts'] },
    { name: 'payments', kind: 'module', include: ['src/payments/**'] },
    { name: 'checkout', kind: 'module', include: ['src/checkout/**'] },
    { name: 'reports', kind: 'module', include: ['src/reports/**'] },
    { name: 'ledger', kind: 'module', include: ['src/ledger/**'] },
  ];
  let apg: APGResult;
  beforeAll(async () => { apg = await extract(fx('public-api'), { ...V13_APG2_OPTIONS, components: decls }); });

  it('records declared and inferred entry files', () => {
    expect(component(apg, 'orders').properties).toMatchObject({ entryFiles: ['src/orders/index.ts'], publicApiDeclared: true });
    expect(component(apg, 'payments').properties).toMatchObject({ entryFiles: ['src/payments/index.ts'], publicApiDeclared: false });
    expect(component(apg, 'ledger').properties).toMatchObject({ entryFiles: [] });
  });

  it('writes EXPORTS_SYMBOL for every class, interface and function an entry file exports', () => {
    expect(edges(apg, 'EXPORTS_SYMBOL').map((x) => `${x.s.name}:${String(x.e.properties.exportedName)}`).sort())
      .toEqual(['orders:OrderService', 'orders:OrderView', 'payments:PaymentService']);
  });

  it('writes DEEP_IMPORT for imports of non-entry files from outside the component, aliases included', () => {
    expect(edges(apg, 'DEEP_IMPORT').map((x) => `${x.s.filePath}->${x.t.filePath}:${String(x.e.properties.publicApiDeclared)}`).sort()).toEqual([
      'src/checkout/checkout.ts->src/orders/internal/order-repo.ts:true',
      'src/checkout/checkout.ts->src/payments/gateway/stripe.ts:false',
      'src/checkout/summary.ts->src/orders/internal/order-row.ts:true',
      'src/reports/report.ts->src/orders/internal/order-repo.ts:true',
    ]);
  });
});

describe('APG v2 (4): async coupling', () => {
  let apg: APGResult;
  beforeAll(async () => { apg = await extract(fx('async'), V13_APG2_OPTIONS); });
  const labels = (type: string): string[] => edges(apg, type).map((x) => `${x.s.name}=>${String(x.t.properties.transport)}:${x.t.name}`).sort();

  it('detects publishers of every supported transport', () => {
    expect(labels('PUBLISHES')).toEqual([
      'OrderService.audit=>event:order.audited',
      'OrderService.cancel=>event:order.cancelled',
      'OrderService.place=>event:order.placed',
      'OrderService.ship=>cqrs-event:OrderShipped',
      'publishInvoice=>topic:invoice.issued',
      'requestRestock=>queue:restock',
    ]);
  });

  it('detects subscribers, by call and by handler decorator', () => {
    expect(labels('SUBSCRIBES')).toEqual([
      'BillingListener=>event:order.placed',
      'Notifier.onCancelled=>event:order.cancelled',
      'ShippedHandler=>cqrs-event:OrderShipped',
      'listen=>event:order.placed',
      'registerAudit=>event:order.audited',
      'startConsumer=>topic:invoice.issued',
      'workers.ts=>queue:restock',
    ]);
  });

  it('counts a computed event name and ignores a non-emitter emit()', () => {
    expect(apg.apg2?.async.dynamicNames).toBe(1);
    expect(labels('PUBLISHES').some((l) => l.startsWith('OrderService.trace'))).toBe(false);
  });
});

describe('APG v2 (5): I/O boundary', () => {
  let apg: APGResult;
  beforeAll(async () => { apg = await extract(fx('io'), V13_APG2_OPTIONS); });
  const io = (): string[] => edges(apg, 'PERFORMS_IO').map((x) => `${x.s.name}:${x.t.name}`).sort();

  it('detects globals and package calls by category', () => {
    expect(io()).toEqual([
      'IdGenerator.next:random', 'Order.place:clock', 'Order.stamp:clock', 'PaymentService.charge:env',
      'PaymentService.charge:http-out', 'ReportService.load:db', 'ReportService.template:fs', 'SystemClock.now:clock', 'get:http-out',
    ]);
  });

  it('ignores a converting new Date(x), a domain port, a type-only import and a shadowing local fetch', () => {
    const owners = edges(apg, 'PERFORMS_IO').map((x) => x.s.name);
    for (const n of ['Order.restore', 'Deadline.expired', 'sizeOf', 'fetchCount']) expect(owners).not.toContain(n);
  });

  it('records the APIs and lines of each owner and category', () => {
    const e = edges(apg, 'PERFORMS_IO').find((x) => x.s.name === 'IdGenerator.next')?.e;
    expect(e?.properties).toMatchObject({ category: 'random', apis: ['Math.random()', 'crypto.randomUUID()'] });
  });
});

describe('APG v2 helpers', () => {
  it('normalises package specifiers', () => {
    expect(normalizePackage('node:fs/promises')).toBe('fs/promises');
    expect(packageRoot('node:fs/promises')).toBe('fs');
    expect(packageRoot('@nestjs/cqrs/dist/x')).toBe('@nestjs/cqrs');
    expect(packageRoot('@types/node')).toBe('node');
  });
});
