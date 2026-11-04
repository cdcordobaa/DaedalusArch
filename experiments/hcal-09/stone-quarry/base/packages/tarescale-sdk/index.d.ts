export type ScaleStatus = 'STABLE' | 'MOTION' | 'OVERLOAD';
export type TarescaleErrorCode = 'TS_OFFLINE' | 'TS_UNKNOWN_PLATE';

export interface WeighTicket {
  ticket_no: string;
  plate: string;
  gross_kg: number;
  tare_kg: number;
  status: ScaleStatus;
  issued_at: string;
}

export class TarescaleError extends Error {
  code: TarescaleErrorCode;
}

export class TarescaleClient {
  constructor(options: { site_id: string });
  weigh(plate: string): Promise<WeighTicket>;
}
