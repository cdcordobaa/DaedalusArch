import type { Delivery } from '../model/Delivery';
import type { GeoPoint } from '../model/GeoPoint';
import type { LocationAccuracy } from '../model/LocationAccuracy';

/** A located address: its canonical spelling, how precisely it was found and where it is. */
export interface LocatedAddress {
  readonly formatted: string;
  readonly accuracy: LocationAccuracy;
  readonly confidence: number;
  readonly point: GeoPoint;
}

const MIN_CONFIDENCE = 0.8;

/** Books a delivery for an order to an address that has been located precisely enough to drive to. */
export class DeliveryBooking {
  isDrivable(located: LocatedAddress): boolean {
    return (located.accuracy === 'building' || located.accuracy === 'street') && located.confidence >= MIN_CONFIDENCE;
  }

  /** Returns the scheduled delivery, or null when the address is not precise enough. */
  book(orderId: string, located: LocatedAddress | null): Delivery | null {
    if (!located || !this.isDrivable(located)) return null;
    return { orderId, status: 'scheduled', address: located.formatted, point: located.point };
  }
}
