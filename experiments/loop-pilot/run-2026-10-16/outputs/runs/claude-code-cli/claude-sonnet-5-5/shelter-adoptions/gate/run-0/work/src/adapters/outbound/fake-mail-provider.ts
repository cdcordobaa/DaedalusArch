import type { MailMessage, MailPort } from "../../application/ports.js";

export class FakeMailProvider implements MailPort {
  private readonly messages: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.messages.push({ ...message });
  }

  sent(): MailMessage[] {
    return [...this.messages];
  }
}
