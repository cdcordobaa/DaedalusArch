import { Money } from '../../../shared-kernel/value-objects/Money.js';
import { Quantity } from '../value-objects/Quantity.js';

/** Aggregate root. Lines are created only through Order. */
export class Order {
  private readonly lines: { productId: string; quantity: Quantity; unitPrice: Money }[] = [];

  constructor(readonly id: string, readonly customerId: string, readonly currency: string) {}

  addLine(productId: string, quantity: Quantity, unitPrice: Money): void {
    if (unitPrice.currency !== this.currency) throw new Error('Currency mismatch');
    this.lines.push({ productId, quantity, unitPrice });
  }

  lineCount(): number {
    return this.lines.length;
  }
}
