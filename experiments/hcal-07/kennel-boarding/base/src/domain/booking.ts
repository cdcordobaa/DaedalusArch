import { BookingStatus, RunSize } from './booking-status';
import { DepositHold } from './deposit';
import { BookingNotConfirmedError, BookingNotRequestedError } from './errors';

export class Booking {
  private status: BookingStatus = 'REQUESTED';
  private depositRef: string | null = null;
  private depositHeldCents = 0;

  constructor(
    readonly id: string,
    readonly ownerId: string,
    readonly petName: string,
    readonly runSize: RunSize,
    readonly nights: number,
  ) {}

  confirm(hold: DepositHold): void {
    if (this.status !== 'REQUESTED') throw new BookingNotRequestedError(this.id);
    this.depositRef = hold.depositRef;
    this.depositHeldCents = hold.amountHeldCents;
    this.status = 'CONFIRMED';
  }

  checkIn(): void {
    if (this.status !== 'CONFIRMED') throw new BookingNotConfirmedError(this.id);
    this.status = 'CHECKED_IN';
  }

  get currentStatus(): BookingStatus {
    return this.status;
  }

  get depositReference(): string | null {
    return this.depositRef;
  }

  get depositAmountCents(): number {
    return this.depositHeldCents;
  }
}
