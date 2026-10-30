// Typings of the Sackline wholesale SDK (sackline-sdk 4.3), as shipped by the vendor. Prices are in cents.
declare module 'sackline-sdk' {
  export type SacklineErrorCode = 'OUT_OF_STOCK' | 'BELOW_MINIMUM' | 'ACCOUNT_ON_HOLD' | 'DEPOT_CLOSED';
  export class SacklineError extends Error {
    readonly code: SacklineErrorCode;
    /** Set with BELOW_MINIMUM: how much more the order must be worth. */
    readonly shortfallCents?: number;
  }
  export interface SacklineProduct {
    sku: string;
    name: string;
    grade: string;
    bagKg: number;
    stockBags: number;
    priceCents: number;
  }
  export interface SacklineOrder {
    orderNo: string;
    sku: string;
    bags: number;
    totalCents: number;
    deliverOn: string;
  }
  export class SacklineClient {
    constructor(options: { token: string; account: string });
    products(): Promise<SacklineProduct[]>;
    placeOrder(request: { sku: string; bags: number; deliverOn: string; poRef?: string }): Promise<SacklineOrder>;
  }
}
