import { BookingError } from '../errors/BookingError';
import { DateRange } from './DateRange';
import { Money } from './Money';

export type BookingStatus = 'confirmed' | 'cancelled';

export class Booking {
  private bookingStatus: BookingStatus = 'confirmed';

  constructor(
    readonly id: string,
    readonly roomId: string,
    readonly guestId: string,
    readonly stay: DateRange,
    readonly total: Money,
    readonly paymentRef: string,
  ) {}

  get status(): BookingStatus {
    return this.bookingStatus;
  }

  get isActive(): boolean {
    return this.bookingStatus === 'confirmed';
  }

  cancel(): void {
    if (!this.isActive) throw new BookingError('invalid', `Booking ${this.id} is already cancelled`);
    this.bookingStatus = 'cancelled';
  }
}
