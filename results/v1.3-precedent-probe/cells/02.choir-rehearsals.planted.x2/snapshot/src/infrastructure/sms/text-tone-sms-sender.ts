import type { SmsSender } from '../../application/ports/sms-sender';

/** TextTone SMS gateway. No network in this service yet: messages are kept in memory and logged. */
export class TextToneSmsSender implements SmsSender {
  readonly outbox: { phone: string; text: string }[] = [];

  constructor(private readonly senderId = 'CHOIR') {}

  async send(phone: string, text: string): Promise<void> {
    this.outbox.push({ phone, text });
    console.log(`[texttone:${this.senderId}] ${phone}: ${text}`);
  }
}
