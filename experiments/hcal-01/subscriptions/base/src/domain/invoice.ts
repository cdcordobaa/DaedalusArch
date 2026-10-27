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

  markPaid(): void {
    this._status = 'paid';
  }
}
