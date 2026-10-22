import { Money } from '../../../ordering/domain/value-objects/Money';

export class Invoice {
  private total = new Money(0, 'EUR');
  private paid = false;

  constructor(readonly id: string, readonly orderId: string) {}

  addLine(amount: Money): void {
    this.total = this.total.plus(amount);
  }

  markPaid(): void {
    this.paid = true;
  }

  isPaid(): boolean {
    return this.paid;
  }
}
