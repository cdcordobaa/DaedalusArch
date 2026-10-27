import type { NotifierPort } from "../../../application/ports/out/notifier.port";
import type { GridOperatorClient } from "../gridoperator/grid-operator.client";

export class EmailNotifier implements NotifierPort {
  readonly sent: string[] = [];

  constructor(private readonly grid: GridOperatorClient) {}

  async notifyHighUsage(meterId: string, projectedKwh: number): Promise<void> {
    const reference = await this.grid.fetchReference(meterId);
    this.sent.push(`meter ${meterId}: projected ${projectedKwh} kWh (reference ${reference})`);
  }
}
