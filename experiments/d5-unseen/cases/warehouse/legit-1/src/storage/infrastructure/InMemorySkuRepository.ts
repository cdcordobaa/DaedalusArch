import { Sku } from '../domain/sku/Sku';
import { SkuRepository } from '../domain/sku/SkuRepository';

export class InMemorySkuRepository implements SkuRepository {
  private rows = new Map<string, Sku>();
  existsByCode(skuCode: string): boolean {
    return this.rows.has(skuCode);
  }
  insert(s: Sku): void {
    this.rows.set(s.skuCode, s);
  }
}
