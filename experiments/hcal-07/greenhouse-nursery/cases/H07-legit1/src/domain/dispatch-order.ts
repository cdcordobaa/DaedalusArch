import { DispatchStatus } from './dispatch-status';
import { DispatchNotBookedError, DispatchNotOrderedError, PassportNotClearError } from './errors';
import { FreightBooking } from './freight';
import { PassportStatusCode } from './plant-passport';

export class DispatchOrder {
  private status: DispatchStatus = 'ORDERED';
  private freightRef: string | null = null;
  private signedBy: string | null = null;
  private statusCode: PassportStatusCode = 'PP-PENDING';

  constructor(
    readonly id: string,
    readonly gardenCentreId: string,
    readonly postcode: string,
    readonly trays: number,
    readonly weightKg: number,
  ) {}

  inspect(passed: boolean): void {
    this.statusCode = passed ? 'PP-CLEAR' : 'PP-HOLD';
  }

  bookFreight(booking: FreightBooking): void {
    if (this.status !== 'ORDERED') throw new DispatchNotOrderedError(this.id);
    if (this.statusCode !== 'PP-CLEAR') throw new PassportNotClearError(this.id);
    this.freightRef = booking.freightRef;
    this.status = 'BOOKED';
  }

  markReceived(signedBy: string | null): void {
    if (this.status !== 'BOOKED' && this.status !== 'SHIPPED') throw new DispatchNotBookedError(this.id);
    this.signedBy = signedBy;
    this.status = 'RECEIVED';
  }

  hold(): void {
    if (this.status !== 'BOOKED' && this.status !== 'SHIPPED') throw new DispatchNotBookedError(this.id);
    this.status = 'HELD';
  }

  get currentStatus(): DispatchStatus {
    return this.status;
  }

  get passportStatusCode(): PassportStatusCode {
    return this.statusCode;
  }

  get freightReference(): string | null {
    return this.freightRef;
  }

  get receivedBy(): string | null {
    return this.signedBy;
  }
}
