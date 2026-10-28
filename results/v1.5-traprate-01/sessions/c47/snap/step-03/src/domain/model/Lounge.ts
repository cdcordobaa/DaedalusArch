import { InvalidRequest } from '../errors/LoungeErrors';
import type { AirportCode } from './AirportCode';

export class Lounge {
  private constructor(
    readonly id: string,
    readonly name: string,
    readonly airport: AirportCode,
    readonly capacity: number,
    private readonly partners: ReadonlySet<string>,
  ) {}

  static open(id: string, name: string, airport: AirportCode, capacity: number, partners: readonly string[]): Lounge {
    if (name.trim() === '') throw new InvalidRequest('a lounge needs a name');
    if (!Number.isInteger(capacity) || capacity < 1) throw new InvalidRequest('capacity must be a whole number of at least 1');
    return new Lounge(id, name.trim(), airport, capacity, new Set(partners.map((p) => p.trim().toUpperCase())));
  }

  accepts(airline: string): boolean {
    return this.partners.has(airline);
  }
}
