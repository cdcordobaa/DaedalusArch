export type Fulfilment = 'PICKING' | 'KILNED' | 'CRATED' | 'FREIGHTED' | 'HANDED' | 'VOIDED';
export type WoodGrade = 'MASTER' | 'CONCERT' | 'WORKSHOP' | 'STUDENT';
export type BowcraftErrorCode = 'BC_OUT_OF_STOCK' | 'BC_AUTH' | 'BC_OFFLINE';

export interface PartOrderRequest {
  part_sku: string;
  species: string;
  qty: number;
  colour: string;
}

export interface PartOrderResponse {
  order_ref: string;
  fulfilment: Fulfilment;
  grade: WoodGrade;
  backorder: boolean;
  crate: string | null;
  eta_date: string;
  colour: string;
}

export interface ConsignmentEvent {
  order_ref: string;
  fulfilment: Fulfilment;
  crate: string | null;
}

export class BowcraftError extends Error {
  code: BowcraftErrorCode;
}

export class BowcraftClient {
  constructor(options: { api_key: string });
  order(request: PartOrderRequest): Promise<PartOrderResponse>;
  track(order_ref: string): Promise<ConsignmentEvent>;
}
