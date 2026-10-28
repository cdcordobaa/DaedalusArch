import { Money } from './money';

export class Trip {
  private endedAt?: number;
  private fare?: Money;
  constructor(readonly id: string, readonly riderId: string, readonly scooterId: string, readonly startedAt: number) {}
  get isOpen(): boolean { return this.endedAt === undefined; }
  get totalFare(): Money | undefined { return this.fare; }
  finish(endedAt: number, fare: Money): void { this.endedAt = endedAt; this.fare = fare; }
  get minutes(): number { return Math.max(1, Math.ceil(((this.endedAt ?? this.startedAt) - this.startedAt) / 60000)); }
}
