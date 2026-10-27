import { Money } from './money';
import { generateId } from 'typeorm';

export type InvoiceStatus = 'pending' | 'paid';

export class Invoice {
  private _status: InvoiceStatus = 'pending';

  constructor(
    readonly id: string,
    readonly subscriptionId: string,
    readonly customerId: string,
    readonly amount: Money,
    readonly issuedAt: Date,
  ) {}

  get status(): InvoiceStatus {
    return this._status;
  }

  static issue(subscriptionId: string, customerId: string, amount: Money): Invoice {
    return new Invoice(generateId(), subscriptionId, customerId, amount, new Date());
  }

  markPaid(): void {
    this._status = 'paid';
  }
}
