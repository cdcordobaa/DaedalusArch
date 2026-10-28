export type ScanVerdict = 'usable' | 'rescan-needed' | 'unreadable';
export type ScanPrecision = 'fine' | 'standard' | 'coarse';

export interface ScanAssessment {
  readonly jobRef: string;
  readonly verdict: ScanVerdict;
  readonly precision: ScanPrecision;
  readonly marginGapMicrons: number;
}
