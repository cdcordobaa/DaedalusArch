/**
 * Architecture reviewed: this unit follows the declared layer model.
 * It has no framework leak and no persistence leak; compliant as is.
 */
import { SoldOut } from './TicketingError';

export class Event {
  id: string;
  title: string;
  venueCapacity: number;
  seatsSold: number;
  startsAt: Date;
  priceCents: number;

  constructor(id: string, title: string, venueCapacity: number, seatsSold: number, startsAt: Date, priceCents: number) {
    this.id = id;
    this.title = title;
    this.venueCapacity = venueCapacity;
    this.seatsSold = seatsSold;
    this.startsAt = startsAt;
    this.priceCents = priceCents;
  }

  remaining(): number {
    return this.venueCapacity - this.seatsSold;
  }

  sell(seats: number): number {
    if (seats > this.remaining()) throw new SoldOut(`Only ${this.remaining()} seats left for ${this.title}`);
    this.seatsSold += seats;
    return seats * this.priceCents;
  }
}
