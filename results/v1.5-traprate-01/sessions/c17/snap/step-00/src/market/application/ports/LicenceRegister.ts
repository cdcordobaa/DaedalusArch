/** What pitch bookings need to know about licensed vendors. */
export interface LicenceRegister {
  isRegistered(vendorId: string): boolean;
}
