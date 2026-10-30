import { BookingStatus, RunSize } from './booking-status';
import { DepositHold } from './deposit';
import { DepositAction, DepositState } from './deposit-state';
import { BookingNotConfirmedError, BookingNotRequestedError } from './errors';

export class Booking {
  private status: BookingStatus = 'REQUESTED';
  private depositRef: string | null = null;
  private depositHeldCents = 0;
  private depositState: DepositState | null = null;

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
    this.depositState = hold.state;
    this.status = 'CONFIRMED';
  }

  checkIn(): void {
    if (this.status !== 'CONFIRMED') throw new BookingNotConfirmedError(this.id);
    this.status = 'CHECKED_IN';
  }

  cancel(): DepositAction {
    if (this.status === 'CHECKED_IN') throw new BookingNotConfirmedError(this.id);
    this.status = 'CANCELLED';
    switch (this.depositState) {
      case 'HELD_ON_CARD': return 'release';
      case 'TAKEN': return 'refund';
      case 'BOUNCED':
      case 'LET_GO':
      case 'PAID_BACK':
      case null:
        return 'none';
    }
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
