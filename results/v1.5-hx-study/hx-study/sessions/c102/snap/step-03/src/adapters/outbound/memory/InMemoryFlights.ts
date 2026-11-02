import type { Flight } from '../../../domain/model/Flight';
import type { Flights } from '../../../application/ports/out/Flights';

export class InMemoryFlights implements Flights {
  private readonly rows = new Map<string, Flight>();

  async save(flight: Flight): Promise<void> {
    this.rows.set(flight.flightId, flight);
  }

  async get(flightId: string): Promise<Flight | null> {
    return this.rows.get(flightId) ?? null;
  }
}
