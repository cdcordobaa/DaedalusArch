export type PlayLogStatus = 'ACCEPTED' | 'REJECTED_DUPLICATE' | 'REJECTED_UNLICENSED' | 'PENDING_REVIEW';
export type TimePrecision = 'EXACT_SECOND' | 'ROUNDED_MINUTE';
export interface PlayLogRequest {
  track_isrc: string;
  play_started_at: string;
  duration_sec: number;
  station_code: string;
  time_precision: TimePrecision;
}
export interface PlayLogResponse {
  status: PlayLogStatus;
  receipt_id: string;
}
export declare class PlayLogError extends Error {
  readonly code: 'RATE_LIMITED' | 'BAD_STATION' | 'UPSTREAM_DOWN';
  constructor(code: 'RATE_LIMITED' | 'BAD_STATION' | 'UPSTREAM_DOWN', message: string);
}
export declare class PlayLogClient {
  constructor(options: { apiKey: string });
  submit(request: PlayLogRequest): Promise<PlayLogResponse>;
}
