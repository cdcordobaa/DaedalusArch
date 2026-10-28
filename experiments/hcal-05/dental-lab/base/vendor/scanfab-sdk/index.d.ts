export type ScanQualityGrade = 'SF_OK' | 'SF_LOW_RES' | 'SF_MARGIN_UNCLEAR';
export type MeshPrecision = 'MICRON_25' | 'MICRON_50' | 'MICRON_100';
export type ScanJobStatus = 'QUEUED' | 'PROCESSING' | 'DONE' | 'REJECTED';
export type ScanFabErrorCode = 'E_CORRUPT_STL' | 'E_TIMEOUT';

export interface ScanProcessRequest {
  stl_payload: string;
  mesh_precision: MeshPrecision;
  tooth_numbers: number[];
}

export interface ScanProcessResponse {
  job_id: string;
  job_status: ScanJobStatus;
  quality_grade: ScanQualityGrade;
  mesh_precision: MeshPrecision;
  margin_gap_um: number;
}

export class ScanFabError extends Error {
  code: ScanFabErrorCode;
}

export class ScanFabClient {
  constructor(options: { api_key: string });
  process(request: ScanProcessRequest): Promise<ScanProcessResponse>;
}
