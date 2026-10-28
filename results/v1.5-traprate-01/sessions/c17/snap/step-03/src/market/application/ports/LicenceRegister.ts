export type LicenceStatus = 'full' | 'basic' | 'suspended';

/** What pitch bookings need to know about licensed vendors. */
export interface LicenceRegister {
  isRegistered(vendorId: string): boolean;
  /** The status the vendor's licence shows, or undefined for an unknown vendor. */
  statusOf(vendorId: string): LicenceStatus | undefined;
}
