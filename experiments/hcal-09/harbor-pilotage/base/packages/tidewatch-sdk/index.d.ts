export type VoyagePhase = 'ANCHORED' | 'UNDERWAY' | 'MOORED' | 'BERTHING' | 'DIVERTED' | 'SCRUBBED';
export type HullClass = 'PANAMAX' | 'HANDYSIZE' | 'FEEDER' | 'COASTER';
export type TidewatchErrorCode = 'TW_NO_WINDOW' | 'TW_AUTH' | 'TW_UNREACHABLE';

export interface TideWindowRequest {
  imo_number: string;
  draught_m: number;
  eta_utc: string;
}

export interface TideWindowResponse {
  berth_window_ref: string;
  window_open_utc: string;
  window_close_utc: string;
  hull_class: HullClass;
  ukc_margin_m: number;
  squat: number;
  notes: string | null;
}

export interface VesselMovementEvent {
  imo_number: string;
  berth_window_ref: string;
  phase: VoyagePhase;
  squat: number;
  notes: string | null;
  reported_at_utc: string;
}

export class TidewatchError extends Error {
  code: TidewatchErrorCode;
}

export class TidewatchClient {
  constructor(options: { access_token: string });
  requestWindow(request: TideWindowRequest): Promise<TideWindowResponse>;
  movement(imo_number: string): Promise<VesselMovementEvent>;
}
