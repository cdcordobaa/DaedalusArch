import { HttpStatusError } from './errors';

export type SubscriptionStatus = 'active' | 'cancelled';

export class Subscription {
  private _status: SubscriptionStatus = 'active';
  private _cancelledAt: Date | null = null;

  constructor(
    readonly id: string,
    readonly customerId: string,
    readonly planId: string,
    readonly startedAt: Date,
  ) {}

  get status(): SubscriptionStatus {
    return this._status;
  }

  get cancelledAt(): Date | null {
    return this._cancelledAt;
  }

  cancel(at: Date): void {
    if (this._status === 'cancelled') {
      throw new HttpStatusError(409, `Subscription ${this.id} is already cancelled`);
    }
    this._status = 'cancelled';
    this._cancelledAt = at;
  }
}
