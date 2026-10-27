import { Sku } from './Sku';

export interface SkuRepository {
  existsByCode(skuCode: string): boolean;
  insert(s: Sku): void;
}
