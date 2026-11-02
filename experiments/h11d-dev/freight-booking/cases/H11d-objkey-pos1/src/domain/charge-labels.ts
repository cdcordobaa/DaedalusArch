// A domain label table keyed by the carrier's reply field names.
export const CHARGE_LABELS: Record<string, string> = {
  booking_ref: 'Reference',
  freight_charge: 'Freight',
  fuel_surcharge: 'Fuel',
};

export function labelOf(field: string): string {
  return CHARGE_LABELS[field] ?? field;
}
