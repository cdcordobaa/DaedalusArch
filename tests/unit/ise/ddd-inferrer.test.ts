import { inferDddBlock } from '../../../src/ise/ddd-inferrer.js';
import { dddShaped, graph } from './helpers.js';

describe('ISE DDD block inferrer', () => {
  const o = 'src/ordering/';
  const g = graph({
    files: [
      `${o}index.ts`, `${o}contracts/OrderSummary.ts`, `${o}domain/order/Order.ts`, `${o}domain/order/OrderLine.ts`, `${o}domain/order/OrderRepository.ts`,
      `${o}domain/order/events/OrderPlaced.ts`, `${o}domain/order/value-objects/OrderId.ts`, `${o}domain/customer/Customer.ts`, `${o}domain/customer/CustomerRepository.ts`,
      `${o}application/PlaceOrder.ts`, `${o}infrastructure/InMemoryOrderRepository.ts`,
      'src/billing/domain/invoice/Invoice.ts', 'src/billing/application/IssueInvoice.ts', 'src/billing/acl/OrderingAcl.ts',
      'src/shared-kernel/DomainEvent.ts', 'src/main.ts',
    ],
    edges: [`${o}domain/order/Order.ts>${o}domain/order/OrderLine.ts`, `${o}domain/order/Order.ts>${o}domain/order/value-objects/OrderId.ts`],
    classes: [`${o}domain/order/Order.ts`, `${o}domain/order/OrderLine.ts`, `${o}domain/order/events/OrderPlaced.ts`, `${o}domain/customer/Customer.ts`, 'src/billing/domain/invoice/Invoice.ts', `${o}infrastructure/InMemoryOrderRepository.ts`],
    interfaces: ['src/shared-kernel/DomainEvent.ts', `${o}domain/order/OrderRepository.ts`],
    typeEdges: [['implements', `${o}domain/order/events/OrderPlaced.ts`, 'src/shared-kernel/DomainEvent.ts']],
  });
  const ddd = inferDddBlock(g);

  it('infers contexts with their public API and ACL, and what lies outside them', () => {
    expect(ddd.contexts).toEqual([
      { name: 'billing', root: 'src/billing/', public_api: [], acl: ['src/billing/acl/**'] },
      { name: 'ordering', root: 'src/ordering/', public_api: ['src/ordering/index.ts', 'src/ordering/contracts/**'], acl: [] },
    ]);
    expect(ddd.outside_contexts).toEqual(['src/main.ts', 'src/shared-kernel/**']);
  });

  it('infers aggregates: root named like the module, inner entities the root imports, repositories excluded', () => {
    expect(ddd.aggregates).toEqual([
      { name: 'Invoice', context: 'billing', module: 'src/billing/domain/invoice/**', root: 'src/billing/domain/invoice/Invoice.ts', inner_entities: [] },
      { name: 'Customer', context: 'ordering', module: `${o}domain/customer/**`, root: `${o}domain/customer/Customer.ts`, inner_entities: [] },
      { name: 'Order', context: 'ordering', module: `${o}domain/order/**`, root: `${o}domain/order/Order.ts`, inner_entities: [`${o}domain/order/OrderLine.ts`] },
    ]);
  });

  it('infers tactical globs from what exists and the event base type by majority', () => {
    expect(ddd.value_objects).toEqual(['src/**/value-objects/**']);
    expect(ddd.repositories).toEqual(['src/*/domain/**/*Repository.ts', 'src/*/infrastructure/**/*Repository.ts']);
    expect(ddd.application_services).toEqual(['src/*/application/*.ts']);
    expect(ddd.domain_event_types).toEqual(['DomainEvent']);
  });

  it('finds aggregates and application services in renamed layer folders (structural domain / application)', () => {
    for (const between of ['', 'mod']) {
      const b = inferDddBlock(dddShaped('kernel', 'orchestration', 'platform', between));
      const L = (ctx: string): string => `src/${ctx}/${between === '' ? '' : `${between}/`}`;
      expect(b.contexts.map((c) => c.name)).toEqual(['billing', 'ordering']);
      expect(b.aggregates.map((a) => [a.name, a.root])).toEqual([['Invoice', `${L('billing')}kernel/invoice/Invoice.ts`], ['Order', `${L('ordering')}kernel/order/Order.ts`]]);
      const rel = between === '' ? '' : `${between}/`;
      expect(b.application_services).toEqual([`src/*/${rel}orchestration/*.ts`]);
      expect(b.repositories).toEqual([`src/*/${rel}kernel/**/*Repository.ts`, `src/*/${rel}platform/**/*Repository.ts`]);
    }
  });
});
