import { Mailer } from '../../ports/out/mailer';

export interface SentMail { to: string; subject: string; body: string; at: string }

export class FakeMailer implements Mailer {
  readonly sent: SentMail[] = [];
  send(to: string, subject: string, body: string): void {
    this.sent.push({ to, subject, body, at: new Date().toISOString() });
  }
}
