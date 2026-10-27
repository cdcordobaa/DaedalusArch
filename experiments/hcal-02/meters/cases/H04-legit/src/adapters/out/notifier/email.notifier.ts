import type { Money } from "../../../domain/money";
import type { NotifierPort } from "../../../application/ports/out/notifier.port";

export class EmailNotifier implements NotifierPort {
  readonly sent: string[] = [];

  async notifyHighUsage(meterId: string, projectedKwh: number): Promise<void> {
    this.sent.push(`meter ${meterId}: projected ${projectedKwh} kWh`);
  }

  async notifyEstimate(meterId: string, cost: Money): Promise<void> {
    this.sent.push(`meter ${meterId}: estimate ${cost.cents} ${cost.currency}`);
  }
}
