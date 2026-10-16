import { SmsSender } from '../../application/ports/outbound';

export class TextBridgeSms implements SmsSender {
  constructor(private readonly endpoint: string, private readonly apiKey: string) {}

  async send(phone: string, text: string): Promise<string> {
    if (text.length > 160) throw new Error('SMS longer than 160 characters');
    const r = await fetch(`${this.endpoint}/sms`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': this.apiKey },
      body: JSON.stringify({ phone, text }),
    });
    if (!r.ok) throw new Error(`TextBridge HTTP ${r.status}`);
    return ((await r.json()) as { messageId: string }).messageId;
  }
}
