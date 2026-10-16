import { SmsGateway } from '../../application/ports';

export class TextBridgeSmsGateway implements SmsGateway {
  constructor(private readonly baseUrl: string, private readonly apiKey: string, private readonly callbackUrl: string) {}

  async send(phone: string, text: string): Promise<{ messageId: string }> {
    const res = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ to: phone, text, statusCallback: this.callbackUrl }),
    });
    if (!res.ok) throw new Error(`TextBridge responded ${res.status}`);
    const json = (await res.json()) as { id: string };
    return { messageId: json.id };
  }
}
