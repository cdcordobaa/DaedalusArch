import { check, loadExpected, runFixture } from './batch2-helpers.js';
import { runOn } from './helpers.js';

describe('test-topology proxy (batch 2)', () => {
  it('flags every planted case of the fixture and nothing on its near misses', async () => {
    const fx = await runFixture('test-topology', ['test-topology']);
    try {
      expect(check(fx.flags('test-topology'), loadExpected('test-topology'))).toEqual({ missed: [], nearMissFlags: [], unexpected: [] });
    } finally {
      fx.cleanup();
    }
  });

  it('emits TESTS edges from test files (co-located and under test/) with the strongest use', async () => {
    const fx = await runFixture('test-topology', ['test-topology']);
    try {
      const tests = fx.enrichment.edges.filter((e) => e.type === 'TESTS').map((e) => `${e.sourceId}>${String(e.properties.unit)}:${String(e.properties.via)}`).sort();
      expect(tests).toEqual([
        'test:src/orders/order.service.spec.ts>OrdersService:instantiation',
        'test:src/orders/order.service.spec.ts>src/orders/order.service.ts:import',
        'test:test/catalog.e2e.test.ts>CatalogService:instantiation',
        'test:test/catalog.e2e.test.ts>priceWithTax:call',
        'test:test/catalog.e2e.test.ts>src/catalog/catalog.service.ts:import',
        'test:test/catalog.e2e.test.ts>src/pricing/price.ts:import',
      ]);
      const cls = fx.apg.nodes.find((n) => n.type === 'Class' && n.name === 'BillingService');
      expect(fx.enrichment.nodeFacts.find((f) => f.nodeId === cls?.id && f.key === 'tested')?.value).toBe(false);
    } finally {
      fx.cleanup();
    }
  });

  it('raises one no-tests flag when the project has no test file', async () => {
    const fx = await runOn({ 'src/a/a.ts': 'export class A { m(): number { return 1; } }\n' }, ['test-topology']);
    try {
      expect(fx.flags('test-topology').map((f) => f.kind)).toEqual(['no-tests']);
    } finally {
      fx.cleanup();
    }
  });
});
