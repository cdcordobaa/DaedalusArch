import type { NotifierPort } from "../../../application/ports/out/notifier.port";

export class EmailNotifier implements NotifierPort {
  readonly sent: string[] = [];

  async notifyHighUsage(meterId: string, projectedKwh: number): Promise<void> {
    this.sent.push(`meter ${meterId}: projected ${projectedKwh} kWh`);
  }
}
