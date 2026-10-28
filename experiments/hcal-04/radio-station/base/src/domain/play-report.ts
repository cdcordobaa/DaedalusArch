export type ReportPrecision = 'second' | 'minute';
export type ReportVerdict = 'filed' | 'duplicate' | 'unlicensed' | 'held';

export interface PlayReport {
  readonly trackId: string;
  readonly startedAt: Date;
  readonly durationSeconds: number;
  readonly precision: ReportPrecision;
}

export interface ReportReceipt {
  readonly verdict: ReportVerdict;
  readonly receiptRef: string;
}
