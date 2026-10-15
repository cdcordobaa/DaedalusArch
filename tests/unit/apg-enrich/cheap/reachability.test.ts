import { check, loadExpected, runFixture } from './batch2-helpers.js';

describe('reachability proxy (batch 2)', () => {
  it('flags every planted case of the fixture and nothing on its near misses', async () => {
    const fx = await runFixture('reachability', ['reachability']);
    try {
      expect(check(fx.flags('reachability'), loadExpected('reachability'))).toEqual({ missed: [], nearMissFlags: [], unexpected: [] });
    } finally {
      fx.cleanup();
    }
  });

  it('detects Nest routes, express handlers and the main module, and emits REACHES through interfaces', async () => {
    const fx = await runFixture('reachability', ['reachability']);
    try {
      const entries = fx.enrichment.virtualNodes.filter((n) => n.kind === 'EntryPoint').map((n) => `${String(n.properties.entryKind)}:${n.name}`).sort();
      expect(entries).toEqual(['http:GET /health', 'http:OrdersController.create', 'http:POST /legacy-orders', 'http:ProductsController.list', 'main:src/main.ts']);
      const list = fx.enrichment.virtualNodes.find((n) => n.name === 'ProductsController.list');
      const impl = fx.apg.nodes.find((n) => n.type === 'Method' && n.name === 'InMemoryProductRepository.findAll');
      expect(fx.enrichment.edges.some((e) => e.type === 'REACHES' && e.sourceId === list?.id && e.targetId === impl?.id)).toBe(true);
      expect(list?.properties.componentPaths).toEqual(['shop']);
      const bypass = fx.flags('reachability').find((f) => f.kind === 'endpoint-bypasses-core' && f.className === 'ProductsController');
      expect(bypass?.message).toContain('ProductsController.list -> InMemoryProductRepository.findAll');
      expect(fx.flags('reachability').filter((f) => f.kind === 'endpoint-bypasses-core')).toHaveLength(2);
    } finally {
      fx.cleanup();
    }
  });
});
