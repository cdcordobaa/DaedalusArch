import { EmailSender } from '../../application/ports/outbound';

export class FakeEmailProvider implements EmailSender {
  readonly outbox: { to: string; subject: string; text: string }[] = [];
  send(to: string, subject: string, text: string): void { this.outbox.push({ to, subject, text }); }
}
