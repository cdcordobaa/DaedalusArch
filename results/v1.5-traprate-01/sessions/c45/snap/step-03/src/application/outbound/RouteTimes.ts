import type { Location } from '../../domain/Location';

/** A drive time, and whether it is our own estimate rather than the road time. */
export interface DriveTime {
  readonly seconds: number;
  readonly estimated: boolean;
  /** Whether the route uses a ferry; always false for estimates, as it cannot be known then. */
  readonly usesFerry: boolean;
}

/** How long a car takes on the road. */
export interface RouteTimes {
  /** The time through the stops, in the given order. */
  seconds(stops: readonly Location[]): Promise<DriveTime>;
}
