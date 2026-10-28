import { TripRepositoryPort } from '../../../application/ports/out/trip-repository.port';
import { Trip } from '../../../domain/trip';

export class InMemoryTripRepository implements TripRepositoryPort {
  private readonly rows = new Map<string, Trip>();
  async save(trip: Trip): Promise<void> { this.rows.set(trip.id, trip); }
  async find(id: string): Promise<Trip | undefined> { return this.rows.get(id); }
}
