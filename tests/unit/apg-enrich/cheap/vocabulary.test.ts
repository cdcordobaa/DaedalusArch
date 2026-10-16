import { termsOf } from '../../../../src/apg-enrich/cheap/vocabulary.js';
import { runOn } from './helpers.js';

describe('vocabulary proxy', () => {
  it('splits identifiers into terms without stop words', () => {
    expect(termsOf('createInvoiceLineItems')).toEqual(['invoice', 'line']);
    expect(termsOf('getHTTPStatus')).toEqual([]);
  });

  it('tags components by TF-IDF and flags a component speaking another component\'s vocabulary', async () => {
    const fx = await runOn({
      'src/billing/domain/invoice.ts': 'export class Invoice { invoiceTotal = 0; invoiceNumber = ""; taxRate = 0; taxAmount = 0; }\n',
      'src/shipping/domain/parcel.ts': 'export class Parcel { parcelWeight = 0; parcelCarrier = ""; trackingCode = ""; }\n',
      'src/catalog/domain/product.ts': 'export class ProductPrice { invoiceTotal = 0; invoiceNumber = ""; taxRate = 0; invoiceTax = 0; productSku = ""; }\n',
    }, ['vocabulary']);
    try {
      const tags = fx.enrichment.summaries.vocabulary?.tags as Record<string, { term: string }[]>;
      expect(tags.shipping?.map((t) => t.term).slice(0, 2)).toEqual(['parcel', 'carrier']);
      const flags = fx.flags('vocabulary');
      expect(flags.map((f) => f.message.split(':')[0])).toEqual(['component catalog']);
      expect(flags[0]?.message).toContain('billing');
    } finally {
      fx.cleanup();
    }
  });
});
