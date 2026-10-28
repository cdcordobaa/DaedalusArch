import type { Location } from '../../domain/Location';

/** How long a car takes on the road. */
export interface RouteTimes {
  /** The road time in seconds through the stops, in the given order. */
  seconds(stops: readonly Location[]): Promise<number>;
}
