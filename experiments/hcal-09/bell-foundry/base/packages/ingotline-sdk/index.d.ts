export type DispatchState = 'QUEUED' | 'POURED' | 'ASSAYED' | 'LOADED' | 'LANDED' | 'REJECTED';
export type PurityGrade = 'B20' | 'B22' | 'B23' | 'B25';
export type IngotlineErrorCode = 'IL_SHORTAGE' | 'IL_AUTH' | 'IL_DOWN';

export interface AlloyOrderRequest {
  alloy_code: string;
  mass_kg: number;
  purity: PurityGrade;
}

export interface AlloyOrderResponse {
  heat_number: string;
  dispatch_state: DispatchState;
  purity: PurityGrade;
  tin_pct: number;
  landed_date: string | null;
  carrier: string;
  assay: string;
  comment: string | null;
}

export interface DispatchNotice {
  heat_number: string;
  dispatch_state: DispatchState;
  carrier: string;
  comment: string | null;
  assay_cert_url: string | null;
}

export class IngotlineError extends Error {
  code: IngotlineErrorCode;
}

export class IngotlineClient {
  constructor(options: { token: string });
  placeOrder(request: AlloyOrderRequest): Promise<AlloyOrderResponse>;
  notice(heat_number: string): Promise<DispatchNotice>;
}
