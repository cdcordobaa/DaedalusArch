import { isTrivialLiteral } from '../../../../src/apg-enrich/cheap/literals.js';
import { runOn } from './helpers.js';

describe('shared-literals proxy', () => {
  it('treats 0, 1, -1, HTTP codes, short, common and code-like strings as trivial', () => {
    for (const v of ['0', '1', '-1', '404']) expect(isTrivialLiteral(v, 'number', 4)).toBe(true);
    expect(isTrivialLiteral('42', 'number', 4)).toBe(false);
    for (const v of ['', 'abc', 'GET', 'application/json', 'not-found', 'ORDER_PAID']) expect(isTrivialLiteral(v, 'string', 4)).toBe(true);
    expect(isTrivialLiteral('Quantity must be positive', 'string', 4)).toBe(false);
  });

  it('flags a message and a number written in two components, with an edge between their files', async () => {
    const fx = await runOn({
      'src/order/application/order.service.ts': `import { Controller } from '@nestjs/common';
export const LIMIT = 250;
@Controller('orders-route')
export class OrderService {
  check(q: number): void {
    if (q > 250) throw new Error('Quantity must be positive');
    if (q === 1) console.log('Quantity must be positive');
  }
}
`,
      'src/invoice/application/invoice.service.ts': `export class InvoiceService {
  check(q: number): string {
    const route = 'orders-route';
    if (q > 250) throw new Error('Quantity must be positive');
    return typeof q === 'number' ? route : 'not-found';
  }
}
`,
    }, ['shared-literals']);
    try {
      const flags = fx.flags('shared-literals');
      const values = [...new Set(flags.map((f) => /literal (.*) also/.exec(f.message)?.[1]))].sort();
      expect(values).toEqual(['"250"', '"Quantity must be positive"']);
      // The log call argument and the decorator argument are not sites.
      expect(flags.filter((f) => f.message.includes('Quantity')).map((f) => f.evidence.startLine).sort()).toEqual([4, 6]);
      expect(fx.enrichment.edges.filter((e) => e.type === 'SHARES_LITERAL').map((e) => e.properties.literal).sort()).toEqual(['250', 'Quantity must be positive']);
    } finally {
      fx.cleanup();
    }
  });
});
