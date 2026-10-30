export type FreightRefusal = 'too-heavy' | 'area-not-served' | 'plants-restricted' | 'no-slot';
export type DeliveryOutcome = 'in-transit' | 'received' | 'returned';

export interface FreightBooking {
  readonly freightRef: string;
  readonly depot: string | null;
}

export const RETRY_NEXT_DAY: Record<string, boolean> = {
  RJ_OVERWEIGHT: false,
  RJ_POSTCODE_UNSERVED: false,
  RJ_LIVE_PLANTS_EMBARGO: false,
  RJ_NO_COLLECTION_SLOT: true,
};

export function nextDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export const TRAYS_PER_PALLET = 40;

export function palletsFor(trays: number): number {
  return Math.ceil(trays / TRAYS_PER_PALLET);
}
