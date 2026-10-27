import { SeatLabel, Venue } from "../domain/venue/Venue";
import { VenueRepository } from "./VenueRepository";

export class VenueService {
  constructor(private readonly venues: VenueRepository) {}

  registerVenue(id: string, name: string, capacity: number): void {
    this.venues.save(Venue.create(id, name, capacity));
  }

  addSeat(venueId: string, row: string, number: number, now: number): string {
    const venue = this.require(venueId);
    const seat = venue.addSeat(new SeatLabel(row, number), now);
    this.venues.save(venue);
    return seat.id;
  }

  hasSeat(venueId: string, seatId: string): boolean {
    return this.require(venueId).hasSeat(seatId);
  }

  private require(id: string): Venue {
    const venue = this.venues.findById(id);
    if (venue === undefined) throw new Error(`unknown venue ${id}`);
    return venue;
  }
}
