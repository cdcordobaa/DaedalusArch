// The manifest export lists the carrier's request and reply field names as its columns (two vendor declarations).
export const MANIFEST_COLUMNS: string[] = ['shipper_account', 'pallet_count', 'booking_ref', 'freight_charge'];

export function manifestHeader(): string {
  return MANIFEST_COLUMNS.join(',');
}
