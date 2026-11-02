// A lookup table in the core whose values are the carrier's reply field names.
export const BOOKING_FIELDS = {
  reference: 'booking_ref',
  state: 'booking_state',
  charge: 'freight_charge',
  surcharge: 'fuel_surcharge',
} as const;

export function fieldFor(name: keyof typeof BOOKING_FIELDS): string {
  return BOOKING_FIELDS[name];
}
