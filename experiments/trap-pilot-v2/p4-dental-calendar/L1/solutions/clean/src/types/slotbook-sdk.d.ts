// Typings of the Slotbook calendar SDK (slotbook-sdk 2.4), as shipped by the vendor.
declare module 'slotbook-sdk' {
  export type SlotbookErrorCode = 'SLOT_TAKEN' | 'CALENDAR_LOCKED' | 'OUTSIDE_OPENING' | 'RATE_LIMITED';
  export class SlotbookError extends Error {
    readonly code: SlotbookErrorCode;
    /** Set with RATE_LIMITED: how long to wait before the next request. */
    readonly retryAfterSec?: number;
  }
  export interface SlotbookSlot {
    slotId: string;
    chairId: string;
    startsAt: string;
    durationMin: number;
  }
  export interface SlotbookReservation {
    reservationId: string;
    slotId: string;
  }
  export class SlotbookClient {
    constructor(options: { apiKey: string });
    freeSlots(query: { from: string; to: string; chairId?: string }): Promise<SlotbookSlot[]>;
    reserve(request: { slotId: string; patientRef: string; note?: string }): Promise<SlotbookReservation>;
  }
}
