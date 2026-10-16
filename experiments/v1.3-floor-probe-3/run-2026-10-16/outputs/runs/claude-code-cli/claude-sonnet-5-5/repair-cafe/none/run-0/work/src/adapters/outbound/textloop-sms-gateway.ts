import { SmsGateway } from "../../application/ports";

export interface TextLoopOptions {
  baseUrl: string;
  apiKey: string;
}

export class TextLoopSmsGateway implements SmsGateway {
  constructor(private readonly opts: TextLoopOptions) {}

  async send(mobile: string, message: string): Promise<void> {
    if (message.length > 160) throw new Error("SMS message exceeds 160 characters");
    const res = await fetch(this.opts.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.opts.apiKey}`,
      },
      body: JSON.stringify({ mobile, message }),
    });
    if (!res.ok) throw new Error(`TextLoop responded with HTTP ${res.status}`);
  }
}

/** Used when no TextLoop credentials are configured (local development). */
export class ConsoleSmsGateway implements SmsGateway {
  async send(mobile: string, message: string): Promise<void> {
    console.log(`[sms] to ${mobile}: ${message}`);
  }
}
