export type LicenceStanding = 'full' | 'basic' | 'suspended';

/** What pitch bookings need to know about licensed vendors. */
export interface LicenceRegister {
  isRegistered(vendorId: string): boolean;
  /** The licence status the vendor's licence shows, or undefined for an unknown vendor. */
  standing(vendorId: string): LicenceStanding | undefined;
}
