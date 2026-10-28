import type { Clock } from '../application/ports/out/clock.port';
import { Money } from './money';

export class ProductionCredit {
  private _paidReference: string | null = null;
  constructor(
    readonly id: string,
    readonly memberId: string,
    readonly period: string,
    readonly kwh: number,
    readonly amount: Money,
  ) {}
  get paidReference(): string | null {
    return this._paidReference;
  }
  markPaidNow(reference: string, clock: Clock): Date {
    this.markPaid(reference);
    return clock.now();
  }
  markPaid(reference: string): void {
    this._paidReference = reference;
  }
}
