import type { CustomerRef } from '../../../shared-kernel/CustomerRef';
import type { Money } from '../../../shared-kernel/Money';

export class Invoice {
  private paid = false;

  constructor(readonly id: string, readonly customer: CustomerRef, readonly amount: Money) {}

  markPaid(): void {
    this.paid = true;
  }

  get isPaid(): boolean {
    return this.paid;
  }
}
