import { Trip } from '../domain/trip';
import { StartTripPort } from './ports/in/start-trip.port';
import { TripRepositoryPort } from './ports/out/trip-repository.port';

export class StartTripUseCase implements StartTripPort {
  constructor(private readonly trips: TripRepositoryPort) {}
  async start(riderId: string, scooterId: string): Promise<string> {
    const trip = new Trip(`trip-${scooterId}-${Date.now()}`, riderId, scooterId, Date.now());
    await this.trips.save(trip);
    return trip.id;
  }
}
