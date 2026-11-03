export type RunState = 'QUEUED' | 'MILLING' | 'PRESSING' | 'SETTLING' | 'BOTTLED' | 'SPOILED';
export type FruitGrade = 'PRIME' | 'JUICING' | 'CULL';
export type PressmarkErrorCode = 'PM_NO_SLOT' | 'PM_AUTH' | 'PM_DOWN';

export interface PressOrderRequest {
  cultivar_code: string;
  bins: number;
  delivery_date: string;
  brix: number;
}

export interface PressRunReport {
  run_id: string;
  run_state: RunState;
  grade: FruitGrade;
  litres: number;
  pomace: number;
  sediment: number;
  weight: number;
}

export class PressmarkError extends Error {
  code: PressmarkErrorCode;
}

export class PressmarkClient {
  constructor(options: { api_key: string });
  book(request: PressOrderRequest): Promise<PressRunReport>;
  report(run_id: string): Promise<PressRunReport>;
}
