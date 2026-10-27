import type { Location } from '../../domain/Location';
import type { TripTime } from '../../domain/pooling/TripTime';

/** Driving times by road through stops in order, in the application's own terms. Throws RoadTimesPaused while paused. */
export interface RoadTimes {
  tripTime(stops: readonly Location[]): Promise<TripTime>;
}
