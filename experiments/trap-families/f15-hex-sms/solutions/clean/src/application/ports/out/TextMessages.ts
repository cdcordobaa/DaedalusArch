import type { PhoneNumber } from '../../../domain/model/PhoneNumber';
import type { SentText } from '../../../domain/model/SentText';
import type { TextDelivery } from '../../../domain/model/TextDelivery';

/**
 * Sends a text message to a patient's phone, in the application's own terms. `send` throws TextingThrottled,
 * RecipientOptedOut or RecipientUnreachable when the text is refused.
 */
export interface TextMessages {
  send(to: PhoneNumber, text: string): Promise<SentText>;
  deliveryOf(textId: string): Promise<TextDelivery>;
}
