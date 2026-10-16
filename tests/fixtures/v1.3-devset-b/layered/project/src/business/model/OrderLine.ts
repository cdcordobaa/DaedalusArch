import { Money } from './Money';

export class OrderLine {
  constructor(
    readonly sku: string,
    readonly quantity: number,
    readonly unitPrice: Money,
  ) {}

  total(): Money {
    return this.unitPrice.times(this.quantity);
  }
}
