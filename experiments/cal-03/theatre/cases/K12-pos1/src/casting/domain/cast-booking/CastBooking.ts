import { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { Money } from '../../../shared-kernel/value-objects/Money';
import { CastBookingConfirmed } from '../events/CastBookingConfirmed';

export type BookingStatus = 'offered' | 'confirmed' | 'declined';

export class CastBooking {
  private _status: BookingStatus = 'offered';
  private _fee: Money;
  private _total?: Money;
  private _events: DomainEvent[] = [];

  constructor(
    readonly id: string,
    readonly productionId: string,
    readonly actorId: string,
    fee: Money,
    readonly weeks: number,
  ) {
    if (!fee.isPositive()) {
      throw new Error('fee must be positive');
    }
    this._fee = fee;
  }

  get status(): BookingStatus {
    return this._status;
  }

  get fee(): Money {
    return this._fee;
  }

  setFee(fee: Money): void {
    if (!fee.isPositive()) {
      throw new Error('fee must be positive');
    }
    this._fee = fee;
  }

  recordTotal(total: Money): void {
    if (!total.isPositive()) {
      throw new Error('total must be positive');
    }
    this._total = total;
  }

  totalDue(): Money {
    return this._fee.times(this.weeks);
  }

  confirm(): void {
    if (this._status !== 'offered') {
      throw new Error('only an offered booking can be confirmed');
    }
    this._status = 'confirmed';
    this._events.push(new CastBookingConfirmed(this.id, this.productionId, this.actorId, (this._total ?? this.totalDue()).amount));
  }

  decline(): void {
    if (this._status !== 'offered') {
      throw new Error('only an offered booking can be declined');
    }
    this._status = 'declined';
  }

  pullEvents(): DomainEvent[] {
    const out = this._events;
    this._events = [];
    return out;
  }
}
