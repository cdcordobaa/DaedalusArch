import type { ReportReceipt } from '../domain/play-report';
import { RoyaltyEligibility } from '../domain/royalty-eligibility';
import type { ReportPlayCommand, ReportPlayPort } from './ports/in/report-play.port';
import type { PlayReportGateway } from './ports/out/play-report.gateway';

export class ReportPlayUseCase implements ReportPlayPort {
  private readonly eligibility = new RoyaltyEligibility();

  constructor(private readonly gateway: PlayReportGateway) {}

  async execute(command: ReportPlayCommand): Promise<ReportReceipt> {
    const report = {
      trackId: command.trackId,
      startedAt: command.startedAt,
      durationSeconds: command.durationSeconds,
      precision: 'second' as const,
    };
    if (!this.eligibility.isRoyaltyBearing(report)) {
      return { verdict: 'held', receiptRef: 'skipped-short-play' };
    }
    return this.gateway.submit(report);
  }
}
