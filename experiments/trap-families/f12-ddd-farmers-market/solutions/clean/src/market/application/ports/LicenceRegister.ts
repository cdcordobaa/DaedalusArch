import type { TraderStanding } from '../../domain/day/value-objects/TraderStanding';

/** What pitch bookings need to know about licensed vendors. */
export interface LicenceRegister {
  isRegistered(vendorId: string): boolean;
  /** The standing licensing gives the vendor today. */
  standingOf(vendorId: string): TraderStanding;
}
