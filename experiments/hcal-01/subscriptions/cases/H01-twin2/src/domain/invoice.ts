import { Money } from './money';

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

  static issue(id: string, subscriptionId: string, customerId: string, amount: Money, at: Date): Invoice {
    return new Invoice(id, subscriptionId, customerId, amount, at);
  }

  markPaid(): void {
    this._status = 'paid';
  }
}
