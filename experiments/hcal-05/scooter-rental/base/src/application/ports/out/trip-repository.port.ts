import { Trip } from '../../../domain/trip';
export interface TripRepositoryPort {
  save(trip: Trip): Promise<void>;
  find(id: string): Promise<Trip | undefined>;
}
