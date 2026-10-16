import type { PushMessage, PushProvider } from "../application/ports.js";

/** PingPost HTTP API client: POSTs a device token and a short text as JSON. */
export class HttpPingPostProvider implements PushProvider {
  constructor(private readonly url: string, private readonly apiKey?: string) {}

  async send(message: PushMessage): Promise<void> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({ deviceToken: message.deviceToken, text: message.text }),
    });
    if (!res.ok) throw new Error(`PingPost responded ${res.status}`);
  }
}

/** Fake provider: records messages instead of sending them. */
export class FakePushProvider implements PushProvider {
  readonly sent: PushMessage[] = [];
  async send(message: PushMessage): Promise<void> { this.sent.push({ ...message }); }
}
