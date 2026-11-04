export type ColonyState = 'thriving' | 'nominal' | 'queenless' | 'swarmed' | 'absconded' | 'silent';
export type LeaseState = 'ACTIVE' | 'PAUSED' | 'ENDED';
export type HivepulseErrorCode = 'HP_NO_UNITS' | 'HP_FORBIDDEN' | 'HP_TIMEOUT';

export interface SensorLeaseRequest {
  yard_code: string;
  unit_count: number;
  start_date: string;
}

export interface SensorLease {
  lease_id: string;
  lease_state: LeaseState;
  unit_count: number;
  ends_on: string;
  firmware: string;
}

export interface TelemetryFrame {
  hive_tag: string;
  yard_code: string;
  colony_state: ColonyState;
  brood_temp_c: number;
  weight_kg: number;
  firmware: string;
  timestamp: string;
}

export class HivepulseError extends Error {
  code: HivepulseErrorCode;
}

export class HivepulseClient {
  constructor(options: { workspace: string; region?: string });
  leaseSensors(request: SensorLeaseRequest): Promise<SensorLease>;
  latestFrame(hive_tag: string): Promise<TelemetryFrame>;
}

export function verifyFrame(body: string, signature: string): boolean;
