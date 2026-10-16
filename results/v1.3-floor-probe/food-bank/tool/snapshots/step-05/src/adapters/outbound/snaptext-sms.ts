import { SmsSender } from '../../application/ports';

export class SnapTextSmsSender implements SmsSender {
  constructor(private readonly url: string, private readonly apiKey: string) {}

  async send(phone: string, message: string): Promise<void> {
    const res = await fetch(`${this.url}/sms`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': this.apiKey },
      body: JSON.stringify({ phone, message }),
    });
    if (!res.ok) throw new Error(`SnapText returned ${res.status}`);
  }
}
