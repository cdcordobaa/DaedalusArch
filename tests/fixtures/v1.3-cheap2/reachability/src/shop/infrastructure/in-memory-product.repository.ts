import { Product } from '../domain/product';
import { ProductRepository } from '../domain/product-repository';

export class InMemoryProductRepository implements ProductRepository {
  private readonly rows: Product[] = [];

  findAll(): Product[] {
    return this.rows;
  }

  save(p: Product): void {
    this.rows.push(p);
  }
}
