export type FreightRefusal = 'too-heavy' | 'area-not-served' | 'plants-restricted' | 'no-slot';
export type DeliveryOutcome = 'in-transit' | 'on-van' | 'received' | 'returned';

export interface FreightBooking {
  readonly freightRef: string;
  readonly depot: string | null;
}

export const TRAYS_PER_PALLET = 40;

export function palletsFor(trays: number): number {
  return Math.ceil(trays / TRAYS_PER_PALLET);
}
