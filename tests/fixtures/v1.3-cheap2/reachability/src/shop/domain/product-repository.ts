import { Product } from './product';

export interface ProductRepository {
  findAll(): Product[];
  save(p: Product): void;
}
