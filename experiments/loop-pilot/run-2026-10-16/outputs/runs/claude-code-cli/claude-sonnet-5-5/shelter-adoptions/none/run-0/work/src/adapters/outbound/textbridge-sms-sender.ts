import { randomUUID } from "node:crypto";
import type { SmsMessage, SmsSender } from "../../application/ports.js";
import { SMS_MAX_LENGTH } from "../../domain/notification.js";

export class TextBridgeSmsSender implements SmsSender {
  constructor(
    private readonly url: string,
    private readonly apiKey?: string,
  ) {}

  async send(message: SmsMessage): Promise<{ messageId: string }> {
    if (message.text.length > SMS_MAX_LENGTH) {
      throw new Error(`SMS text exceeds ${SMS_MAX_LENGTH} characters`);
    }
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`;
    const res = await fetch(this.url, {
      method: "POST",
      headers,
      body: JSON.stringify({ to: message.to, text: message.text }),
    });
    if (!res.ok) throw new Error(`TextBridge responded with HTTP ${res.status}`);
    const json: unknown = await res.json();
    const r = typeof json === "object" && json !== null ? (json as Record<string, unknown>) : {};
    const id = r.messageId ?? r.message_id ?? r.id;
    if (typeof id !== "string" || id === "") throw new Error("TextBridge returned no message id");
    return { messageId: id };
  }
}

export class FakeSmsSender implements SmsSender {
  private readonly messages: (SmsMessage & { messageId: string })[] = [];

  async send(message: SmsMessage): Promise<{ messageId: string }> {
    const messageId = randomUUID();
    this.messages.push({ ...message, messageId });
    return { messageId };
  }

  sent(): readonly (SmsMessage & { messageId: string })[] {
    return [...this.messages];
  }
}
