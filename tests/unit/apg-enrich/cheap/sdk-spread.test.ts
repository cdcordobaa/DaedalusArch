import { check, loadExpected, pick, runFixture } from './batch2-helpers.js';

describe('sdk-spread proxy (batch 2)', () => {
  it('flags every planted case of the fixture and nothing on its near misses', async () => {
    const fx = await runFixture('sdk-spread', ['sdk-spread']);
    try {
      expect(check(fx.flags('sdk-spread'), loadExpected('sdk-spread'))).toEqual({ missed: [], nearMissFlags: [], unexpected: [] });
      const typeOnly = fx.flags('sdk-spread').find((f) => f.evidence.file === 'src/payments/domain/payment-doc.ts');
      expect(typeOnly?.score).toBe(0.5);
    } finally {
      fx.cleanup();
    }
  });

  it('computes per-package component spread and the project SDK spread index', async () => {
    const fx = await runFixture('sdk-spread', ['sdk-spread']);
    try {
      const s = fx.enrichment.summaries['sdk-spread'] as { components: number; packages: Record<string, { vendor: boolean; components: string[]; spread: number }>; sdkSpreadIndex: number };
      expect(s.components).toBe(3);
      expect(pick(s.packages.stripe, ['vendor', 'components', 'spread'])).toEqual({ vendor: true, components: ['payments'], spread: 0.3333 });
      expect(s.packages.lodash?.vendor).toBe(false);
      expect('crypto' in s.packages).toBe(false);
      // stripe, @aws-sdk/client-s3, mongoose: 1 of 3 components each; axios: 1 of 3.
      expect(s.sdkSpreadIndex).toBe(0.3333);
      const pkg = fx.apg.nodes.find((n) => n.type === 'Package' && n.name === 'stripe');
      expect(pick(fx.enrichment.nodeFacts.find((f) => f.nodeId === pkg?.id && f.key === 'sdkSpread')?.value, ['importingFiles', 'importingLayers'])).toEqual({ importingFiles: 2, importingLayers: ['domain', 'infrastructure'] });
    } finally {
      fx.cleanup();
    }
  });
});
