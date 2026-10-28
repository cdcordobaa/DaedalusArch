import type { Location } from '../Location';
import { RideError } from '../RideError';

/** Riders a pooled car takes at once. */
export const SEATS = 3;

/** One shared car: its riders and the stops it drives through, in order. */
export class Pool {
  private constructor(
    readonly id: string,
    private stopList: Location[],
    private readonly riderNames: string[],
  ) {}

  static open(id: string, rider: string, pickup: Location, dropoff: Location): Pool {
    return new Pool(id, [pickup, dropoff], [rider]);
  }

  stops(): readonly Location[] {
    return [...this.stopList];
  }

  riders(): readonly string[] {
    return [...this.riderNames];
  }

  hasFreeSeat(): boolean {
    return this.riderNames.length < SEATS;
  }

  /** The stops with one more rider: their pickup and then their drop-off come just before the last stop. */
  stopsWith(pickup: Location, dropoff: Location): Location[] {
    const stops = [...this.stopList];
    stops.splice(stops.length - 1, 0, pickup, dropoff);
    return stops;
  }

  take(rider: string, pickup: Location, dropoff: Location): void {
    if (!this.hasFreeSeat()) throw new RideError('this pool is full');
    this.stopList = this.stopsWith(pickup, dropoff);
    this.riderNames.push(rider);
  }
}
