import { ScanAssessment, ScanPrecision } from '../../../domain/scan-assessment';

export interface ScanAnalysisRequest {
  readonly scanPayload: string;
  readonly precision: ScanPrecision;
  readonly teeth: readonly number[];
}

export interface ScanAnalyzerPort {
  analyze(request: ScanAnalysisRequest): Promise<ScanAssessment>;
}
