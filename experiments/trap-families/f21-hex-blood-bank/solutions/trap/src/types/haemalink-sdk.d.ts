// Typings of the Haemalink regional blood supply SDK (haemalink-sdk 2.4), as shipped by the vendor.
declare module 'haemalink-sdk' {
  /** RBC: red blood cells; PLT: platelets; FFP: fresh frozen plasma. */
  export type HlProductCode = 'RBC' | 'PLT' | 'FFP';
  export type HlAboGroup = 'O' | 'A' | 'B' | 'AB';
  export type HlRhD = 'POS' | 'NEG';
  /** STAT: emergency, picked and dispatched first. ROUTINE: next scheduled run. */
  export type HlPriority = 'STAT' | 'ROUTINE';
  export interface HlOrderLine {
    product: HlProductCode;
    abo: HlAboGroup;
    rhd: HlRhD;
    qty: number;
  }
  export interface HlOrderRequest {
    priority: HlPriority;
    lines: HlOrderLine[];
    clinicalNote?: string;
  }
  export interface HlAllocation {
    lineNo: number;
    qtyRequested: number;
    qtyAllocated: number;
    allocationStatus: 'ALLOCATED' | 'PART_ALLOCATED' | 'BACKORDERED';
  }
  export interface HlOrderReceipt {
    orderRef: string;
    allocations: HlAllocation[];
    etaMinutes: number;
  }
  export interface HlConsignment {
    orderRef: string;
    stage: 'PICKING' | 'DISPATCHED' | 'DELIVERED';
    stageAt: string;
    courierId?: string;
  }
  /** Any failure answered by the Haemalink service. */
  export class HaemalinkError extends Error {
    readonly httpStatus: number;
  }
  /** The product and group of an order line are under embargo for the region until liftsAt (ISO 8601). */
  export class HaemalinkEmbargoError extends HaemalinkError {
    readonly embargoCode: 'REGIONAL_SHORTAGE' | 'TTI_QUARANTINE';
    readonly liftsAt: string;
    readonly lineNo: number;
  }
  export class HaemalinkClient {
    constructor(options: { apiKey: string; siteCode: string });
    submitOrder(request: HlOrderRequest): Promise<HlOrderReceipt>;
    consignment(orderRef: string): Promise<HlConsignment>;
  }
}
