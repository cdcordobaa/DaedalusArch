import { TextwaveRecipientBlockedError, TextwaveThrottledError, type TextwaveClient, type TextwaveDeliveryState } from 'textwave-sdk';
import type { TextMessages } from '../../../application/ports/out/TextMessages';
import { RecipientOptedOut } from '../../../domain/errors/RecipientOptedOut';
import { RecipientUnreachable } from '../../../domain/errors/RecipientUnreachable';
import { TextingThrottled } from '../../../domain/errors/TextingThrottled';
import type { PhoneNumber } from '../../../domain/model/PhoneNumber';
import type { SentText } from '../../../domain/model/SentText';
import type { TextDelivery } from '../../../domain/model/TextDelivery';

const DELIVERY: Record<TextwaveDeliveryState, TextDelivery> = { ACCEPTED: 'pending', DELIVERED: 'delivered', UNDELIVERED: 'failed', EXPIRED: 'failed' };

export class TextwaveTextMessagesAdapter implements TextMessages {
  constructor(
    private readonly client: TextwaveClient,
    private readonly senderId: string,
  ) {}

  async send(to: PhoneNumber, text: string): Promise<SentText> {
    try {
      const response = await this.client.submit({ to: to.value, from: this.senderId, body: text });
      return { id: response.messageSid };
    } catch (e) {
      if (e instanceof TextwaveThrottledError) throw new TextingThrottled(e.retryAfterSeconds * 1000);
      if (e instanceof TextwaveRecipientBlockedError) throw e.blockReason === 'OPTED_OUT' ? new RecipientOptedOut() : new RecipientUnreachable();
      throw e;
    }
  }

  async deliveryOf(textId: string): Promise<TextDelivery> {
    const report = await this.client.deliveryReport(textId);
    return DELIVERY[report.deliveryState];
  }
}
