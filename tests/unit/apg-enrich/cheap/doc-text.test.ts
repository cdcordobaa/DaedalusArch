import { runOn } from './helpers.js';

describe('doc-text proxy', () => {
  it('stores JSDoc and leading comments of classes, methods and functions as node text', async () => {
    const fx = await runOn({
      'src/x/domain/order.ts': `/**
 * An order placed by a customer.
 * It owns its lines.
 */
export class Order {
  // Pays the order; only open orders can be paid.
  pay(): void {}
  undocumented(): void {}
}
/** Builds an order. */
export function makeOrder(): Order { return new Order(); }
`,
    }, ['doc-text']);
    try {
      const text = fx.enrichment.nodeFacts.map((n) => n.value).sort();
      expect(text).toEqual(['An order placed by a customer. It owns its lines.', 'Builds an order.', 'Pays the order; only open orders can be paid.']);
      expect(fx.enrichment.flags).toEqual([]);
      expect(fx.enrichment.summaries['doc-text']).toEqual({ units: 4, withText: 3 });
    } finally {
      fx.cleanup();
    }
  });
});
