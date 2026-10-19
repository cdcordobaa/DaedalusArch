import { Money } from '../../../ordering/domain/value-objects/Money';

export class Invoice {
  private total = new Money(0, 'EUR');

  constructor(readonly id: string) {}

  addLine(amount: Money): void {
    this.total = this.total.plus(amount);
  }

  amountDue(): Money {
    return this.total;
  }
}
