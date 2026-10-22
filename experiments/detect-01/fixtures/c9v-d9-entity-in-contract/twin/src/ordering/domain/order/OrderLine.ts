import { Money } from '../../../shared-kernel/value-objects/Money.js';

/** Inner entity of Order. */
export class OrderLine {
  private discountCents = 0;
  private reason: string | null = null;

  constructor(readonly lineNo: number, readonly productId: string, private readonly grossCents: number, private readonly currency: string) {}

  applyDiscount(cents: number, reason: string): void {
    if (cents > this.grossCents) throw new Error('A discount cannot exceed the line');
    this.discountCents = cents;
    this.reason = reason;
  }

  gross(): Money {
    return Money.of(this.grossCents, this.currency);
  }

  discountAmount(): Money {
    return Money.of(this.discountCents, this.currency);
  }

  discountReason(): string | null {
    return this.reason;
  }

  subtotal(): Money {
    return Money.of(this.grossCents - this.discountCents, this.currency);
  }
}
