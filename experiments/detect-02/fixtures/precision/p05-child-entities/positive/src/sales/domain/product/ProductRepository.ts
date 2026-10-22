import type { Product } from './Product';

export interface ProductRepository {
  byId(id: string): Promise<Product | undefined>;
  save(product: Product): Promise<void>;
}
