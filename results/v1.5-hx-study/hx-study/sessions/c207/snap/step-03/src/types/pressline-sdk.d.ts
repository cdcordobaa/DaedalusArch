// Typings of the Pressline garment-care SDK (pressline-sdk 2.7), as shipped by the vendor.
declare module 'pressline-sdk' {
  export type PresslineErrorCode = 'FABRIC_NOT_ACCEPTED' | 'QUEUE_FULL' | 'ACCOUNT_SUSPENDED' | 'ITEM_TOO_LARGE';
  export class PresslineError extends Error {
    readonly code: PresslineErrorCode;
    /** Set with QUEUE_FULL: the wait before the next drop-off is taken, in minutes. */
    readonly waitMin?: number;
  }
  export interface PresslineTicket {
    ticketNo: string;
    itemRef: string;
    readyBy: string;
  }
  export class PresslineClient {
    constructor(options: { apiKey: string; shop: string });
    dropOff(request: { itemRef: string; fabric: string; care: 'standard' | 'delicate' }): Promise<PresslineTicket>;
  }
}
