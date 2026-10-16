import { SmsProvider } from '../../../application/ports';

/** TextBridge HTTP API: POST /v1/messages { to, text } -> { id }. */
export class TextBridgeClient implements SmsProvider {
  constructor(private readonly baseUrl: string, private readonly token: string) {}

  async send(phone: string, text: string): Promise<{ messageId: string }> {
    if (text.length > 160) throw new Error('TextBridge texts are limited to 160 characters');
    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ to: phone, text }),
    });
    if (!res.ok) throw new Error(`TextBridge returned ${res.status}`);
    const json = (await res.json()) as { id: string };
    return { messageId: json.id };
  }
}
