import { DeliveryStage } from './delivery-stage';
import { DispatchStatus } from './dispatch-status';
import { DispatchNotBookedError, DispatchNotOrderedError } from './errors';
import { FreightBooking } from './freight';

export class DispatchOrder {
  private status: DispatchStatus = 'ORDERED';
  private freightRef: string | null = null;
  private signedBy: string | null = null;

  constructor(
    readonly id: string,
    readonly gardenCentreId: string,
    readonly postcode: string,
    readonly trays: number,
    readonly weightKg: number,
  ) {}

  bookFreight(booking: FreightBooking): void {
    if (this.status !== 'ORDERED') throw new DispatchNotOrderedError(this.id);
    this.freightRef = booking.freightRef;
    this.status = 'BOOKED';
  }

  markReceived(signedBy: string | null): void {
    if (this.status !== 'BOOKED' && this.status !== 'SHIPPED') throw new DispatchNotBookedError(this.id);
    this.signedBy = signedBy;
    this.status = 'RECEIVED';
  }

  track(stage: DeliveryStage): boolean {
    switch (stage) {
      case 'AWAITING_COLLECTION':
      case 'PICKED_UP':
      case 'SORTING':
        return false;
      case 'ON_VAN':
        if (this.status !== 'BOOKED') throw new DispatchNotBookedError(this.id);
        this.status = 'SHIPPED';
        return true;
      case 'HANDED_OVER':
        this.markReceived(this.signedBy);
        return true;
      case 'SENT_BACK':
        this.hold();
        return true;
    }
  }

  hold(): void {
    if (this.status !== 'BOOKED' && this.status !== 'SHIPPED') throw new DispatchNotBookedError(this.id);
    this.status = 'HELD';
  }

  get currentStatus(): DispatchStatus {
    return this.status;
  }

  get freightReference(): string | null {
    return this.freightRef;
  }

  get receivedBy(): string | null {
    return this.signedBy;
  }
}
