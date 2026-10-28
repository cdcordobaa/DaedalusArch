/** A text message we handed over for sending, known by the id we can ask about it later. */
export type DeliveryStatus = 'delivered' | 'failed' | 'sent';

export interface SentText {
  readonly id: string;
}
