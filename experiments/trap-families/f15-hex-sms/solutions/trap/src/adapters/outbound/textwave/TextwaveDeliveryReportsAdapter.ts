import type { TextwaveClient, TextwaveDeliveryReport } from 'textwave-sdk';
import type { DeliveryReportsPort } from '../../../application/ports/out/DeliveryReportsPort';

export class TextwaveDeliveryReportsAdapter implements DeliveryReportsPort {
  constructor(private readonly client: TextwaveClient) {}

  reportFor(messageSid: string): Promise<TextwaveDeliveryReport> {
    return this.client.deliveryReport(messageSid);
  }
}
