import { Notifier } from "../../../application/ports/out/notifier";

export type Send = (to: string, subject: string, body: string) => Promise<void>;

export class EmailNotifier implements Notifier {
  constructor(private readonly send: Send) {}

  async notifyReceived(to: string, openingTitle: string): Promise<void> {
    await this.send(to, "Application received", `We received your application for ${openingTitle}.`);
  }

  async notifyInterview(to: string, startsAt: Date): Promise<void> {
    await this.send(to, "Interview scheduled", `Your interview is at ${startsAt.toISOString()}.`);
  }
}
