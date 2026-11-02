// A core table whose values are the core's own camelCase names, not the carrier's spelling.
export const BOOKING_FIELDS = {
  reference: 'bookingRef',
  state: 'bookingState',
  charge: 'freightCharge',
  surcharge: 'fuelSurcharge',
} as const;

export function fieldFor(name: keyof typeof BOOKING_FIELDS): string {
  return BOOKING_FIELDS[name];
}
