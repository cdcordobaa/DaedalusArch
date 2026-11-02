/**
 * v1.5.6 calls through ports (`portCalls` extractor option, `port-calls.ts`): CALLS_VIA_PORT edges from a class method
 * that calls a port member on a port-typed receiver to every implementing class's method. In-memory projects only (no
 * fixture directory, so the pinned v1.2E byte-identity list is unchanged). `ops/notes/v15-calls-through-ports.md`.
 */
import { Project } from 'ts-morph';
import { extractNodes } from '../../../src/apg-extractor/node-extractor.js';
import { extractEdges } from '../../../src/apg-extractor/edge-extractor.js';
import { V12E_DEFAULT_OPTIONS, V13_APG2_OPTIONS, V13_DEFAULT_OPTIONS, V15_APG_OPTIONS } from '../../../src/apg-extractor/types.js';
import type { ExtractorOptions } from '../../../src/apg-extractor/types.js';
import type { APGEdge, APGNode } from '../../../src/shared/types/apg.js';

const ROOT = '/proj';
const lines = (...ls: string[]): string => ls.join('\n');

function setup(files: Record<string, string>, options: ExtractorOptions = V15_APG_OPTIONS): { nodes: APGNode[]; edges: APGEdge[] } {
  const project = new Project({ useInMemoryFileSystem: true, skipFileDependencyResolution: true, compilerOptions: { strict: true, experimentalDecorators: true } });
  for (const [fp, content] of Object.entries(files)) project.createSourceFile(fp, content);
  const sfs = project.getSourceFiles().filter((sf) => !sf.getFilePath().includes('/node_modules/'));
  const { nodes, lookup } = extractNodes(sfs, ROOT);
  const { edges } = extractEdges(sfs, lookup, ROOT, options);
  return { nodes, edges };
}

/** `Source.method -> Target.method` for every edge of a type, sorted. */
function links(files: Record<string, string>, type = 'CALLS_VIA_PORT', options: ExtractorOptions = V15_APG_OPTIONS): string[] {
  const { nodes, edges } = setup(files, options);
  const name = new Map(nodes.map((n) => [n.id, n.name]));
  return edges.filter((e) => e.type === type).map((e) => `${name.get(e.sourceId) ?? '?'} -> ${name.get(e.targetId) ?? '?'}`).sort();
}

const PORT = { '/proj/src/core/ports/OrderRepository.ts': 'export interface OrderRepository { save(id: string): void; load(id: string): string; }' };
const SQL = {
  '/proj/src/adapters/SqlOrderRepository.ts': lines(
    "import { OrderRepository } from '../core/ports/OrderRepository';",
    'export class SqlOrderRepository implements OrderRepository { save(id: string): void {} load(id: string): string { return id; } }',
  ),
};
const MEM = {
  '/proj/src/adapters/MemoryOrderRepository.ts': lines(
    "import { OrderRepository } from '../core/ports/OrderRepository';",
    'export class MemoryOrderRepository implements OrderRepository { save(id: string): void {} load(id: string): string { return id; } }',
  ),
};
const useCase = (importLine: string, type: string): Record<string, string> => ({
  '/proj/src/core/app/PlaceOrder.ts': lines(
    importLine,
    'export class PlaceOrder {',
    `  constructor(private readonly orders: ${type}) {}`,
    '  execute(id: string): void {',
    '    this.orders.save(id);',
    '    this.orders.save(id + "-copy");',
    '  }',
    '}',
  ),
});
const PORT_USE = useCase("import { OrderRepository } from '../ports/OrderRepository';", 'OrderRepository');

describe('option defaults', () => {
  it('portCalls is OFF in the v1.2E, v1.3 and APG v2 options and ON in V15_APG_OPTIONS', () => {
    expect([V12E_DEFAULT_OPTIONS.portCalls, V13_DEFAULT_OPTIONS.portCalls, V13_APG2_OPTIONS.portCalls, V15_APG_OPTIONS.portCalls]).toEqual([false, false, false, true]);
    expect({ ...V15_APG_OPTIONS, portCalls: false }).toEqual(V13_APG2_OPTIONS);
  });

  it('no CALLS_VIA_PORT edge with the option off; every other edge is the same with it on', () => {
    const files = { ...PORT, ...SQL, ...PORT_USE };
    for (const opts of [V12E_DEFAULT_OPTIONS, V13_DEFAULT_OPTIONS, V13_APG2_OPTIONS]) expect(links(files, 'CALLS_VIA_PORT', opts)).toEqual([]);
    const on = setup(files, V15_APG_OPTIONS).edges;
    expect(on.filter((e) => e.type !== 'CALLS_VIA_PORT')).toEqual(setup(files, V13_APG2_OPTIONS).edges);
    expect(on.filter((e) => e.type === 'CALLS_VIA_PORT')).toHaveLength(1);
  });
});

describe('CALLS_VIA_PORT', () => {
  it('one port, one adapter: the use case links to the adapter method, with its sites', () => {
    const { nodes, edges } = setup({ ...PORT, ...SQL, ...PORT_USE });
    const name = new Map(nodes.map((n) => [n.id, n.name]));
    const e = edges.filter((x) => x.type === 'CALLS_VIA_PORT');
    expect(e.map((x) => `${name.get(x.sourceId) ?? ''} -> ${name.get(x.targetId) ?? ''}`)).toEqual(['PlaceOrder.execute -> SqlOrderRepository.save']);
    expect(e[0]?.properties).toEqual({ callCount: 2, lines: [5, 6], ports: ['OrderRepository@src/core/ports/OrderRepository.ts'], member: 'save' });
    // CALLS still targets class method declarations only: a port call writes none
    expect(edges.filter((x) => x.type === 'CALLS')).toEqual([]);
  });

  it('one port, two adapters: one edge to each', () => {
    expect(links({ ...PORT, ...SQL, ...MEM, ...PORT_USE })).toEqual([
      'PlaceOrder.execute -> MemoryOrderRepository.save',
      'PlaceOrder.execute -> SqlOrderRepository.save',
    ]);
  });

  it('aliased imports (caller and adapter) and a barrel re-export resolve to the port', () => {
    const files = {
      ...PORT,
      '/proj/src/core/ports/index.ts': "export { OrderRepository as Orders } from './OrderRepository';",
      '/proj/src/adapters/SqlOrderRepository.ts': lines(
        "import { OrderRepository as Repo } from '../core/ports/OrderRepository';",
        'export class SqlOrderRepository implements Repo { save(id: string): void {} load(id: string): string { return id; } }',
      ),
      ...useCase("import { Orders as O } from '../ports';", 'O'),
    };
    expect(links(files)).toEqual(['PlaceOrder.execute -> SqlOrderRepository.save']);
  });

  it('a port with no implementation: no edge', () => {
    expect(links({ ...PORT, ...PORT_USE })).toEqual([]);
  });

  it('a call on a concrete type: CALLS as before, no CALLS_VIA_PORT', () => {
    const files = { ...PORT, ...SQL, ...MEM, ...useCase("import { SqlOrderRepository } from '../../adapters/SqlOrderRepository';", 'SqlOrderRepository') };
    expect(links(files)).toEqual([]);
    expect(links(files, 'CALLS')).toEqual(['PlaceOrder.execute -> SqlOrderRepository.save']);
  });

  it('an abstract class port: links to each subclass override, not to the abstract member', () => {
    const files = {
      '/proj/src/core/ports/Gateway.ts': 'export abstract class Gateway { abstract charge(n: number): void; describe(): string { return "g"; } }',
      '/proj/src/adapters/Stripe.ts': "import { Gateway } from '../core/ports/Gateway';\nexport class Stripe extends Gateway { charge(n: number): void {} }",
      '/proj/src/adapters/Paypal.ts': "import { Gateway } from '../core/ports/Gateway';\nexport class Paypal extends Gateway { charge(n: number): void {} }",
      '/proj/src/core/app/Pay.ts': lines(
        "import { Gateway } from '../ports/Gateway';",
        'export class Pay { constructor(private readonly gw: Gateway) {} run(): void { this.gw.charge(1); this.gw.describe(); } }',
      ),
    };
    expect(links(files)).toEqual(['Pay.run -> Paypal.charge', 'Pay.run -> Stripe.charge']);
    // the concrete base member is a CALLS edge, as before
    expect(links(files, 'CALLS')).toEqual(['Pay.run -> Gateway.charge', 'Pay.run -> Gateway.describe']);
  });

  it('an implementation inherited from a base class, and a subclass override, both link', () => {
    const files = {
      ...PORT,
      '/proj/src/adapters/Base.ts': 'export class BaseStore { save(id: string): void {} load(id: string): string { return id; } }',
      '/proj/src/adapters/Store.ts': lines(
        "import { OrderRepository } from '../core/ports/OrderRepository';",
        "import { BaseStore } from './Base';",
        'export class Store extends BaseStore implements OrderRepository {}',
        'export class AuditedStore extends Store { save(id: string): void {} }',
      ),
      ...PORT_USE,
    };
    expect(links(files)).toEqual(['PlaceOrder.execute -> AuditedStore.save', 'PlaceOrder.execute -> BaseStore.save']);
  });

  it('the receiver type narrows: a sub-port receiver links only to the sub-port implementations', () => {
    const files = {
      ...PORT, ...SQL,
      '/proj/src/core/ports/AuditedOrders.ts': "import { OrderRepository } from './OrderRepository';\nexport interface AuditedOrders extends OrderRepository { audit(): void; }",
      '/proj/src/adapters/AuditedSql.ts': lines(
        "import { AuditedOrders } from '../core/ports/AuditedOrders';",
        'export class AuditedSql implements AuditedOrders { save(id: string): void {} load(id: string): string { return id; } audit(): void {} }',
      ),
      ...useCase("import { AuditedOrders } from '../ports/AuditedOrders';", 'AuditedOrders'),
    };
    expect(links(files)).toEqual(['PlaceOrder.execute -> AuditedSql.save']);
    // a base-port receiver reaches both
    expect(links({ ...files, ...PORT_USE })).toEqual(['PlaceOrder.execute -> AuditedSql.save', 'PlaceOrder.execute -> SqlOrderRepository.save']);
  });

  it('an object-literal implementation is not a class: no edge', () => {
    const files = {
      ...PORT, ...PORT_USE,
      '/proj/src/adapters/literal.ts': lines(
        "import { OrderRepository } from '../core/ports/OrderRepository';",
        'export const repo: OrderRepository = { save(id: string): void {}, load(id: string): string { return id; } };',
      ),
    };
    expect(links(files)).toEqual([]);
  });
});
