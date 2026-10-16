import { Money } from '../../../shared-kernel/value-objects/Money.js';
import { Quantity } from '../value-objects/Quantity.js';

/** Inner entity of the Order aggregate: reachable only through Order. */
export class OrderLine {
  constructor(readonly lineNo: number, readonly productId: string, private quantity: Quantity, readonly unitPrice: Money) {}

  subtotal(): Money {
    return this.unitPrice.times(this.quantity.value);
  }

  increase(by: Quantity): void {
    this.quantity = this.quantity.plus(by);
  }

  isFor(productId: string): boolean {
    return this.productId === productId;
  }
}
