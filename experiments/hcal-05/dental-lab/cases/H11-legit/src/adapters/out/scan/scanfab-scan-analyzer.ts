import { MeshPrecision, ScanFabClient, ScanFabError, ScanQualityGrade } from 'scanfab-sdk';
import { ScanAnalysisRequest, ScanAnalyzerPort } from '../../../application/ports/out/scan-analyzer.port';
import { ScanUnavailableError } from '../../../domain/errors';
import { ScanAssessment, ScanPrecision, ScanVerdict } from '../../../domain/scan-assessment';

const GRADE_TO_VERDICT: Record<ScanQualityGrade, ScanVerdict> = {
  SF_OK: 'usable',
  SF_LOW_RES: 'rescan-needed',
  SF_MARGIN_UNCLEAR: 'unreadable',
};

const PRECISION_TO_VENDOR: Record<ScanPrecision, MeshPrecision> = {
  fine: 'MICRON_25',
  standard: 'MICRON_50',
  coarse: 'MICRON_100',
};

const PRECISION_FROM_VENDOR: Record<MeshPrecision, ScanPrecision> = {
  MICRON_25: 'fine',
  MICRON_50: 'standard',
  MICRON_100: 'coarse',
};

export class ScanFabScanAnalyzer implements ScanAnalyzerPort {
  private readonly client: ScanFabClient;

  constructor(apiKey: string) {
    this.client = new ScanFabClient({ api_key: apiKey });
  }

  async analyze(request: ScanAnalysisRequest): Promise<ScanAssessment> {
    try {
      const res = await this.client.process({
        stl_payload: request.scanPayload,
        mesh_precision: PRECISION_TO_VENDOR[request.precision],
        tooth_numbers: [...request.teeth],
      });
      return {
        jobRef: res.job_id,
        verdict: GRADE_TO_VERDICT[res.quality_grade],
        precision: PRECISION_FROM_VENDOR[res.mesh_precision],
        marginGapMicrons: res.margin_gap_um,
      };
    } catch (e) {
      if (e instanceof ScanFabError) {
        throw new ScanUnavailableError(e.code === 'E_TIMEOUT' ? 'scan service timed out' : 'scan file is corrupt');
      }
      throw e;
    }
  }
}
