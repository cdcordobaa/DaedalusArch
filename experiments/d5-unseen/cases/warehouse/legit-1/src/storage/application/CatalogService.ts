import { Sku } from '../domain/sku/Sku';
import { SkuRepository } from '../domain/sku/SkuRepository';

export class CatalogService {
  constructor(private skus: SkuRepository) {}

  define(skuCode: string, description: string): Sku {
    if (this.skus.existsByCode(skuCode)) {
      throw new Error('duplicate sku code ' + skuCode);
    }
    const s = new Sku(skuCode, description);
    this.skus.insert(s);
    return s;
  }
}
