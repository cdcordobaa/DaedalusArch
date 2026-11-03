import { BookingStatus } from './booking-status';
import { BookingNotRequestedError } from './errors';
import { PermitClearance, PermitOutcome } from './permit';
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
  ) {}

  confirm(clearance: PermitClearance, outcome: PermitOutcome): void {
    if (this.status !== 'REQUESTED') throw new BookingNotRequestedError(this.id);
    this.permitRef = clearance.permitRef;
    if (outcome === 'approved') this.status = 'CONFIRMED';
    else if (outcome === 'pending') this.status = 'ON_HOLD';
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
