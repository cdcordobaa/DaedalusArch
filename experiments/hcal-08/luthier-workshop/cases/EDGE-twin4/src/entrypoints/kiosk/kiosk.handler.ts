import { OrderPartsPort } from '../../application/ports/in/order-parts.port';

export class KioskHandler {
  constructor(private readonly orderParts: OrderPartsPort) {}

  async scan(jobTag: string): Promise<string> {
    const result = await this.orderParts.order({ jobId: jobTag.trim() });
    return `${result.jobId}: ${result.status}`;
  }
}
