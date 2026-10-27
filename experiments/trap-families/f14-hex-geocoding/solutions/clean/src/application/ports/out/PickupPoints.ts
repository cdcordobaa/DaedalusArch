import type { PickupPoint } from '../../../domain/model/PickupPoint';

/** The parcel lockers in a postcode area, in the application's own terms. */
export interface PickupPoints {
  inArea(postcode: string, country: string): Promise<PickupPoint[]>;
}
