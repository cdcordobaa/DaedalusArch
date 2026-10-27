import { Venue } from "../domain/venue/Venue";
import { VenueRepository } from "../application/VenueRepository";

export class InMemoryVenueRepository implements VenueRepository {
  private readonly items = new Map<string, Venue>();

  save(venue: Venue): void {
    this.items.set(venue.id, venue);
  }

  findById(id: string): Venue | undefined {
    return this.items.get(id);
  }
}
