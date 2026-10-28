import { PlayLogClient, PlayLogError } from 'playlog-sdk';
import type { PlayLogStatus, TimePrecision } from 'playlog-sdk';
import type { PlayReportGateway } from '../../../application/ports/out/play-report.gateway';
import { ReportUnavailableError } from '../../../domain/errors';
import type { PlayReport, ReportPrecision, ReportReceipt, ReportVerdict } from '../../../domain/play-report';

const VERDICTS: Record<PlayLogStatus, ReportVerdict> = {
  ACCEPTED: 'filed',
  REJECTED_DUPLICATE: 'duplicate',
  REJECTED_UNLICENSED: 'unlicensed',
  PENDING_REVIEW: 'held',
};

const PRECISIONS: Record<ReportPrecision, TimePrecision> = {
  second: 'EXACT_SECOND',
  minute: 'ROUNDED_MINUTE',
};

type VendorFailure = PlayLogError['code'];
const RETRYABLE: ReadonlySet<VendorFailure> = new Set<VendorFailure>(['RATE_LIMITED', 'UPSTREAM_DOWN']);

export class PlayLogReportGateway implements PlayReportGateway {
  private readonly client: PlayLogClient;

  constructor(apiKey: string, private readonly stationCode: string) {
    this.client = new PlayLogClient({ apiKey });
  }

  async submit(report: PlayReport): Promise<ReportReceipt> {
    try {
      const response = await this.client.submit({
        track_isrc: report.trackId,
        play_started_at: report.startedAt.toISOString(),
        duration_sec: report.durationSeconds,
        station_code: this.stationCode,
        time_precision: PRECISIONS[report.precision],
      });
      return { verdict: VERDICTS[response.status], receiptRef: response.receipt_id };
    } catch (error) {
      if (error instanceof PlayLogError) throw new ReportUnavailableError(error.message, RETRYABLE.has(error.code));
      throw error;
    }
  }
}
