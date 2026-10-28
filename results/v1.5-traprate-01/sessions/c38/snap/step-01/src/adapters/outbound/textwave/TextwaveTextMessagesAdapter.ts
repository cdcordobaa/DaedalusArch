import type { TextwaveClient } from 'textwave-sdk';
import type { TextMessages } from '../../../application/ports/out/TextMessages';
import type { PhoneNumber } from '../../../domain/model/PhoneNumber';
import type { DeliveryStatus, SentText } from '../../../domain/model/SentText';

export class TextwaveTextMessagesAdapter implements TextMessages {
  constructor(
    private readonly client: TextwaveClient,
    private readonly senderId: string,
  ) {}

  async send(to: PhoneNumber, text: string): Promise<SentText> {
    const response = await this.client.submit({ to: to.value, from: this.senderId, body: text });
    return { id: response.messageSid };
  }

  async deliveryOf(textId: string): Promise<DeliveryStatus> {
    const report = await this.client.deliveryReport(textId);
    switch (report.deliveryState) {
      case 'DELIVERED':
        return 'delivered';
      case 'UNDELIVERED':
      case 'EXPIRED':
        return 'failed';
      default:
        return 'sent';
    }
  }
}
