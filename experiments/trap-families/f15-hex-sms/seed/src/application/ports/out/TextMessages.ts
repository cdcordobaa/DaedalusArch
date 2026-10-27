import type { PhoneNumber } from '../../../domain/model/PhoneNumber';
import type { SentText } from '../../../domain/model/SentText';

/** Sends a text message to a patient's phone, in the application's own terms. */
export interface TextMessages {
  send(to: PhoneNumber, text: string): Promise<SentText>;
}
