import { EmailMessage, Mailer } from '../../application/ports';

export class FakeMailer implements Mailer {
  readonly sent: (EmailMessage & { sentAt: string })[] = [];
  send(message: EmailMessage): void {
    this.sent.push({ ...message, sentAt: new Date().toISOString() });
  }
}
