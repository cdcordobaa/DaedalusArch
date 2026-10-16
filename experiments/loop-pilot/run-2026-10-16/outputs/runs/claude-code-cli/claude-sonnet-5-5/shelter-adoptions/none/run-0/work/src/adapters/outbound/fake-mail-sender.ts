import type { EmailMessage, MailSender } from "../../application/ports.js";

export class FakeMailSender implements MailSender {
  private readonly messages: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.messages.push(message);
  }

  sent(): readonly EmailMessage[] {
    return [...this.messages];
  }
}
