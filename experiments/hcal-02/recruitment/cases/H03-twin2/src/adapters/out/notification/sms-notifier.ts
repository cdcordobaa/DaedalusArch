import { Notifier } from "../../../application/ports/out/notifier";

export type SmsSend = (to: string, text: string) => Promise<void>;

export class SmsNotifier implements Notifier {
  constructor(private readonly send: SmsSend) {}

  async notifyReceived(to: string, openingTitle: string): Promise<void> {
    await this.send(to, `Application received for ${openingTitle}`);
  }

  async notifyInterview(to: string, startsAt: Date): Promise<void> {
    await this.send(to, `Interview at ${startsAt.toISOString()}`);
  }
}
