import type { Product } from '../domain/product/Product';
import type { ProductRepository } from '../domain/product/ProductRepository';

export class InMemoryProductRepository implements ProductRepository {
  private readonly rows = new Map<string, Product>();

  async byId(id: string): Promise<Product | undefined> {
    return this.rows.get(id);
  }

  async save(product: Product): Promise<void> {
    this.rows.set(product.id, product);
  }
}
