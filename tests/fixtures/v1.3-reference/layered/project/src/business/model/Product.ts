import { BusinessError } from '../errors/BusinessError';
import { Money } from './Money';

export class Product {
  constructor(
    readonly sku: string,
    readonly name: string,
    readonly price: Money,
    private stockLevel: number,
  ) {}

  get stock(): number {
    return this.stockLevel;
  }

  reserve(quantity: number): void {
    if (quantity < 1) throw new BusinessError('INVALID', 'Quantity must be positive');
    if (quantity > this.stockLevel) throw new BusinessError('CONFLICT', `Only ${this.stockLevel} of ${this.sku} left`);
    this.stockLevel -= quantity;
  }

  release(quantity: number): void {
    this.stockLevel += quantity;
  }
}
