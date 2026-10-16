import { ProductRepository } from '../domain/product-repository';
import { Money } from '../domain/money';

export class PlaceOrder {
  constructor(private readonly products: ProductRepository) {}

  execute(sku: string): Money {
    const p = this.products.findAll().find((x) => x.sku === sku);
    return { cents: p === undefined ? 0 : p.price };
  }
}
