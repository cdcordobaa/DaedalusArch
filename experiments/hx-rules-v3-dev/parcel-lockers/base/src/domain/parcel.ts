import { WrongPickupCodeError } from './errors';

export type ParcelState = 'awaiting-pickup' | 'collected' | 'returned';

export class Parcel {
  private state: ParcelState = 'awaiting-pickup';

  constructor(
    readonly id: string,
    readonly lockerId: string,
    readonly recipientPhone: string,
    private readonly pickupCode: string,
  ) {}

  collect(code: string): void {
    if (code !== this.pickupCode) throw new WrongPickupCodeError(this.id);
    this.state = 'collected';
  }

  get currentState(): ParcelState {
    return this.state;
  }
}
