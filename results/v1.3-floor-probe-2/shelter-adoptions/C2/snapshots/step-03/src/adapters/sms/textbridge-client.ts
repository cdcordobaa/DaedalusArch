import { SmsGateway } from '../../ports/out/sms';

export class TextBridgeClient implements SmsGateway {
  constructor(private readonly baseUrl: string, private readonly apiKey: string) {}

  async send(phone: string, text: string): Promise<string> {
    if (text.length > 160) throw new Error('TextBridge accepts at most 160 characters');
    const res = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ to: phone, text }),
    });
    if (!res.ok) throw new Error(`TextBridge error ${res.status}`);
    const data = (await res.json()) as { id: string };
    return data.id;
  }
}
