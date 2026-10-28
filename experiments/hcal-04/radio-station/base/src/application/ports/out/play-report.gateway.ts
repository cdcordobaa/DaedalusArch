import type { PlayReport, ReportReceipt } from '../../../domain/play-report';

export interface PlayReportGateway {
  submit(report: PlayReport): Promise<ReportReceipt>;
}
