import { MeshPrecision, ScanFabClient, ScanFabError, ScanQualityGrade } from 'scanfab-sdk';
import { ScanAnalysisRequest, ScanAnalyzerPort } from '../../../application/ports/out/scan-analyzer.port';
import { ScanUnavailableError } from '../../../domain/errors';
import { ScanAssessment, ScanPrecision, ScanVerdict } from '../../../domain/scan-assessment';

export class ScanFabScanAnalyzer implements ScanAnalyzerPort {
  private readonly client: ScanFabClient;

  constructor(apiKey: string) {
    this.client = new ScanFabClient({ api_key: apiKey });
  }

  async analyze(request: ScanAnalysisRequest): Promise<ScanAssessment> {
    try {
      const res = await this.client.process({
        stl_payload: request.scanPayload,
        mesh_precision: this.toVendorPrecision(request.precision),
        tooth_numbers: [...request.teeth],
      });
      return {
        jobRef: res.job_id,
        verdict: this.toVerdict(res.quality_grade),
        precision: this.fromVendorPrecision(res.mesh_precision),
        marginGapMicrons: res.margin_gap_um,
      };
    } catch (e) {
      if (e instanceof ScanFabError) {
        throw new ScanUnavailableError(e.code === 'E_TIMEOUT' ? 'scan service timed out' : 'scan file is corrupt');
      }
      throw e;
    }
  }

  private toVerdict(grade: ScanQualityGrade): ScanVerdict {
    switch (grade) {
      case 'SF_OK': return 'usable';
      case 'SF_LOW_RES': return 'rescan-needed';
      case 'SF_MARGIN_UNCLEAR': return 'unreadable';
    }
  }

  private toVendorPrecision(p: ScanPrecision): MeshPrecision {
    return p === 'fine' ? 'MICRON_25' : p === 'standard' ? 'MICRON_50' : 'MICRON_100';
  }

  private fromVendorPrecision(p: MeshPrecision): ScanPrecision {
    return p === 'MICRON_25' ? 'fine' : p === 'MICRON_50' ? 'standard' : 'coarse';
  }
}
