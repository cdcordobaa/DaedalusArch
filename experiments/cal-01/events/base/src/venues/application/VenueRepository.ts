import { Venue } from "../domain/venue/Venue";

export interface VenueRepository {
  save(venue: Venue): void;
  findById(id: string): Venue | undefined;
}
