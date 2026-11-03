export type PermitState = 'LODGED' | 'VETTED' | 'GRANTED' | 'DEFERRED' | 'REVOKED' | 'LAPSED';
export type HazardBand = 'CALM' | 'BREEZY' | 'WATCH' | 'SURGE' | 'CLOSURE';
export type IceTrailErrorCode = 'E_QUOTA_FULL' | 'E_ZONE_SHUT' | 'E_AUTH';

export interface PermitRequest {
  route_code: string;
  party_size: number;
  ascent_date: string;
  lead_guide_licence: string;
  notes: string;
}

export interface PermitResponse {
  permit_no: string;
  state: PermitState;
  warden: string | null;
  quota: number;
  cairn: string;
}

export interface HazardBulletin {
  route_code: string;
  band: HazardBand;
  serac: boolean;
  issued_at: string;
  notes: string;
}

export class IceTrailError extends Error {
  code: IceTrailErrorCode;
}

export class IceTrailClient {
  constructor(options: { api_key: string });
  lodge(request: PermitRequest): Promise<PermitResponse>;
  lookup(permit_no: string): Promise<PermitResponse>;
}
