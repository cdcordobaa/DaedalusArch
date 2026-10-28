import { InvalidTransitionError } from './errors';
import { DateRange } from './value-objects';

export type LoanStatus = 'requested' | 'approved' | 'rejected' | 'shipped';

export class LoanRequest {
  private _status: LoanStatus = 'requested';

  constructor(
    readonly id: string,
    readonly artworkId: string,
    readonly borrower: string,
    readonly period: DateRange,
  ) {}

  get status(): LoanStatus {
    return this._status;
  }

  approve(): void {
    this.moveTo('approved', ['requested']);
  }

  reject(): void {
    this.moveTo('rejected', ['requested']);
  }

  markShipped(): void {
    this.moveTo('shipped', ['approved']);
  }

  private moveTo(next: LoanStatus, allowedFrom: LoanStatus[]): void {
    if (!allowedFrom.includes(this._status)) throw new InvalidTransitionError(this._status, next);
    this._status = next;
  }
}
