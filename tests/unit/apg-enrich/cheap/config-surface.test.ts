import { check, loadExpected, runFixture } from './batch2-helpers.js';

describe('config-surface proxy (batch 2)', () => {
  it('flags every planted case of the fixture and nothing on its near misses', async () => {
    const fx = await runFixture('config-surface', ['config-surface']);
    try {
      expect(check(fx.flags('config-surface'), loadExpected('config-surface'))).toEqual({ missed: [], nearMissFlags: [], unexpected: [] });
    } finally {
      fx.cleanup();
    }
  });

  it('emits READS_ENV edges to EnvKey nodes, by every read form', async () => {
    const fx = await runFixture('config-surface', ['config-surface']);
    try {
      const reads = fx.enrichment.edges.filter((e) => e.type === 'READS_ENV').map((e) => `${e.targetId}:${String(e.properties.via)}`);
      expect(reads).toEqual(expect.arrayContaining(['env:TAX_RATE:process.env', 'env:FEATURE_EXPRESS:process.env', 'env:DEPLOY_REGION:process.env', 'env:CARRIER_API_KEY:@nestjs/config.get', 'env:AWS_REGION:process.env']));
      const keys = (fx.enrichment.summaries['config-surface'] as { keys: Record<string, { components: string[] }> }).keys;
      expect(keys.DATABASE_URL?.components).toEqual(['billing', 'config', 'orders', 'shipping']);
      expect(keys.REDIS_URL?.components).toEqual(['billing', 'config']);
    } finally {
      fx.cleanup();
    }
  });
});
