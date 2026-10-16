import { CatalogService } from '../src/catalog/catalog.service';
import { priceWithTax } from '../src/pricing/price';

describe('catalog e2e', () => {
  it('lists', () => {
    const s = new CatalogService();
    expect(s.list()).toEqual(['a']);
    expect(priceWithTax(100)).toBe(120);
  });
});
