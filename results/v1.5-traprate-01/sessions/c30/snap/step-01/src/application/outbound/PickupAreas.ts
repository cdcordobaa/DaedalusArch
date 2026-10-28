import type { AreaStatus } from '../../domain/AreaStatus';
import type { Location } from '../../domain/Location';

/** Where we may pick riders up and drop them off. */
export interface PickupAreas {
  statusAt(place: Location): Promise<AreaStatus>;
}
