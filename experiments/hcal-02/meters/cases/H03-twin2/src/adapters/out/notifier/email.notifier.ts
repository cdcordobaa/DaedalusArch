import type { NotifierPort } from "../../../application/ports/out/notifier.port";
import { Kwh } from "../../../domain/kwh";

export class EmailNotifier implements NotifierPort {
  readonly sent: string[] = [];

  async notifyHighUsage(meterId: string, projectedKwh: number): Promise<void> {
    this.sent.push(`meter ${meterId}: projected ${Kwh.of(projectedKwh).value.toFixed(1)} kWh`);
  }
}
