import type { Location } from '../../domain/Location';

/** How long a car takes to drive through stops in order. */
export interface DriveTimes {
  seconds(stops: readonly Location[]): Promise<number>;
}
