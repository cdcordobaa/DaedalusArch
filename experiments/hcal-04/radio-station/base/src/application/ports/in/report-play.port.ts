import type { ReportReceipt } from '../../../domain/play-report';

export interface ReportPlayCommand {
  trackId: string;
  startedAt: Date;
  durationSeconds: number;
}

export interface ReportPlayPort {
  execute(command: ReportPlayCommand): Promise<ReportReceipt>;
}
