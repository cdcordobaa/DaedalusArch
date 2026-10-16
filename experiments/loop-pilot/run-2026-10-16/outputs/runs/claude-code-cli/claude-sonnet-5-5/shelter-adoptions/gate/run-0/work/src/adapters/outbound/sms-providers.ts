import type { SmsMessage, SmsPort } from "../../application/ports.js";

/** Calls the TextBridge HTTP API. Delivery is reported later through our webhook. */
export class TextBridgeSmsProvider implements SmsPort {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey?: string,
  ) {}

  async send(message: SmsMessage): Promise<{ messageId: string }> {
    const res = await fetch(`${this.baseUrl.replace(/\/+$/, "")}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({ to: message.to, text: message.text }),
    });
    if (!res.ok) throw new Error(`TextBridge responded with status ${res.status}`);
    const data = (await res.json()) as { messageId?: unknown; id?: unknown };
    const messageId = data.messageId ?? data.id;
    if (typeof messageId !== "string" || !messageId) throw new Error("TextBridge returned no message id");
    return { messageId };
  }
}

/** In-process stand-in used when no TextBridge URL is configured. */
export class FakeSmsProvider implements SmsPort {
  private readonly messages: Array<SmsMessage & { messageId: string }> = [];

  async send(message: SmsMessage): Promise<{ messageId: string }> {
    const messageId = `sms-${this.messages.length + 1}`;
    this.messages.push({ ...message, messageId });
    return { messageId };
  }

  sent(): Array<SmsMessage & { messageId: string }> {
    return [...this.messages];
  }
}
