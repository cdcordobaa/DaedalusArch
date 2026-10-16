/** TextHive SMS HTTP API. */
export class TextHiveClient {
  constructor(private readonly baseUrl = process.env.TEXTHIVE_URL ?? 'https://api.texthive.example', private readonly token = process.env.TEXTHIVE_TOKEN ?? '') {}

  async sendSms(phone: string, message: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.token}` },
      body: JSON.stringify({ to: phone, body: message }),
    });
    if (!res.ok) throw new Error(`TextHive returned ${res.status}`);
  }
}
