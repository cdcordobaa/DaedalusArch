import { Mailer } from '../../application/ports';

export class FakeMailer implements Mailer {
  readonly outbox: { to: string; subject: string; body: string; at: string }[] = [];
  send(to: string, subject: string, body: string): void {
    this.outbox.push({ to, subject, body, at: new Date().toISOString() });
  }
}
