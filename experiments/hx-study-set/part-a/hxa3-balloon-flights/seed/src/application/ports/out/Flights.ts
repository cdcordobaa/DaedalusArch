import type { Flight } from '../../../domain/model/Flight';

export interface Flights {
  save(flight: Flight): Promise<void>;
  get(flightId: string): Promise<Flight | null>;
}
