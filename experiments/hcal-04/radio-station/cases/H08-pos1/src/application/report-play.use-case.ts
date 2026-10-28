import type { ReportReceipt } from '../domain/play-report';
import type { ReportPlayCommand, ReportPlayPort } from './ports/in/report-play.port';
import type { Notifier } from './ports/out/notifier';
import type { PlayReportGateway } from './ports/out/play-report.gateway';
import { ServiceRegistry } from './service-registry';

export class ReportPlayUseCase implements ReportPlayPort {
  constructor(private readonly gateway: PlayReportGateway) {}

  async execute(command: ReportPlayCommand): Promise<ReportReceipt> {
    const receipt = await this.gateway.submit({
      trackId: command.trackId,
      startedAt: command.startedAt,
      durationSeconds: command.durationSeconds,
      precision: 'second',
    });
    if (receipt.verdict === 'held') {
      const notifier = ServiceRegistry.resolve<Notifier>('notifier');
      await notifier.send('music-director@radio.example', 'Play held', `Track ${command.trackId} needs review`);
    }
    return receipt;
  }
}
