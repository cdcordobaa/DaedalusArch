import { Mailer } from '../../application/ports';

export class FakeMailer implements Mailer {
  readonly messages: { to: string; subject: string; body: string }[] = [];
  send(to: string, subject: string, body: string): void {
    this.messages.push({ to, subject, body });
  }
}
