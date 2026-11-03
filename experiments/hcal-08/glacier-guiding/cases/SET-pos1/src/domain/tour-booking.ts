import { BookingStatus } from './booking-status';
import { Hazard } from './hazard';
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
  ) {}

  confirm(clearance: PermitClearance): void {
    if (this.status !== 'REQUESTED') throw new BookingNotRequestedError(this.id);
    this.permitRef = clearance.permitRef;
    if (clearance.outcome === 'approved') this.status = 'CONFIRMED';
    else if (clearance.outcome === 'pending') this.status = 'ON_HOLD';
    else this.status = 'CANCELLED';
  }

  applyHazard(hazard: Hazard): void {
    this.condition = hazard === 'CALM' || hazard === 'BREEZY' ? 'open' : hazard === 'WATCH' ? 'caution' : 'closed';
    if (this.condition === 'closed' && this.status === 'CONFIRMED') this.status = 'ON_HOLD';
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
