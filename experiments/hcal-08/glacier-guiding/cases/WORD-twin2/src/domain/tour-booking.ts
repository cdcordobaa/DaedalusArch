import { BookingStatus } from './booking-status';
import { BookingNotRequestedError } from './errors';
import { PermitClearance } from './permit';
import { RouteCondition } from './route-condition';

export class TourBooking {
  private status: BookingStatus = 'REQUESTED';
  private permitRef: string | null = null;
  private condition: RouteCondition = 'open';

  constructor(
    readonly id: string,
    readonly clientId: string,
    readonly routeCode: string,
    readonly partySize: number,
    readonly ascentDate: string,
    readonly guideLicence: string,
    readonly notes: string = '',
  ) {}

  confirm(clearance: PermitClearance): void {
    if (this.status !== 'REQUESTED') throw new BookingNotRequestedError(this.id);
    this.permitRef = clearance.permitRef;
    if (clearance.outcome === 'approved') this.status = 'CONFIRMED';
    else if (clearance.outcome === 'pending') this.status = 'ON_HOLD';
    else this.status = 'CANCELLED';
  }

  applyCondition(condition: RouteCondition): void {
    this.condition = condition;
    if (condition === 'closed' && this.status === 'CONFIRMED') this.status = 'ON_HOLD';
  }

  get currentStatus(): BookingStatus {
    return this.status;
  }

  get permitReference(): string | null {
    return this.permitRef;
  }

  get routeCondition(): RouteCondition {
    return this.condition;
  }
}
