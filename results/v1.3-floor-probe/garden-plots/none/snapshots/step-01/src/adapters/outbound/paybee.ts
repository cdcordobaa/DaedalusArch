import { PaymentProvider } from '../../application/ports';

export class PayBeeClient implements PaymentProvider {
  constructor(private readonly baseUrl: string, private readonly apiKey: string, private readonly webhookUrl: string) {}

  async createPaymentLink(reference: string, amount: number, description: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/payment-links`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': this.apiKey },
      body: JSON.stringify({ reference, amount, currency: 'EUR', description, webhook_url: this.webhookUrl }),
    });
    if (!res.ok) throw new Error(`PayBee error ${res.status}`);
    const body = (await res.json()) as { url: string };
    return body.url;
  }
}
