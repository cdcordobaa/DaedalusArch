import { ProductRepo } from '../domain/ProductRepo.js';

export class ProductRepository implements ProductRepo {
  find(id: string): string | undefined {
    return id;
  }
}
