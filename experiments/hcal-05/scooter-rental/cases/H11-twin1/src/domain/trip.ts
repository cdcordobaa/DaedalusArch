import { Money } from './money';
import { PaymentFailure } from './payment-failure';

export class Trip {
  private endedAt?: number;
  private fare?: Money;
  private failure?: PaymentFailure;
  constructor(readonly id: string, readonly riderId: string, readonly scooterId: string, readonly startedAt: number) {}
  get isOpen(): boolean { return this.endedAt === undefined; }
  get totalFare(): Money | undefined { return this.fare; }
  get paymentFailure(): PaymentFailure | undefined { return this.failure; }
  recordPaymentFailure(failure: PaymentFailure): void { this.failure = failure; }
  finish(endedAt: number, fare: Money): void { this.endedAt = endedAt; this.fare = fare; }
  get minutes(): number { return Math.max(1, Math.ceil(((this.endedAt ?? this.startedAt) - this.startedAt) / 60000)); }
}
